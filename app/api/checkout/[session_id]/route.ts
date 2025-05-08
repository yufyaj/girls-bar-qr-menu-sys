import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: { session_id: string } }
) {
  try {
    const { session_id } = params;
    const data = await request.json();
    const { table_id } = data;

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // セッション情報を取得
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select(`
        session_id,
        store_id,
        table_id,
        charge_started_at,
        tables (
          table_id,
          seat_type_id,
          seat_types (
            seat_type_id,
            price_per_unit,
            time_unit_minutes
          )
        )
      `)
      .eq('session_id', session_id)
      .single();



    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    // 注文合計を計算
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        order_id,
        order_items (
          order_item_id,
          price,
          quantity
        )
      `)
      .eq('session_id', session_id)
      .eq('status', 'new')
      .order('created_at', { ascending: true });



    if (ordersError) {
      console.error('注文取得エラー:', ordersError);
      return NextResponse.json(
        { error: '注文情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 注文合計金額を計算
    let orderAmount = 0;
    if (orders && orders.length > 0) {
      for (const order of orders) {
        if (order.order_items && order.order_items.length > 0) {
          for (const item of order.order_items) {
            orderAmount += item.price * item.quantity;
          }
        }
      }
    }

    // テーブル料金を計算（データベース関数を使用）
    // fn_calc_total_charge関数は既にis_table_move_charge=trueのイベントの料金を含めて計算している
    const { data: chargeAmount, error: chargeError } = await supabase
      .rpc('fn_calc_total_charge', { p_session_id: session_id });

    if (chargeError) {
      console.error('テーブル料金計算エラー:', chargeError);
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

    console.log('席移動料金:', moveChargeAmount);
    console.log('合計テーブル料金:', chargeAmount);

    // 合計金額を計算
    const totalAmount = orderAmount + (chargeAmount || 0);



    // 店舗情報を取得（スマレジ連携の確認）
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('enable_smaregi_integration, smaregi_client_id, smaregi_client_secret, smaregi_contract_id')
      .eq('store_id', session.store_id)
      .single();

    if (storeError) {
      console.error('店舗情報取得エラー:', storeError);
      return NextResponse.json(
        { error: '店舗情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 会計情報をcheckoutsテーブルに保存
    const { data: checkout, error: checkoutError } = await supabase
      .from('checkouts')
      .insert({
        store_id: session.store_id,
        session_id: session_id,
        total_amount: totalAmount,
        charge_amount: chargeAmount,
        order_amount: orderAmount,
        status: 'pending'
      })
      .select()
      .single();

    if (checkoutError) {
      console.error('会計情報保存エラー:', checkoutError);
      return NextResponse.json(
        { error: '会計情報の保存に失敗しました' },
        { status: 500 }
      );
    }

    // スマレジ連携が有効な場合、スマレジAPIに会計データを送信
    if (store.enable_smaregi_integration) {
      // TODO: スマレジAPIへの会計データ送信処理を実装
      // 実際の実装では、スマレジAPIのエンドポイントに会計データを送信し、
      // 返却されたレシートIDをcheckoutsテーブルに保存する

      // 仮実装：会計ステータスを完了に更新
      const { error: updateError } = await supabase
        .from('checkouts')
        .update({
          status: 'completed'
        })
        .eq('checkout_id', checkout.checkout_id);

      if (updateError) {
        console.error('会計ステータス更新エラー:', updateError);
        return NextResponse.json(
          { error: '会計ステータスの更新に失敗しました' },
          { status: 500 }
        );
      }
    } else {
      // スマレジ連携が無効の場合は、そのまま会計完了とする
      const { error: updateError } = await supabase
        .from('checkouts')
        .update({
          status: 'completed'
        })
        .eq('checkout_id', checkout.checkout_id);

      if (updateError) {
        console.error('会計ステータス更新エラー:', updateError);
        return NextResponse.json(
          { error: '会計ステータスの更新に失敗しました' },
          { status: 500 }
        );
      }
    }

    // 注文ステータスを更新（closedに変更）
    if (orders && orders.length > 0) {
      const orderIds = orders.map(order => order.order_id);
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          status: 'closed'
        })
        .in('order_id', orderIds);

      if (orderUpdateError) {
        console.error('注文ステータス更新エラー:', orderUpdateError);
        // エラーがあっても処理は続行
      }
    }

    const responseData = {
      checkout_id: checkout.checkout_id,
      total_amount: totalAmount,
      charge_amount: chargeAmount,
      order_amount: orderAmount,
      status: 'completed'
    };


    return NextResponse.json(responseData);
  } catch (error) {
    console.error('会計API: 予期せぬエラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
