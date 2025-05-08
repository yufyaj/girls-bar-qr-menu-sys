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

    const allCookies = cookieStore.getAll();

    if (!storeId) {
      console.error('GET /api/proxy-order/active-tables: 店舗IDがCookieに見つかりません');
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }

    const supabase = await createServerSupabaseClient();

    // まず、アクティブなセッションを取得
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('session_id, table_id, charge_started_at')
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

    // セッションがない場合は空の配列を返す
    if (!sessions || sessions.length === 0) {
      return NextResponse.json([]);
    }

    // セッションに関連するテーブル情報を取得
    const tableIds = sessions.map(session => session.table_id);

    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select(`
        table_id,
        name,
        seat_type_id,
        seat_types (
          seat_type_id,
          display_name
        )
      `)
      .in('table_id', tableIds);

    if (tablesError) {
      console.error('テーブル取得エラー:', tablesError);
      return NextResponse.json(
        { error: 'テーブル情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    // テーブルIDをキーにしたマップを作成
    const tableMap = new Map();
    tables?.forEach(table => {
      tableMap.set(table.table_id, table);
    });

    // セッションとテーブル情報を組み合わせる
    const activeTables = sessions.map(session => {
      const table = tableMap.get(session.table_id);
      if (!table) return null;

      return {
        table_id: table.table_id,
        name: table.name,
        session_id: session.session_id,
        seat_type: table.seat_types?.display_name || '不明'
      };
    }).filter(Boolean);

    return NextResponse.json(activeTables);
  } catch (error) {
    console.error('アクティブテーブル取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
