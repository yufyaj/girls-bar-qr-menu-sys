import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { getUserRoleInStore } from '@/lib/auth';

// 共通の設定
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function POST(request: NextRequest) {
  try {
    const { email, password, storeCode } = await request.json();

    if (!email || !password || !storeCode) {
      return new NextResponse(
        JSON.stringify({ error: 'メールアドレス、パスワード、店舗コードは必須です' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
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
      return new NextResponse(
        JSON.stringify({ error: '店舗が見つかりません' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // ログイン処理
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return new NextResponse(
        JSON.stringify({ error: 'ログインに失敗しました。メールアドレスとパスワードを確認してください' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // ユーザーが店舗に所属しているか確認
    const userRole = await getUserRoleInStore(authData.user.id, store.store_id);
    
    if (!userRole) {
      return new NextResponse(
        JSON.stringify({ error: 'この店舗にアクセスする権限がありません' }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // 新しいレスポンスオブジェクトを作成
    const response = new NextResponse(
      JSON.stringify({
        success: true,
        store: {
          id: store.store_id,
          name: store.name,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // 店舗IDをCookieに設定
    const storeIdCookieValue = store.store_id;
    response.headers.append(
      'Set-Cookie',
      `store-id=${storeIdCookieValue}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`
    );

    // Supabaseのセッションクッキーを設定
    const supabaseAuthCookie = `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`;
    const sessionValue = encodeURIComponent(JSON.stringify(authData.session));
    response.headers.append(
      'Set-Cookie',
      `${supabaseAuthCookie}=${sessionValue}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`
    );

    // デバッグ用：設定したCookieを確認
    console.log('設定したCookie ヘッダー:');
    console.log(response.headers.get('Set-Cookie'));

    return response;
  } catch (error) {
    console.error('ログインエラー:', error);
    return new NextResponse(
      JSON.stringify({ error: '予期せぬエラーが発生しました' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
