import { createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// PATCHメソッドとPOSTメソッドの両方をサポート
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ order_id: string }> }
) {
  try {
    const { order_id: orderId } = await context.params;
    const cookieStore = await cookies();
    const storeId = cookieStore.get('store-id')?.value;

    if (!storeId) {
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const status = formData.get('status') as string;

    if (!status) {
      return NextResponse.json(
        { error: 'ステータスは必須です' },
        { status: 400 }
      );
    }

    // 有効なステータス値かチェック
    const validStatuses = ['new', 'ack', 'prep', 'served', 'closed', 'cancel'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: '無効なステータス値です' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();

    // 注文が存在し、正しい店舗に属しているか確認
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('order_id, store_id')
      .eq('order_id', orderId)
      .eq('store_id', storeId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: '注文が見つからないか、アクセス権がありません' },
        { status: 404 }
      );
    }

    // 注文ステータスを更新
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status })
      .eq('order_id', orderId);

    if (updateError) {
      return NextResponse.json(
        { error: '注文ステータスの更新に失敗しました' },
        { status: 500 }
      );
    }

    // Broadcast Channelにメッセージを送信
    await supabase.from('broadcast').insert({
      channel: 'broadcast:orders',
      payload: {
        type: 'order:update',
        order_id: orderId,
        status,
      },
    });

    // 成功レスポンスを返す（リダイレクトではなく）
    return NextResponse.json({
      success: true,
      order_id: orderId,
      status: status
    });

  } catch (error) {
    console.error('Order status update error:', error);
    return NextResponse.json(
      { error: '注文ステータスの更新中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// POSTメソッドでも同じ処理を行う
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ order_id: string }> }
) {
  return PATCH(request, context);
}
