import { createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// PATCHメソッドでステータスを更新
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ order_item_id: string }> }
) {
  try {
    const { order_item_id: orderItemId } = await context.params;
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

    // 注文アイテムが存在し、正しい店舗に属しているか確認
    const { data: orderItem, error: orderItemError } = await supabase
      .from('order_items')
      .select(`
        order_item_id,
        status,
        orders (
          order_id,
          store_id
        )
      `)
      .eq('order_item_id', orderItemId)
      .single();

    if (orderItemError || !orderItem || !orderItem.orders || orderItem.orders[0]?.store_id !== storeId) {
      return NextResponse.json(
        { error: '注文アイテムが見つからないか、アクセス権がありません' },
        { status: 404 }
      );
    }

    // 注文アイテムのステータスを更新
    console.log(`注文アイテム ${orderItemId} のステータスを ${status} に更新します`);
    const { error: updateError } = await supabase
      .from('order_items')
      .update({ status })
      .eq('order_item_id', orderItemId);

    if (updateError) {
      console.error('注文アイテムステータス更新エラー:', updateError);
      return NextResponse.json(
        { error: `注文アイテムステータスの更新に失敗しました: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Broadcast Channelにメッセージを送信
    await supabase.from('broadcast').insert({
      channel: 'broadcast:orders',
      payload: {
        type: 'order_item:update',
        order_item_id: orderItemId,
        status,
      },
    });

    // 成功レスポンスを返す
    return NextResponse.json({
      success: true,
      order_item_id: orderItemId,
      status: status
    });

  } catch (error) {
    console.error('Order item status update error:', error);
    const errorMessage = error instanceof Error ? error.message : '不明なエラー';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('エラースタック:', errorStack);
    return NextResponse.json(
      { error: `注文アイテムステータスの更新中にエラーが発生しました: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// POSTメソッドでも同じ処理を行う
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ order_item_id: string }> }
) {
  return PATCH(request, context);
}
