import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient, createServerComponentClient } from '@/lib/supabase';
import { getUserRoleInStore } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const queryStoreId = url.searchParams.get('store_id');
    const queryStoreIdNew = url.searchParams.get('storeId');
    const cookieStore = await cookies();
    const cookieStoreId = cookieStore.get('store-id')?.value;
    const cookieStoreIdLegacy = cookieStore.get('storeId')?.value;

    // 優先順位: クエリパラメータ > Cookieストア
    const storeId = queryStoreId || queryStoreIdNew || cookieStoreId || cookieStoreIdLegacy;

    console.log('GET /api/casts: 店舗ID比較:', {
      queryStoreId,
      queryStoreIdNew,
      cookieStoreId,
      cookieStoreIdLegacy,
      finalStoreId: storeId
    });

    if (!storeId) {
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // クエリパラメータでstore_idまたはstoreIdが指定されている場合は認証チェックをスキップ
    // これにより、メニュー画面からのキャスト一覧取得が可能になる
    if (!queryStoreId && !queryStoreIdNew) {
      // 認証用クライアント（Cookieベース）
      const authClient = await createServerComponentClient();

      // ユーザー情報を取得
      const { data: { user } } = await authClient.auth.getUser();

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
    }

    // 店舗情報を取得
    const { data: store } = await supabase
      .from('stores')
      .select('enable_cast_management')
      .eq('store_id', storeId)
      .single();

    if (!store || !store.enable_cast_management) {
      return NextResponse.json(
        { error: 'キャスト管理機能が無効です' },
        { status: 403 }
      );
    }

    // キャスト一覧を取得
    const { data: casts, error } = await supabase
      .from('store_users')
      .select(`
        id,
        role,
        user_id,
        display_name
      `)
      .eq('store_id', storeId)
      .eq('role', 'cast');

    if (error) {
      console.error('キャスト一覧取得エラー:', error);
      return NextResponse.json(
        { error: 'キャスト一覧の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(casts);
  } catch (error) {
    console.error('キャスト一覧取得エラー:', error);
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

    // 店舗情報を取得
    const { data: store } = await supabase
      .from('stores')
      .select('enable_cast_management')
      .eq('store_id', storeId)
      .single();

    if (!store || !store.enable_cast_management) {
      return NextResponse.json(
        { error: 'キャスト管理機能が無効です' },
        { status: 403 }
      );
    }

    const data = await request.json();

    // バリデーション
    if (!data.email || !data.password || !data.store_id || !data.display_name) {
      return NextResponse.json(
        { error: '必須項目が不足しています' },
        { status: 400 }
      );
    }

    // メールアドレスが既に存在するか確認
    const { data: existingUser } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', data.email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に使用されています' },
        { status: 409 }
      );
    }

    // 新規ユーザーを作成
    const { data: newUser, error: userError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });

    if (userError) {
      console.error('ユーザー作成エラー:', userError);
      return NextResponse.json(
        { error: 'ユーザーの作成に失敗しました' },
        { status: 500 }
      );
    }

    // 店舗ユーザー関連付けを作成
    const { data: storeUser, error: storeUserError } = await supabase
      .from('store_users')
      .insert({
        store_id: data.store_id,
        user_id: newUser.user.id,
        role: 'cast',
        display_name: data.display_name
      })
      .select()
      .single();

    if (storeUserError) {
      console.error('店舗ユーザー関連付けエラー:', storeUserError);

      // ユーザー作成に成功したが関連付けに失敗した場合、ユーザーを削除
      await supabase.auth.admin.deleteUser(newUser.user.id);

      return NextResponse.json(
        { error: '店舗ユーザー関連付けの作成に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(storeUser, { status: 201 });
  } catch (error) {
    console.error('キャスト作成エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
