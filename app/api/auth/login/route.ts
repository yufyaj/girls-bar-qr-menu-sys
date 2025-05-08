import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

// 共通の設定
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function POST(request: NextRequest) {
  try {
    const { email, password, storeCode } = await request.json();

    if (!email || !password || !storeCode) {
      return NextResponse.json(
        { error: 'メールアドレス、パスワード、店舗コードは必須です' },
        { status: 400 }
      );
    }

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // 店舗コードから店舗情報を取得
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('store_id, name')
      .eq('store_code', storeCode)
      .single();

    if (storeError || !store) {
      return NextResponse.json(
        { error: '店舗が見つかりません' },
        { status: 404 }
      );
    }

    // ログイン処理
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return NextResponse.json(
        { error: 'ログインに失敗しました。メールアドレスとパスワードを確認してください' },
        { status: 401 }
      );
    }

    // Cookieを設定
    const cookieStore = await cookies();

    // 店舗IDをCookieに設定
    cookieStore.set('store-id', store.store_id, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30日間
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    // Supabaseのセッションクッキーを設定
    const supabaseAuthCookie = `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`;
    cookieStore.set(supabaseAuthCookie, JSON.stringify(authData.session), {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1週間
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    const allCookies = cookieStore.getAll();

    return NextResponse.json({
      success: true,
      store: {
        id: store.store_id,
        name: store.name,
      },
    });
  } catch (error) {
    console.error('ログインエラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
