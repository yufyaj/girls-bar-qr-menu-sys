import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // リクエストヘッダーからCookieを取得
    const requestCookies = request.headers.get('cookie');


    // Cookieストアからも取得（比較用）
    const cookieStore = await cookies();
    const storeIdFromStore = cookieStore.get('store-id')?.value;

    // リクエストヘッダーからstore-idを抽出
    const storeIdMatch = requestCookies?.match(/store-id=([^;]+)/);
    const storeIdFromHeader = storeIdMatch ? storeIdMatch[1] : null;



    // 優先順位: ヘッダー > Cookieストア
    const storeId = storeIdFromHeader || storeIdFromStore;

    if (!storeId) {
      console.error('GET /api/orders/active-items: 店舗IDがCookieに見つかりません');
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }

    const allCookies = cookieStore.getAll();

    const supabase = await createServerSupabaseClient();

    // アクティブな注文を取得
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        order_id,
        status,
        created_by_role,
        proxy,
        created_at,
        session_id,
        sessions (
          session_id,
          table_id,
          tables (
            table_id,
            name
          )
        ),
        order_items (
          order_item_id,
          product_id,
          product_name,
          quantity,
          price,
          target_cast_id,
          status
        )
      `)
      .eq('store_id', storeId)
      .not('status', 'eq', 'closed')
      .not('status', 'eq', 'cancel')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('注文取得エラー:', error);
      return NextResponse.json(
        { error: '注文情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    // セッションIDに関連付けられたテーブル情報を取得
    const sessionIds = orders
      .filter(order => order.session_id)
      .map(order => order.session_id);

    // セッションIDとテーブル名のマッピングを作成
    const sessionTableMap: Record<string, string> = {};
    
    if (sessionIds.length > 0) {
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select(`
          session_id,
          table_id,
          tables (
            table_id,
            name
          )
        `)
        .in('session_id', sessionIds);
        
      if (!sessionError && sessionData) {
        sessionData.forEach(session => {
          if (session.tables && typeof session.tables === 'object') {
            // タイプチェック: tablesが配列またはオブジェクトの場合を処理
            if (Array.isArray(session.tables)) {
              // 配列の場合は最初の要素を使用
              if (session.tables.length > 0 && session.tables[0].name) {
                sessionTableMap[session.session_id] = session.tables[0].name;
              }
            } else {
              // オブジェクトの場合は直接nameプロパティにアクセス
              // @ts-ignore - Supabaseの型推論の限界に対処
              sessionTableMap[session.session_id] = session.tables.name || '不明なテーブル';
            }
          }
        });
      } else {
        console.error('セッション情報取得エラー:', sessionError);
      }
    }

    // ターゲットキャストの情報を取得
    const castIds = orders
      .flatMap(order => order.order_items || [])
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

    // 注文アイテムを含む注文データを整形
    const formattedOrderItems = orders.flatMap(order => {
      if (!order.order_items || order.order_items.length === 0) {
        return [];
      }

      // テーブル名を取得するロジックを改善
      let tableName = '不明なテーブル';
      
      // 方法1: sessionsのネスト検索結果からテーブル名を取得
      if (order.sessions && 
          Array.isArray(order.sessions) && 
          order.sessions.length > 0 && 
          order.sessions[0].tables) {
        if (Array.isArray(order.sessions[0].tables)) {
          if (order.sessions[0].tables.length > 0 && order.sessions[0].tables[0].name) {
            tableName = order.sessions[0].tables[0].name;
          }
        } else if (typeof order.sessions[0].tables === 'object') {
          // @ts-ignore - Supabaseの型推論の限界に対処
          tableName = order.sessions[0].tables.name || tableName;
        }
      }
      
      // 方法2: セッションマップから取得（バックアップ）
      if (tableName === '不明なテーブル' && order.session_id && sessionTableMap[order.session_id]) {
        tableName = sessionTableMap[order.session_id];
      }
      
      // テーブル情報が見つからない場合、IDを含めたフォールバック
      if (tableName === '不明なテーブル' && order.session_id) {
        tableName = `不明なテーブル (${order.session_id.substring(0, 4)})`;
      }

      // すべての注文アイテムを処理
      return order.order_items
        .map(item => {
          return {
            order_id: order.order_id,
            order_item_id: item.order_item_id,
            // 注文アイテム自身のステータスを使用（存在しない場合は親注文のステータスをフォールバックとして使用）
            status: item.status || order.status,
            created_at: order.created_at,
            created_by_role: order.created_by_role,
            proxy: order.proxy,
            table_name: tableName,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity,
            target_cast_id: item.target_cast_id,
            target_cast_name: item.target_cast_id ? casts[item.target_cast_id] || '不明なキャスト' : null
          };
        });
    });

    return NextResponse.json(formattedOrderItems);
  } catch (error) {
    console.error('注文取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
