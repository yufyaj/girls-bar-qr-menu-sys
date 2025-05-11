import { createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    // UUIDとして処理（数値変換は不要）
    const seatTypeId = id;

    // URLクエリパラメータからstore-idを取得
    const storeIdFromQuery = request.nextUrl.searchParams.get('storeId');

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

    const supabase = await createServerSupabaseClient();

    // 席種情報を取得
    const { data: seatType, error } = await supabase
      .from('seat_types')
      .select('*')
      .eq('seat_type_id', seatTypeId)
      .eq('store_id', storeId)
      .single();

    if (error || !seatType) {
      return NextResponse.json(
        { error: '席種が見つからないか、アクセス権がありません' },
        { status: 404 }
      );
    }

    return NextResponse.json(seatType);
  } catch (error) {
    console.error('席種取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    // UUIDとして処理（数値変換は不要）
    const seatTypeId = id;

    // URLクエリパラメータからstore-idを取得
    const storeIdFromQuery = request.nextUrl.searchParams.get('storeId');

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

    const data = await request.json();

    // デバッグ用に受け取ったデータをログに出力
    console.log('PATCH /api/seat-types/[id] 受信データ:', data);

    // バリデーション
    const price = data.price_per_unit;
    if (!data.display_name || price === undefined || price < 0 || !data.time_unit_minutes || data.time_unit_minutes <= 0) {
      return NextResponse.json(
        { error: '必須項目が不足しているか、無効な値です' },
        { status: 400 }
      );
    }

    // 既存の席種のコードを取得して使用
    const supabase = await createServerSupabaseClient();

    // 席種が存在し、正しい店舗に属しているか確認
    const { data: existingSeatType, error: fetchError } = await supabase
      .from('seat_types')
      .select('*')
      .eq('seat_type_id', seatTypeId)
      .eq('store_id', storeId)
      .single();

    if (fetchError || !existingSeatType) {
      return NextResponse.json(
        { error: '席種が見つからないか、アクセス権がありません' },
        { status: 404 }
      );
    }

    // マイグレーション後はcodeカラムは存在しないため、この処理は不要
    // data.code = existingSeatType.code;

    // マイグレーション後はcodeカラムは存在しないため、重複チェックは不要

    // 席種を更新
    const { data: updatedSeatType, error: updateError } = await supabase
      .from('seat_types')
      .update({
        display_name: data.display_name,
        price_per_unit: data.price_per_unit,
        time_unit_minutes: data.time_unit_minutes || 30 // デフォルトは30分
      })
      .eq('seat_type_id', seatTypeId)
      .eq('store_id', storeId)
      .select()
      .single();

    if (updateError) {
      console.error('席種更新エラー:', updateError);
      return NextResponse.json(
        { error: '席種の更新に失敗しました' },
        { status: 500 }
      );
    }

    // デバッグ用に更新結果をログに出力
    console.log('席種更新結果:', updatedSeatType);

    return NextResponse.json(updatedSeatType);
  } catch (error) {
    console.error('席種更新エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
