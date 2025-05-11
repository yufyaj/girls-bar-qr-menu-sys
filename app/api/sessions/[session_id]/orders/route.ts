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

    // セッションが存在するか確認
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('session_id')
      .eq('session_id', session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    // 注文データを取得（statusがnewのもののみ）
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        order_id,
        status,
        created_at,
        order_items (
          order_item_id,
          product_id,
          product_name,
          quantity,
          price,
          target_cast_id
        )
      `)
      .eq('session_id', session_id)
      .eq('status', 'new')
      .order('created_at', { ascending: true });

    if (ordersError) {
      console.error('注文データ取得エラー:', ordersError);
      return NextResponse.json(
        { error: '注文データの取得に失敗しました' },
        { status: 500 }
      );
    }

    // セッションから店舗IDを取得
    const { data: sessionData, error: sessionStoreError } = await supabase
      .from('sessions')
      .select('store_id')
      .eq('session_id', session_id)
      .single();

    if (sessionStoreError) {
      console.error('セッション店舗ID取得エラー:', sessionStoreError);
      return NextResponse.json(
        { error: 'セッション情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    const storeId = sessionData.store_id;

    // ターゲットキャストの情報を取得
    const castIds = orders
      .flatMap(order => order.order_items)
      .filter(item => item.target_cast_id)
      .map(item => item.target_cast_id);

    // キャストIDと表示名のマッピング
    interface CastMap {
      [key: string]: string;
    }

    let casts: CastMap = {};
    if (castIds.length > 0) {
      // 重複を排除する別の方法
      const uniqueCastIds = castIds.filter((id, index) => castIds.indexOf(id) === index);

      // store_usersテーブルからキャスト情報を取得
      // 注: user_idはstore_usersテーブルのカラムなので、そのまま取得できる
      const { data: castsData, error: castsError } = await supabase
        .from('store_users')
        .select('*')
        .eq('store_id', storeId)
        .eq('role', 'cast')
        .in('user_id', uniqueCastIds);



      if (!castsError && castsData) {
        casts = castsData.reduce((acc, cast) => {
          // display_nameがnullの場合は「キャスト」という名前を使用
          acc[cast.user_id] = cast.display_name || `キャスト${cast.id.substring(0, 4)}`;
          return acc;
        }, {});
      }
    }

    // 注文データを整形
    const formattedOrders = orders.flatMap(order =>
      order.order_items.map(item => {


        return {
          order_id: order.order_id,
          product_id: item.product_id,
          name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
          target_cast_id: item.target_cast_id,
          target_cast_name: item.target_cast_id ? casts[item.target_cast_id] || '不明なキャスト' : null
        };
      })
    );

    // 合計金額を計算
    const totalPrice = formattedOrders.reduce((sum, item) => sum + item.total, 0);

    return NextResponse.json({
      orders: formattedOrders,
      totalPrice
    });
  } catch (error) {
    console.error('注文データ取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
