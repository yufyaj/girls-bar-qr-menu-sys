import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ order_id: string }> }
) {
  try {
    const { order_id } = await params;

    // Cookieからstore-idを取得
    const cookieStore = await cookies();
    const storeId = cookieStore.get('store-id')?.value;

    if (!storeId) {
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // 注文が存在し、正しい店舗に属しているか確認
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('order_id, store_id, status, created_at, created_by_role, proxy')
      .eq('order_id', order_id)
      .eq('store_id', storeId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: '注文が見つからないか、アクセス権がありません' },
        { status: 404 }
      );
    }

    // 注文アイテムを取得
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        order_item_id,
        product_id,
        product_name,
        quantity,
        price,
        target_cast_id
      `)
      .eq('order_id', order_id);

    if (itemsError) {
      console.error('注文アイテム取得エラー:', itemsError);
      return NextResponse.json(
        { error: '注文アイテムの取得に失敗しました' },
        { status: 500 }
      );
    }

    // ターゲットキャストの情報を取得
    const castIds = orderItems
      .filter(item => item.target_cast_id)
      .map(item => item.target_cast_id);

    // キャストIDと表示名のマッピング
    interface CastMap {
      [key: string]: string;
    }

    let casts: CastMap = {};

    if (castIds.length > 0) {
      // 重複を排除
      const uniqueCastIds = castIds.filter((id, index) => castIds.indexOf(id) === index);

      // store_usersテーブルからキャスト情報を取得
      const { data: castData, error: castError } = await supabase
        .from('store_users')
        .select('user_id, display_name')
        .eq('store_id', storeId)
        .eq('role', 'cast')
        .in('user_id', uniqueCastIds);

      if (!castError && castData) {
        casts = castData.reduce((acc: CastMap, cast) => {
          // display_nameがnullの場合は「キャスト」という名前を使用
          acc[cast.user_id] = cast.display_name || `キャスト${cast.user_id.substring(0, 4)}`;
          return acc;
        }, {});
      } else {
        console.error('キャスト情報取得エラー:', castError);
      }
    }

    // 注文アイテムを整形
    const formattedItems = orderItems.map(item => {
      return {
        order_item_id: item.order_item_id,
        product_id: item.product_id,
        name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
        target_cast_id: item.target_cast_id,
        target_cast_name: item.target_cast_id ? casts[item.target_cast_id] || '不明なキャスト' : null
      };
    });

    // 合計金額を計算
    const totalPrice = formattedItems.reduce((sum, item) => sum + item.total, 0);

    // テーブル情報を取得
    const { data: orderWithSession, error: sessionError } = await supabase
      .from('orders')
      .select(`
        sessions (
          session_id,
          tables (
            table_id,
            name
          )
        )
      `)
      .eq('order_id', order_id)
      .single();

    let tableName = null;
    if (!sessionError && orderWithSession && orderWithSession.sessions && orderWithSession.sessions.tables) {
      tableName = orderWithSession.sessions.tables.name;
    }

    return NextResponse.json({
      order: {
        order_id: order.order_id,
        status: order.status,
        created_at: order.created_at,
        created_by_role: order.created_by_role,
        proxy: order.proxy,
        table_name: tableName
      },
      items: formattedItems,
      totalPrice
    });
  } catch (error) {
    console.error('注文詳細取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
