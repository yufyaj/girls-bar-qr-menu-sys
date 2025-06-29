import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ session_id: string }> }
) {
  try {
    const { session_id } = await params;
    const data = await request.json();
    const {
      target_table_id,
      calculate_only = false,   // 料金計算のみを行うフラグ（デフォルトはfalse）
      apply_full_charge = true, // 完全経過分の料金を適用するフラグ（デフォルトはtrue）
      apply_partial_charge = true // 未達成分の料金を適用するフラグ（デフォルトはtrue）
    } = data;

    if (!target_table_id) {
      return NextResponse.json(
        { error: '移動先テーブルIDが指定されていません' },
        { status: 400 }
      );
    }

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // 移動元セッション情報を取得（guest_countも含める）
    const { data: sourceSession, error: sessionError } = await supabase
      .from('sessions')
      .select(`
        session_id,
        store_id,
        table_id,
        start_at,
        charge_started_at,
        charge_paused_at,
        selected_cast_id,
        is_new_customer,
        guest_count,
        tables (
          table_id,
          seat_type_id,
          seat_types (
            seat_type_id,
            display_name,
            price_per_unit,
            time_unit_minutes
          )
        )
      `)
      .eq('session_id', session_id)
      .single();

    if (sessionError || !sourceSession) {
      console.error('セッション取得エラー:', sessionError);
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    // 移動先テーブル情報を取得
    const { data: targetTable, error: tableError } = await supabase
      .from('tables')
      .select(`
        table_id,
        store_id,
        seat_type_id,
        seat_types (
          seat_type_id,
          display_name,
          price_per_unit,
          time_unit_minutes
        )
      `)
      .eq('table_id', target_table_id)
      .single();

    if (tableError || !targetTable) {
      console.error('テーブル取得エラー:', tableError);
      return NextResponse.json(
        { error: '移動先テーブルが見つかりません' },
        { status: 404 }
      );
    }

    // 同じ店舗内での移動かチェック
    if (sourceSession.store_id !== targetTable.store_id) {
      return NextResponse.json(
        { error: '異なる店舗のテーブルには移動できません' },
        { status: 400 }
      );
    }

    // 移動先テーブルに既存のアクティブなセッションがないか確認
    const { data: existingTargetSession, error: targetSessionError } = await supabase
      .from('sessions')
      .select('session_id')
      .eq('table_id', target_table_id)
      .not('charge_started_at', 'is', null)
      .maybeSingle();

    if (existingTargetSession) {
      return NextResponse.json(
        { error: '移動先テーブルは既に使用中です' },
        { status: 400 }
      );
    }

    // 席種が変わる場合の処理
    const sourceTableSeatTypeId = sourceSession.tables?.[0]?.seat_type_id;
    const targetTableSeatTypeId = targetTable.seat_type_id;

    // 現在時刻を取得
    const now = new Date();

    // 移動元テーブルでの滞在時間に応じた料金を計算
    let fullUnitCharge = 0;  // 完全に経過した時間単位分の料金
    let partialUnitCharge = 0; // 未達成の時間単位分の料金
    let currentTableCharge = 0; // 合計料金（計算結果表示用）
    let timeUnitMinutes = 30; // デフォルトの時間単位（分）
    let seatType = null; // 席種情報（スコープを関数全体に広げる）

    if (sourceSession.charge_started_at) {
      // 移動元テーブルでの滞在時間に応じた料金のみを計算
      // 既存の移動料金を含めないようにするため、直接計算する

      // 最後のsession_seat_eventを取得（通常のイベント、is_table_move_charge=falseのもの）
      const { data: lastEvent, error: lastEventError } = await supabase
        .from('session_seat_events')
        .select('seat_type_id, price_snapshot, changed_at')
        .eq('session_id', session_id)
        .eq('is_table_move_charge', false)
        .order('changed_at', { ascending: false })
        .limit(1)
        .single();

      if (lastEventError) {
        console.error('最後のイベント取得エラー:', lastEventError);
        return NextResponse.json(
          { error: '料金計算に必要な情報の取得に失敗しました' },
          { status: 500 }
        );
      }

      // 席種の時間単位を取得
      const { data: seatTypeData, error: seatTypeError } = await supabase
        .from('seat_types')
        .select('time_unit_minutes')
        .eq('seat_type_id', lastEvent.seat_type_id)
        .single();

      if (seatTypeError) {
        console.error('席種情報取得エラー:', seatTypeError);
        return NextResponse.json(
          { error: '席種情報の取得に失敗しました' },
          { status: 500 }
        );
      }

      // 席種情報を保存
      seatType = seatTypeData;

      // 時間単位（デフォルトは30分）
      timeUnitMinutes = seatType.time_unit_minutes > 0 ? seatType.time_unit_minutes : 30;

      // 最後のイベントからの経過時間を計算（分単位）
      const lastEventTime = new Date(lastEvent.changed_at);
      const elapsedMs = now.getTime() - lastEventTime.getTime();
      const elapsedMinutes = elapsedMs / (1000 * 60);

      // 人数を取得（デフォルトは1人）
      const guestCount = sourceSession.guest_count || 1;

        // 料金計算に使用する単価を決定
        // lastEvent.price_snapshotが0の場合は、席種から直接料金を取得
        let effectivePrice = lastEvent.price_snapshot;
        if (effectivePrice === 0) {
          const { data: currentSeatType, error: currentSeatTypeError } = await supabase
            .from('seat_types')
            .select('price_per_unit')
            .eq('seat_type_id', lastEvent.seat_type_id)
            .single();
          
          if (!currentSeatTypeError && currentSeatType) {
            effectivePrice = currentSeatType.price_per_unit;
          }
        }


        // 0分時点での移動の場合は特別処理
        if (elapsedMinutes < 1) {
          // 0分時点での移動の場合、最低料金を適用（1単位分）
          partialUnitCharge = effectivePrice * guestCount;
          currentTableCharge = partialUnitCharge;
        } else {
          // 通常の計算（1分以上経過している場合）

          // 完全に経過した時間単位を計算
          const fullUnits = Math.floor(elapsedMinutes / timeUnitMinutes);

          // 完全に経過した時間単位分の料金（人数分）
          fullUnitCharge = fullUnits * effectivePrice * guestCount;

          // 残りの未達成分の時間（分）
          const remainingMinutes = elapsedMinutes - (fullUnits * timeUnitMinutes);

          // 未達成分があれば料金を計算（人数分）
          if (remainingMinutes > 0) {
            partialUnitCharge = effectivePrice * guestCount;
          }

          // 合計料金（計算結果表示用）
          currentTableCharge = fullUnitCharge + partialUnitCharge;
        }
    }

    // 移動先テーブルの席種情報を取得
    const targetSeatPrice = targetTable.seat_types?.[0]?.price_per_unit || 0;

    // 現在時刻から1ミリ秒前の時刻を計算（移動元テーブルの料金記録用）
    const moveChargeTime = new Date(now.getTime() - 1);

    // 料金計算のみのモードの場合は、計算結果を返して終了
    if (calculate_only) {
      return NextResponse.json({
        message: '料金計算が完了しました',
        previous_charge: currentTableCharge,
        full_unit_charge: fullUnitCharge,
        partial_unit_charge: partialUnitCharge,
        time_unit_minutes: timeUnitMinutes,
        guest_count: sourceSession.guest_count || 1
      });
    }

    // 適用する料金を計算
    let appliedCharge = 0;

    // 完全経過分の料金を適用する場合
    if (fullUnitCharge > 0 && apply_full_charge) {
      appliedCharge += fullUnitCharge;
    }

    // 未達成分の料金を適用する場合
    if (partialUnitCharge > 0 && apply_partial_charge) {
      appliedCharge += partialUnitCharge;
    }

    // 移動元テーブルの料金を記録するためのsession_seat_eventを作成（適用する料金が0より大きい場合のみ）
    if (appliedCharge > 0) {
      try {
        // 特別なsession_seat_eventを作成（移動前の料金を記録）
        // is_table_move_chargeフラグをtrueに設定して移動前の料金を記録
        const { error: eventError } = await supabase
          .from('session_seat_events')
          .insert({
            session_id: session_id,
            seat_type_id: sourceTableSeatTypeId, // 移動元の席種ID
            price_snapshot: appliedCharge, // 適用する料金を記録
            changed_at: moveChargeTime.toISOString(), // 現在時刻より少し前の時刻を設定
            is_table_move_charge: true // 席移動料金フラグをtrueに設定
          });

        if (eventError) {
          console.error('移動前料金記録エラー:', eventError);
          return NextResponse.json(
            { error: '移動前料金の記録に失敗しました' },
            { status: 500 }
          );
        }
      } catch (error) {
        console.error('移動前料金記録例外:', error);
        // エラーがあっても処理は続行
      }
    }

    // 新しいsession_seat_eventを作成（席種が変わる場合も変わらない場合も）
    // 必ず移動元テーブルの料金記録の後に作成する
    // 移動先テーブルの席種情報を正しく取得
    const finalTargetSeatPrice = targetTable.seat_types?.[0]?.price_per_unit || 0;    
    const { error: eventError } = await supabase
      .from('session_seat_events')
      .insert({
        session_id: session_id,
        seat_type_id: targetTableSeatTypeId, // 移動先の席種ID
        price_snapshot: finalTargetSeatPrice, // 移動先テーブルの席種の料金（正しい値を使用）
        changed_at: now.toISOString(), // 現在時刻を設定
        is_table_move_charge: false // 通常のイベントとして記録
      });

    if (eventError) {
      console.error('席種イベント作成エラー:', eventError);
      return NextResponse.json(
        { error: '席種イベントの作成に失敗しました' },
        { status: 500 }
      );
    }

    // セッションのテーブルIDを更新し、課金開始時間を現在時刻に設定
    const updateData: any = {
      table_id: target_table_id
    };

    // 課金開始時間を設定（元のセッションで課金が開始されていなくても、移動後は課金を開始する）
    updateData.charge_started_at = now.toISOString();

    // 一時停止中だった場合は、一時停止状態を解除
    if (sourceSession.charge_paused_at) {
      updateData.charge_paused_at = null;
    }

    const { data: updatedSession, error: updateError } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('session_id', session_id)
      .select()
      .single();

    if (updateError) {
      console.error('セッション更新エラー:', updateError);
      return NextResponse.json(
        { error: 'セッションの更新に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: '席移動が完了しました',
      session: updatedSession,
      previous_charge: currentTableCharge,
      applied_charge: appliedCharge,
      full_unit_charge: fullUnitCharge,
      partial_unit_charge: partialUnitCharge,
      full_charge_applied: apply_full_charge && fullUnitCharge > 0,
      partial_charge_applied: apply_partial_charge && partialUnitCharge > 0
    });
  } catch (error) {
    console.error('席移動エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
