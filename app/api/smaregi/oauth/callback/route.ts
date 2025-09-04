import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForToken, saveOAuthToken } from '@/lib/smaregi-oauth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // エラーレスポンスの場合
    if (error) {
      console.error('OAuth認証エラー:', error, errorDescription);
      const redirectUrl = new URL('/portal/store-settings', request.nextUrl.origin);
      redirectUrl.searchParams.set('oauth_error', errorDescription || error);
      return NextResponse.redirect(redirectUrl);
    }

    // 必須パラメータのチェック
    if (!code || !state) {
      console.error('OAuth認証パラメータ不足:', { code: !!code, state: !!state });
      const redirectUrl = new URL('/portal/store-settings', request.nextUrl.origin);
      redirectUrl.searchParams.set('oauth_error', '認証パラメータが不足しています');
      return NextResponse.redirect(redirectUrl);
    }

    // セッションからOAuth情報を取得
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('smaregi-oauth-session');

    if (!sessionCookie) {
      console.error('OAuth認証セッションが見つかりません');
      const redirectUrl = new URL('/portal/store-settings', request.nextUrl.origin);
      redirectUrl.searchParams.set('oauth_error', '認証セッションが無効です');
      return NextResponse.redirect(redirectUrl);
    }

    let sessionData;
    try {
      sessionData = JSON.parse(sessionCookie.value);
    } catch (parseError) {
      console.error('OAuth認証セッション解析エラー:', parseError);
      const redirectUrl = new URL('/portal/store-settings', request.nextUrl.origin);
      redirectUrl.searchParams.set('oauth_error', '認証セッションが無効です');
      return NextResponse.redirect(redirectUrl);
    }

    // stateパラメータの検証（CSRF対策）
    if (state !== sessionData.state) {
      console.error('OAuth認証state不一致:', { received: state, expected: sessionData.state });
      const redirectUrl = new URL('/portal/store-settings', request.nextUrl.origin);
      redirectUrl.searchParams.set('oauth_error', '認証状態が無効です');
      return NextResponse.redirect(redirectUrl);
    }

    try {
      // 認可コードをアクセストークンに交換
      const tokenData = await exchangeCodeForToken(
        code,
        sessionData.codeVerifier,
        sessionData.clientId,
        sessionData.clientSecret,
        sessionData.redirectUri,
        process.env.NODE_ENV === 'development'
      );

      // トークンをデータベースに保存
      await saveOAuthToken(sessionData.storeId, tokenData);

      // セッションクッキーを削除
      const response = NextResponse.redirect(
        new URL('/portal/store-settings?oauth_success=true', request.nextUrl.origin)
      );

      response.cookies.set('smaregi-oauth-session', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      });

      return response;
    } catch (tokenError) {
      console.error('OAuth認証トークン取得エラー:', tokenError);
      const redirectUrl = new URL('/portal/store-settings', request.nextUrl.origin);
      redirectUrl.searchParams.set('oauth_error', 'アクセストークンの取得に失敗しました');
      return NextResponse.redirect(redirectUrl);
    }
  } catch (error) {
    console.error('OAuth認証コールバックエラー:', error);
    const redirectUrl = new URL('/portal/store-settings', request.nextUrl.origin);
    redirectUrl.searchParams.set('oauth_error', '認証処理中にエラーが発生しました');
    return NextResponse.redirect(redirectUrl);
  }
}
