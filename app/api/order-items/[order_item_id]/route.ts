import { createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// 注文アイテムを削除するAPI
export async function DELETE(
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

    const supabase = await createServerSupabaseClient();

    // 注文アイテムが存在し、正しい店舗に属しているか確認
    const { data: orderItem, error: orderItemError } = await supabase
      .from('order_items')
      .select(`
        order_item_id,
        orders (
          order_id,
          store_id
        )
      `)
      .eq('order_item_id', orderItemId)
      .single();

    if (orderItemError || !orderItem || !orderItem.orders || orderItem.orders.store_id !== storeId) {
      return NextResponse.json(
        { error: '注文アイテムが見つからないか、アクセス権がありません' },
        { status: 404 }
      );
    }

    // 注文アイテムを削除
    const { error: deleteError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_item_id', orderItemId);

    if (deleteError) {
      return NextResponse.json(
        { error: '注文アイテムの削除に失敗しました' },
        { status: 500 }
      );
    }

    // Broadcast Channelにメッセージを送信
    await supabase.from('broadcast').insert({
      channel: 'broadcast:orders',
      payload: {
        type: 'order_item:delete',
        order_item_id: orderItemId,
      },
    });

    // 成功レスポンスを返す
    return NextResponse.json({
      success: true,
      order_item_id: orderItemId
    });

  } catch (error) {
    console.error('Order item delete error:', error);
    return NextResponse.json(
      { error: '注文アイテムの削除中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
