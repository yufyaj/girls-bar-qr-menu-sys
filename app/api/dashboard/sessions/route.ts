import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // リクエストヘッダーからCookieを取得
    const requestCookies = request.headers.get('cookie');


    // Cookieストアからも取得
    const cookieStore = await cookies();
    const storeIdFromStore = cookieStore.get('store-id')?.value;

    // リクエストヘッダーからstore-idを抽出
    const storeIdMatch = requestCookies?.match(/store-id=([^;]+)/);
    const storeIdFromHeader = storeIdMatch ? storeIdMatch[1] : null;



    // 優先順位: ヘッダー > Cookieストア
    const storeId = storeIdFromHeader || storeIdFromStore;

    if (!storeId) {
      console.error('GET /api/dashboard/sessions: 店舗IDがCookieに見つかりません');
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }

    // リクエストヘッダーからSupabase認証トークンを抽出
    const authTokenMatch = requestCookies?.match(/sb-[^-]+-auth-token=([^;]+)/);
    const authToken = authTokenMatch ? decodeURIComponent(authTokenMatch[1]) : null;



    if (!authToken) {
      // 認証トークンがなくても続行（サービスロールを使用するため）
    }

    const supabase = await createServerSupabaseClient();

    // アクティブなセッションを取得
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        session_id,
        start_at,
        charge_started_at,
        charge_paused_at,
        tables (
          table_id,
          name,
          seat_types (
            seat_type_id,
            display_name,
            price_per_unit,
            time_unit_minutes
          )
        )
      `)
      .eq('store_id', storeId)
      .not('charge_started_at', 'is', null)
      .order('start_at', { ascending: false });

    if (error) {
      console.error('セッション取得エラー:', error);
      return NextResponse.json(
        { error: 'セッション情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('セッション取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
