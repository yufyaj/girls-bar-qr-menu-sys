import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ session_id: string }> }
) {
  try {
    const { session_id } = await params;

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // セッション情報を取得
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select(`
        session_id,
        store_id,
        charge_started_at,
        charge_paused_at
      `)
      .eq('session_id', session_id)
      .single();

    if (sessionError || !session) {
      console.error('セッション取得エラー:', sessionError);
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    // 課金が開始されていない場合は0を返す
    if (!session.charge_started_at) {
      return NextResponse.json({ charge_amount: 0 });
    }

    // テーブル料金を計算（データベース関数を使用）
    // fn_calc_total_charge関数は既にis_table_move_charge=trueのイベントの料金を含めて計算している
    const { data: totalChargeData, error: chargeError } = await supabase
      .rpc('fn_calc_total_charge', { p_session_id: session_id });

    if (chargeError) {
      console.error('テーブル料金計算エラー:', chargeError);

      // エラーが発生した場合は、代替の計算方法を使用
      // 席移動料金を取得
      let moveChargeAmount = 0;
      try {
        const { data: moveCharges, error: moveChargeError } = await supabase
          .from('session_seat_events')
          .select('price_snapshot')
          .eq('session_id', session_id)
          .eq('is_table_move_charge', true);

        if (!moveChargeError && moveCharges && moveCharges.length > 0) {
          for (const charge of moveCharges) {
            moveChargeAmount += charge.price_snapshot;
          }
        }
      } catch (error) {
        console.error('席移動料金取得例外:', error);
      }

      // 最後のイベントの情報を取得（席移動料金イベントを除く）
      try {
        const { data: lastEvent, error: lastEventError } = await supabase
          .from('session_seat_events')
          .select('seat_type_id, price_snapshot, changed_at')
          .eq('session_id', session_id)
          .eq('is_table_move_charge', false)
          .order('changed_at', { ascending: false })
          .limit(1)
          .single();

        if (!lastEventError && lastEvent) {
          // 席種の時間単位を取得
          const { data: seatType, error: seatTypeError } = await supabase
            .from('seat_types')
            .select('time_unit_minutes')
            .eq('seat_type_id', lastEvent.seat_type_id)
            .single();

          const timeUnitMinutes = seatType && seatType.time_unit_minutes > 0
            ? seatType.time_unit_minutes
            : 30;

          // 最後のイベントからの経過時間を計算（分単位）
          const now = session.charge_paused_at
            ? new Date(session.charge_paused_at)
            : new Date();
          const lastEventTime = new Date(lastEvent.changed_at);
          const elapsedMs = now.getTime() - lastEventTime.getTime();
          const elapsedMinutes = elapsedMs / (1000 * 60);

          // 時間単位で切り上げ
          const roundedMinutes = Math.ceil(elapsedMinutes / timeUnitMinutes) * timeUnitMinutes;

          // 時間単位の数を計算
          const timeUnits = roundedMinutes / timeUnitMinutes;

          // 現在のテーブルでの料金を計算
          const currentTableCharge = timeUnits * lastEvent.price_snapshot;

          // 合計料金を計算
          const totalCharge = moveChargeAmount + currentTableCharge;

          // 計算結果を返す
          return NextResponse.json({
            charge_amount: totalCharge,
            table_charge: currentTableCharge > 0 ? currentTableCharge : 0,
            move_charge: moveChargeAmount,
            calculated_by: 'fallback'
          });
        }
      } catch (error) {
        console.error('代替計算エラー:', error);
      }

      // 代替計算も失敗した場合はエラーを返す
      return NextResponse.json(
        { error: 'テーブル料金の計算に失敗しました' },
        { status: 500 }
      );
    }

    // 席移動による料金の内訳を取得（表示用）
    let moveChargeAmount = 0;
    try {
      // is_table_move_chargeフィールドが存在する場合
      const { data: moveCharges, error: moveChargeError } = await supabase
        .from('session_seat_events')
        .select('price_snapshot')
        .eq('session_id', session_id)
        .eq('is_table_move_charge', true);

      if (!moveChargeError && moveCharges && moveCharges.length > 0) {
        for (const charge of moveCharges) {
          moveChargeAmount += charge.price_snapshot;
        }
      }
    } catch (error) {
      console.error('席移動料金取得例外:', error);
      // エラーがあっても処理は続行
    }

    // 通常のテーブル料金（現在のテーブルでの料金）を計算
    const currentTableCharge = (totalChargeData || 0) - moveChargeAmount;

    // デバッグ情報をログに出力
    console.log('料金計算結果:', {
      totalChargeData,
      moveChargeAmount,
      currentTableCharge
    });

    return NextResponse.json({
      charge_amount: totalChargeData || 0,
      table_charge: currentTableCharge > 0 ? currentTableCharge : 0,
      move_charge: moveChargeAmount
    });
  } catch (error) {
    console.error('テーブル料金計算エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
