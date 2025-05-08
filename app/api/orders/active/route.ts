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
      console.error('GET /api/orders/active: 店舗IDがCookieに見つかりません');
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
        sessions (
          session_id,
          tables (
            table_id,
            name
          )
        )
      `)
      .eq('store_id', storeId)
      .not('status', 'eq', 'closed')
      .not('status', 'eq', 'cancel')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('注文取得エラー:', error);
      return NextResponse.json(
        { error: '注文情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(orders);
  } catch (error) {
    console.error('注文取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
