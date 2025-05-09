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

// ミドルウェアでセッションを更新する関数
export const updateSession = async (request: NextRequest) => {
  // 空のレスポンスを先に用意
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // 1. 受信した Cookie はそのまま返す
        getAll() {
          return request.cookies.getAll();
        },
        // 2. 新しい Cookie は「レスポンス」側だけに書き込む（ここがポイント）
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 必ず getUser() でセッションを再検証（トークン自動リフレッシュ）
  await supabase.auth.getUser();

  return response;
};