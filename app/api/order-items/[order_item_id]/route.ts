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

    if (orderItemError) {
      console.error('注文アイテム取得エラー:', orderItemError);
      return NextResponse.json(
        { error: '注文アイテムが見つかりません' },
        { status: 404 }
      );
    }

    if (!orderItem || !orderItem.orders) {
      console.error('注文アイテムにorders情報がありません:', orderItem);
      return NextResponse.json(
        { error: '注文アイテムに関連する注文情報が見つかりません' },
        { status: 404 }
      );
    }
    
    // ordersが配列かオブジェクトかを確認して適切にstore_idを取得
    const orderStoreId = Array.isArray(orderItem.orders) 
      ? orderItem.orders[0]?.store_id 
      : (orderItem.orders as any).store_id;
      
    if (orderStoreId !== storeId) {
      console.error('店舗IDの不一致:', { orderStoreId, requestStoreId: storeId });
      return NextResponse.json(
        { error: 'この注文アイテムへのアクセス権がありません' },
        { status: 403 }
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

// PATCH メソッドでステータスを更新（Vercelにデプロイした場合の対応）
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

    if (orderItemError) {
      console.error('注文アイテム取得エラー:', orderItemError);
      return NextResponse.json(
        { error: '注文アイテムが見つかりません' },
        { status: 404 }
      );
    }

    if (!orderItem || !orderItem.orders) {
      console.error('注文アイテムにorders情報がありません:', orderItem);
      return NextResponse.json(
        { error: '注文アイテムに関連する注文情報が見つかりません' },
        { status: 404 }
      );
    }
    
    // ordersが配列かオブジェクトかを確認して適切にstore_idを取得
    const orderStoreId = Array.isArray(orderItem.orders) 
      ? orderItem.orders[0]?.store_id 
      : (orderItem.orders as any).store_id;
      
    if (orderStoreId !== storeId) {
      console.error('店舗IDの不一致:', { orderStoreId, requestStoreId: storeId });
      return NextResponse.json(
        { error: 'この注文アイテムへのアクセス権がありません' },
        { status: 403 }
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
