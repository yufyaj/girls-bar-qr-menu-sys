import { createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
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

    // const allCookies = cookieStore.getAll(); // 未使用のため削除

    if (!storeId) {
      console.error('GET /api/seat-types: 店舗IDがCookieに見つかりません');
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }



    const supabase = await createServerSupabaseClient();

    // 店舗に紐づいた席種一覧を取得
    const { data: seatTypes, error } = await supabase
      .from('seat_types')
      .select('*')
      .eq('store_id', storeId)
      .order('display_name');

    if (error) {
      console.error('席種一覧取得エラー:', error);
      return NextResponse.json(
        { error: '席種一覧の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(seatTypes);
  } catch (error) {
    console.error('席種一覧取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const storeId = cookieStore.get('store-id')?.value;

    if (!storeId) {
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }

    const data = await request.json();

    // バリデーション
    const price = data.price_per_unit;
    if (!data.display_name || price === undefined || price < 0 || !data.time_unit_minutes || data.time_unit_minutes <= 0) {
      return NextResponse.json(
        { error: '必須項目が不足しているか、無効な値です' },
        { status: 400 }
      );
    }

    // コードはデータベース側で自動生成されるため、ここでは何もしない
    // 既存のコードがある場合（編集時など）はそれを使用

    // store_idを確実に設定
    data.store_id = storeId;

    const supabase = await createServerSupabaseClient();

    // コードはデータベース側で自動生成されるため、重複チェックは不要

    // 席種を作成（codeはデータベース側で自動生成）
    const { data: newSeatType, error } = await supabase
      .from('seat_types')
      .insert({
        display_name: data.display_name,
        price_per_unit: data.price_per_unit,
        time_unit_minutes: data.time_unit_minutes || 30, // デフォルトは30分
        store_id: storeId
      })
      .select()
      .single();

    if (error) {
      console.error('席種作成エラー:', error);
      return NextResponse.json(
        { error: '席種の作成に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(newSeatType, { status: 201 });
  } catch (error) {
    console.error('席種作成エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
