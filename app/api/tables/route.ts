import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // URLからクエリパラメータを取得
    const url = new URL(request.url);
    const storeIdFromQuery = url.searchParams.get('storeId');

    // "null"文字列の場合はnullとして扱う
    const validStoreIdFromQuery = storeIdFromQuery === 'null' ? null : storeIdFromQuery;

    // Cookieからstore-idを取得
    const cookieStore = await cookies();
    const storeIdFromCookie = cookieStore.get('store-id')?.value;

    // クエリパラメータを優先し、なければCookieから取得
    const storeId = validStoreIdFromQuery || storeIdFromCookie;

    if (!storeId) {
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }

    // リクエストボディを取得
    const data = await request.json();

    // バリデーション
    if (!data.name || !data.seat_type_id) {
      return NextResponse.json(
        { error: '必須項目が不足しています' },
        { status: 400 }
      );
    }

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // テーブルを作成
    const { data: newTable, error: createError } = await supabase
      .from('tables')
      .insert({
        name: data.name,
        seat_type_id: data.seat_type_id,
        store_id: storeId
      })
      .select()
      .single();

    if (createError) {
      console.error('テーブル作成エラー:', createError);
      return NextResponse.json(
        { error: 'テーブルの作成に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(newTable, { status: 201 });
  } catch (error) {
    console.error('テーブル作成エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}

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
      console.error('GET /api/tables: 店舗IDがCookieに見つかりません');
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }



    const supabase = await createServerSupabaseClient();

    // テーブル一覧を取得
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select(`
        table_id,
        name,
        seat_types (
          seat_type_id,
          display_name,
          price_per_unit
        )
      `)
      .eq('store_id', storeId)
      .order('name');

    if (tablesError) {
      console.error('テーブル一覧取得エラー:', tablesError);
      return NextResponse.json(
        { error: 'テーブル一覧の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(tables);
  } catch (error) {
    console.error('テーブル一覧取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
