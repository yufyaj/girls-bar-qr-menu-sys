import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
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
          // リクエストCookieを設定（Next.jsのミドルウェア用）
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set({
              name,
              value,
            });
          });

          // レスポンスCookieを設定（ブラウザ用）
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({
              name,
              value,
              ...options,
            });
          });
        },
      },
    }
  );
};

// ミドルウェアでセッションを更新する関数
export async function updateSession(request: NextRequest) {
  // レスポンスを作成
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // ミドルウェアクライアントを作成
  const supabase = createMiddlewareClient(request, response);

  try {
    // getUser()を直接使用して認証を確認（セキュリティ上の理由からgetSession()は使用しない）
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('Middleware: 認証エラー:', error);
      // エラーがあっても処理を続行（リダイレクト判定のため）
    }

    // ポータルへのアクセスは認証が必要
    if (request.nextUrl.pathname.startsWith('/portal')) {
      if (!user) {
        // 店舗IDの取得
        const storeId = request.cookies.get('store-id')?.value;
        
        if (storeId) {
          // 店舗IDからstore_codeを取得するための準備
          const supabaseAdmin = createClient(
            SUPABASE_URL,
            SUPABASE_SERVICE_KEY || '',
            {
              auth: {
                autoRefreshToken: false,
                persistSession: false,
              },
            }
          );
          
          try {
            // 店舗情報を取得してstore_codeを特定
            const { data: store, error: storeError } = await supabaseAdmin
              .from('stores')
              .select('store_code')
              .eq('store_id', storeId)
              .single();
              
            if (store && store.store_code) {
              // 店舗コードが特定できた場合は、そのログイン画面にリダイレクト
              console.log(`Middleware: 認証切れ - 店舗コード ${store.store_code} のログイン画面にリダイレクト`);
              return NextResponse.redirect(new URL(`/login/${store.store_code}`, request.url));
            }
          } catch (storeError) {
            console.error('Middleware: 店舗情報取得エラー:', storeError);
          }
        }
        
        // 店舗情報が取得できない場合はトップページにリダイレクト
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
  } catch (error) {
    console.error('Middleware: 予期せぬエラー:', error);
    // エラーが発生した場合でも処理を続行
  }

  return response;
}