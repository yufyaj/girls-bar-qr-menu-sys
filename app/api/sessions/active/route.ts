import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // URLからクエリパラメータを取得
    const url = new URL(request.url);
    const storeIdFromQuery = url.searchParams.get('storeId');

    // リクエストヘッダーからCookieを取得
    const requestCookies = request.headers.get('cookie');


    // Cookieストアからも取得（比較用）
    const cookieStore = await cookies();
    const storeIdFromStore = cookieStore.get('store-id')?.value;
    const storeIdFromStoreLegacy = cookieStore.get('storeId')?.value;

    // リクエストヘッダーからstore-idを抽出
    const storeIdMatch = requestCookies?.match(/store-id=([^;]+)/);
    const storeIdFromHeader = storeIdMatch ? storeIdMatch[1] : null;

    // リクエストヘッダーからstoreIdを抽出（レガシー形式）
    const storeIdLegacyMatch = requestCookies?.match(/storeId=([^;]+)/);
    const storeIdLegacyFromHeader = storeIdLegacyMatch ? storeIdLegacyMatch[1] : null;



    // 優先順位: クエリパラメータ > ヘッダー > Cookieストア、新形式 > レガシー形式
    const storeId = storeIdFromQuery || storeIdFromHeader || storeIdLegacyFromHeader || storeIdFromStore || storeIdFromStoreLegacy;

    const allCookies = cookieStore.getAll();

    if (!storeId) {
      console.error('GET /api/sessions/active: 店舗IDがCookieに見つかりません');
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }



    const supabase = await createServerSupabaseClient();

    // アクティブなセッション情報を取得（charge_started_atがnullでないものを取得）
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(`
        session_id,
        table_id,
        start_at,
        charge_started_at,
        charge_paused_at
      `)
      .eq('store_id', storeId)
      .not('charge_started_at', 'is', null)
      .order('start_at', { ascending: false });

    if (sessionsError) {
      console.error('セッション取得エラー:', sessionsError);
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
