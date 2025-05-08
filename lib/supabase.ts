import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// 共通の設定
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// サービスロール権限のクライアント（データベース操作用）
export const createServerSupabaseClient = async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase URL or Service Role Key is missing');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// サーバーコンポーネント用のクライアント（Cookieベース）
export const createServerComponentClient = async () => {
  const cookieStore = await cookies();

  const allCookies = cookieStore.getAll();

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {

              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // サーバーコンポーネントからの呼び出しの場合、エラーが発生する可能性がある
            console.error('createServerComponentClient: Cookie設定エラー:', error);
            // ミドルウェアでセッションが更新されていれば問題ない
          }
        },
      },
    }
  );
};

// ミドルウェア用のクライアント
export const createMiddlewareClient = (request: NextRequest, response: NextResponse) => {
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set({
              name,
              value,
              ...options,
            })
          );
        },
      },
    }
  );
};

// ミドルウェアでセッションを更新する関数
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });



  const supabase = createMiddlewareClient(request, response);

  // IMPORTANT: getUser()を呼び出す前にロジックを書かないこと
  // セッションの更新
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error('Middleware: 認証エラー:', error);
  }

  // ポータルへのアクセスは認証が必要
  if (request.nextUrl.pathname.startsWith('/portal')) {
    if (!user) {
      // ログインページにリダイレクト
      return NextResponse.redirect(new URL('/', request.url));
    }

    // 店舗IDの取得
    const storeId = request.cookies.get('store-id')?.value;

    if (!storeId) {
      // 店舗IDがない場合はログアウト
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL('/', request.url));
    }


  }

  return response;
}