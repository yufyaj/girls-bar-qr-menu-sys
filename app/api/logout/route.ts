import { createServerSupabaseClient, createServerComponentClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// 共通の設定
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function POST(request: NextRequest) {
  try {
    // Cookieベースのクライアント
    const authClient = await createServerComponentClient();

    // ログアウト処理
    await authClient.auth.signOut();

    // Cookieの削除
    const cookieStore = await cookies();

    const allCookies = cookieStore.getAll();

    // すべての関連Cookieを削除
    const supabaseAuthCookie = `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`;
    cookieStore.delete(supabaseAuthCookie);
    cookieStore.delete('store-id');



    // ホームページにリダイレクト
    return NextResponse.redirect(new URL('/', request.url));

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'ログアウト処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
