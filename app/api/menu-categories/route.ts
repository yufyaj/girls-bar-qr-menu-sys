import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient, createServerComponentClient } from '@/lib/supabase';
import { getUserRoleInStore } from '@/lib/auth';

// カテゴリ一覧取得API
export async function GET(request: NextRequest) {
  try {
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

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // カテゴリ一覧を取得
    const { data: categories, error } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('store_id', storeId)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('カテゴリ一覧取得エラー:', error);
      return NextResponse.json(
        { error: 'カテゴリ一覧の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(categories);
  } catch (error) {
    console.error('カテゴリ一覧取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}

// カテゴリ作成API
export async function POST(request: NextRequest) {
  try {
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

    // 認証用クライアント（Cookieベース）
    const authClient = await createServerComponentClient();

    // ユーザー情報を取得
    const { data: { user } } = await authClient.auth.getUser();

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    if (!user) {
      return NextResponse.json(
        { error: '認証されていません' },
        { status: 401 }
      );
    }

    // ユーザーの役割を取得
    const userRole = await getUserRoleInStore(user.id, storeId);

    // 管理者でなければエラー
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    // 店舗情報を取得（スマレジ連携の確認）
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('enable_smaregi_integration')
      .eq('store_id', storeId)
      .single();

    if (storeError) {
      console.error('店舗情報取得エラー:', storeError);
      return NextResponse.json(
        { error: '店舗情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    // スマレジ連携が有効の場合はエラー
    if (store.enable_smaregi_integration) {
      return NextResponse.json(
        { error: 'スマレジ連携が有効になっているため、カテゴリの追加はできません。スマレジで部門を登録した後、メニュー管理画面で「スマレジと同期」ボタンをクリックしてください。' },
        { status: 403 }
      );
    }

    // リクエストボディを取得
    const data = await request.json();

    // バリデーション
    if (!data.name) {
      return NextResponse.json(
        { error: 'カテゴリ名は必須です' },
        { status: 400 }
      );
    }

    // 全カテゴリを取得
    const { data: allCategories, error: categoriesError } = await supabase
      .from('menu_categories')
      .select('category_id, name, display_order')
      .eq('store_id', storeId)
      .order('display_order', { ascending: true });

    if (categoriesError) {
      console.error('カテゴリ一覧取得エラー:', categoriesError);
    }

    console.log('既存カテゴリ:', allCategories);

    // 新規カテゴリの表示順を設定（既存カテゴリの数 + 1）
    const newDisplayOrder = allCategories && allCategories.length > 0 ? allCategories.length + 1 : 1;
    console.log('新規カテゴリの表示順:', newDisplayOrder);

    // 新規カテゴリを作成
    const { data: newCategory, error: createError } = await supabase
      .from('menu_categories')
      .insert({
        store_id: storeId,
        name: data.name,
        display_order: newDisplayOrder,
        smaregi_category_id: data.smaregi_category_id || null,
        allow_treat_cast: data.allow_treat_cast || false
      })
      .select()
      .single();

    if (createError) {
      // 一意制約違反の場合
      if (createError.code === '23505') {
        return NextResponse.json(
          { error: '同じ名前のカテゴリが既に存在します' },
          { status: 400 }
        );
      }

      console.error('カテゴリ作成エラー:', createError);
      return NextResponse.json(
        { error: 'カテゴリの作成に失敗しました' },
        { status: 500 }
      );
    }

    console.log('作成されたカテゴリ:', newCategory);

    // 作成後の全カテゴリを取得して確認（デバッグ用）
    const { data: updatedCategories } = await supabase
      .from('menu_categories')
      .select('category_id, name, display_order')
      .eq('store_id', storeId)
      .order('display_order', { ascending: true });

    console.log('更新後のカテゴリ一覧:', updatedCategories);

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.error('カテゴリ作成エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
