import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // リクエストボディを取得
    const data = await request.json();

    // バリデーション
    if (!data.session_id || !data.items || !Array.isArray(data.items) || data.items.length === 0) {
      return NextResponse.json(
        { error: '必須項目が不足しているか、無効な値です' },
        { status: 400 }
      );
    }

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // セッション情報を取得して店舗IDを特定
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('store_id')
      .eq('session_id', data.session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    // 注文を作成
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        store_id: session.store_id,
        session_id: data.session_id,
        status: 'new',
        created_by_role: data.created_by_role || 'customer',
        proxy: data.proxy || false
      })
      .select()
      .single();

    if (orderError) {
      console.error('注文作成エラー:', orderError);
      return NextResponse.json(
        { error: '注文の作成に失敗しました' },
        { status: 500 }
      );
    }

    // 注文明細を作成
    interface OrderItem {
      product_id: string;
      name: string;
      quantity: number;
      price: number;
      target_cast_id?: string | null;
    }

    const orderItems = data.items.map((item: OrderItem) => ({
      order_id: order.order_id,
      product_id: item.product_id,
      product_name: item.name,
      quantity: item.quantity,
      price: item.price,
      target_cast_id: item.target_cast_id || null,
      status: 'new' // 新規注文アイテムのステータスを設定
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('注文明細作成エラー:', itemsError);

      // 注文明細の作成に失敗した場合、注文自体を削除
      await supabase
        .from('orders')
        .delete()
        .eq('order_id', order.order_id);

      return NextResponse.json(
        { error: '注文明細の作成に失敗しました' },
        { status: 500 }
      );
    }

    // Broadcast Channelにメッセージを送信
    await supabase.from('broadcast').insert({
      channel: 'broadcast:orders',
      payload: {
        type: 'order:new',
        order_id: order.order_id,
        table_id: data.table_id,
        status: 'new',
      },
    });

    return NextResponse.json({
      order_id: order.order_id,
      status: order.status,
      created_at: order.created_at
    }, { status: 201 });
  } catch (error) {
    console.error('注文作成エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
