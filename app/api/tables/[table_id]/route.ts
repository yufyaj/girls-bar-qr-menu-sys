import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table_id: string }> }
) {
  try {
    const { table_id } = await params;

    // URLクエリパラメータからstore-idを取得
    const storeIdFromQuery = request.nextUrl.searchParams.get('storeId');

    // "null"文字列の場合はnullとして扱う
    const validStoreIdFromQuery = storeIdFromQuery === 'null' ? null : storeIdFromQuery;

    // Cookieからstore-idを取得
    const cookieStore = await cookies();
    const storeIdFromCookie = cookieStore.get('store-id')?.value;

    // クエリパラメータを優先し、なければCookieから取得
    const storeId = validStoreIdFromQuery || storeIdFromCookie;

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // テーブル情報を取得
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select(`
        table_id,
        name,
        store_id,
        seat_types (
          seat_type_id,
          display_name,
          price_per_unit,
          time_unit_minutes
        ),
        stores (
          store_id,
          name
        )
      `)
      .eq('table_id', table_id)
      .single();

    if (tableError || !table) {
      console.error('テーブル取得エラー:', tableError);
      return NextResponse.json(
        { error: 'テーブルが見つかりません' },
        { status: 404 }
      );
    }

    // seat_typesの取得方法を修正
    let seatType = null;

    // テーブルのseat_type_idを取得
    const { data: tableData, error: tableDataError } = await supabase
      .from('tables')
      .select('seat_type_id')
      .eq('table_id', table_id)
      .single();

    if (!tableDataError && tableData && tableData.seat_type_id) {
      // seat_type_idを使用してseat_typesテーブルから直接取得
      const { data: seatTypeData, error: seatTypeError } = await supabase
        .from('seat_types')
        .select('seat_type_id, display_name, price_per_unit, time_unit_minutes')
        .eq('seat_type_id', tableData.seat_type_id)
        .single();

      if (!seatTypeError && seatTypeData) {
        seatType = {
          ...seatTypeData,
          price_per_unit: seatTypeData.price_per_unit
        };
      }
    }

    // 必要なデータのみを抽出して返す
    return NextResponse.json({
      table_id: table.table_id,
      name: table.name,
      store_id: table.store_id,
      seat_type: seatType,
      store: table.stores ? (
        Array.isArray(table.stores) ? (
          table.stores.length > 0 ? {
            store_id: table.stores[0].store_id,
            name: table.stores[0].name
          } : null
        ) : {
          store_id: table.stores.store_id,
          name: table.stores.name
        }
      ) : null
    });
  } catch (error) {
    console.error('テーブル情報取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ table_id: string }> }
) {
  try {
    const { table_id } = await params;

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

    // リクエストボディを取得
    const data = await request.json();

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // テーブルが存在するか確認
    const { data: existingTable, error: checkError } = await supabase
      .from('tables')
      .select('table_id')
      .eq('table_id', table_id)
      .eq('store_id', storeId)
      .single();

    if (checkError || !existingTable) {
      return NextResponse.json(
        { error: 'テーブルが見つかりません' },
        { status: 404 }
      );
    }

    // バリデーション
    if (!data.name || !data.seat_type_id) {
      return NextResponse.json(
        { error: '必須項目が不足しています' },
        { status: 400 }
      );
    }

    // テーブル情報を更新
    const { data: updatedTable, error: updateError } = await supabase
      .from('tables')
      .update({
        name: data.name,
        seat_type_id: data.seat_type_id
      })
      .eq('table_id', table_id)
      .eq('store_id', storeId)
      .select()
      .single();

    if (updateError) {
      console.error('テーブル更新エラー:', updateError);
      return NextResponse.json(
        { error: 'テーブルの更新に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedTable);
  } catch (error) {
    console.error('テーブル更新エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
