import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient, createServerComponentClient } from '@/lib/supabase';
import { getUserRoleInStore } from '@/lib/auth';

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

    // メニュー一覧を取得
    const { data: menus, error } = await supabase
      .from('menus')
      .select('*')
      .eq('store_id', storeId)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('メニュー一覧取得エラー:', error);
      return NextResponse.json(
        { error: 'メニュー一覧の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(menus);
  } catch (error) {
    console.error('メニュー一覧取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}

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

    const data = await request.json();

    // バリデーション
    if (!data.product_id || !data.name || data.price < 0) {
      return NextResponse.json(
        { error: '必須項目が不足しているか、無効な値です' },
        { status: 400 }
      );
    }

    // store_idを確実に設定
    data.store_id = storeId;

    // 同じ店舗内で同じproduct_idが存在するかチェック
    const { data: existingMenu } = await supabase
      .from('menus')
      .select('menu_id')
      .eq('store_id', storeId)
      .eq('product_id', data.product_id)
      .maybeSingle();

    if (existingMenu) {
      return NextResponse.json(
        { error: 'この商品IDは既に使用されています' },
        { status: 409 }
      );
    }

    // 新規メニューを作成
    const { data: newMenu, error: createError } = await supabase
      .from('menus')
      .insert({
        store_id: data.store_id,
        product_id: data.product_id,
        name: data.name,
        description: data.description || null,
        price: data.price,
        image_url: data.image_url || null,
        category: data.category || null,
        category_id: data.category_id || null,
        is_available: data.is_available !== false,
      })
      .select()
      .single();

    if (createError) {
      console.error('メニュー作成エラー:', createError);
      return NextResponse.json(
        { error: 'メニューの作成に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(newMenu, { status: 201 });
  } catch (error) {
    console.error('メニュー作成エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
