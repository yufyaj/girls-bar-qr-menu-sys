import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase';
import { getUserRoleInStore } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // リクエストヘッダーからCookieを取得
    const requestCookies = request.headers.get('cookie');


    // Cookieストアからも取得（比較用）
    const cookieStore = await cookies();
    const storeIdFromStore = cookieStore.get('store-id')?.value;

    // リクエストヘッダーからstore-idを抽出
    const storeIdMatch = requestCookies?.match(/store-id=([^;]+)/);
    const storeIdFromHeader = storeIdMatch ? storeIdMatch[1] : null;



    // 優先順位: ヘッダー > Cookieストア
    const storeId = storeIdFromHeader || storeIdFromStore;

    if (!storeId) {
      console.error('GET /api/auth/user: 店舗IDがCookieに見つかりません');
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }

    const allCookies = cookieStore.getAll();

    // リクエストのCookieを使用してSupabaseクライアントを作成
    // リクエストヘッダーからSupabase認証トークンを抽出
    const authTokenMatch = requestCookies?.match(/sb-[^-]+-auth-token=([^;]+)/);
    const authToken = authTokenMatch ? decodeURIComponent(authTokenMatch[1]) : null;



    if (!authToken) {
      console.error('GET /api/auth/user: 認証トークンがCookieに見つかりません');
      return NextResponse.json(
        { error: '認証されていません' },
        { status: 401 }
      );
    }

    // 認証トークンをパースしてみる
    try {
      // base64-プレフィックスがある場合は削除
      let tokenValue = authToken;
      if (tokenValue.startsWith('base64-')) {
        tokenValue = tokenValue.substring(7); // 'base64-'の長さは7
        // base64デコード
        try {
          tokenValue = Buffer.from(tokenValue, 'base64').toString();

        } catch (decodeError) {
          console.error('GET /api/auth/user: base64デコードに失敗しました:', decodeError);
        }
      }

      // JSONとしてパース
      const parsedToken = JSON.parse(tokenValue);

    } catch (e) {
      console.error('GET /api/auth/user: 認証トークンのパースに失敗しました:', e);

      // パースに失敗しても処理を続行する
    }

    const supabase = await createServerComponentClient();


    // ユーザー情報を取得
    const { data: { user }, error } = await supabase.auth.getUser();


    if (error) {
      console.error('GET /api/auth/user: 認証エラー:', error);
      return NextResponse.json(
        { error: '認証されていません' },
        { status: 401 }
      );
    }

    if (!user) {
      console.error('GET /api/auth/user: ユーザー情報が取得できません');
      return NextResponse.json(
        { error: '認証されていません' },
        { status: 401 }
      );
    }



    // ユーザーの役割を取得
    const userRole = await getUserRoleInStore(user.id, storeId);

    if (!userRole) {
      console.error('GET /api/auth/user: ユーザーに店舗の権限がありません:', { userId: user.id, storeId });
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }



    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: userRole
      }
    });
  } catch (error) {
    console.error('ユーザー情報取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
