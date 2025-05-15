import { createServerSupabaseClient, createServerComponentClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// 共通の設定
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function POST(request: NextRequest) {
  try {
    // Cookieベースのクライアント
    const authClient = await createServerComponentClient();
    const cookieStore = await cookies();
    
    // 店舗IDを取得してから店舗コードを取得
    const storeId = cookieStore.get('store-id')?.value;
    let storeCode = null;
    
    if (storeId) {
      // データベースから店舗コードを取得
      const supabase = await createServerSupabaseClient();
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('store_code')
        .eq('store_id', storeId)
        .single();
        
      if (store && !storeError) {
        storeCode = store.store_code;
      }
    }

    // ログアウト処理
    await authClient.auth.signOut();

    // Cookieの削除
    const allCookies = cookieStore.getAll();

    // すべての関連Cookieを削除
    const supabaseAuthCookie = `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`;
    cookieStore.delete(supabaseAuthCookie);
    cookieStore.delete('store-id');

    // 店舗コードが特定できれば、その店舗のログイン画面にリダイレクト
    if (storeCode) {
      return NextResponse.redirect(new URL(`/login/${storeCode}`, request.url));
    }

    // 店舗コードが特定できなければトップページにリダイレクト
    return NextResponse.redirect(new URL('/', request.url));

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'ログアウト処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
