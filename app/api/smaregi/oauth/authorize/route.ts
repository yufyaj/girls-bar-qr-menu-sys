import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient, createServerComponentClient } from '@/lib/supabase';
import { getUserRoleInStore } from '@/lib/auth';
import { generatePKCE, generateState, generateSmaregiAuthUrl } from '@/lib/smaregi-oauth';

export async function GET(request: NextRequest) {
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

    // 店舗のスマレジ設定を取得
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('smaregi_client_id, smaregi_client_secret, enable_smaregi_integration')
      .eq('store_id', storeId)
      .single();

    if (storeError || !storeData) {
      return NextResponse.json(
        { error: '店舗情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    if (!storeData.enable_smaregi_integration) {
      return NextResponse.json(
        { error: 'スマレジ連携が有効になっていません' },
        { status: 400 }
      );
    }

    if (!storeData.smaregi_client_id || !storeData.smaregi_client_secret) {
      return NextResponse.json(
        { error: 'スマレジのクライアント情報が設定されていません' },
        { status: 400 }
      );
    }

    // PKCEとstateを生成
    const { codeVerifier, codeChallenge } = generatePKCE();
    const state = generateState();

    // リダイレクトURIを構築
    const baseUrl = process.env.NEXT_PUBLIC_URL || request.nextUrl.origin;
    const redirectUri = `${baseUrl}/api/smaregi/oauth/callback`;

    // セッションにPKCEとstateを保存
    const response = NextResponse.redirect(
      generateSmaregiAuthUrl(
        storeData.smaregi_client_id,
        redirectUri,
        state,
        codeChallenge,
        'openid pos.products:read pos.transactions:write offline_access',
        process.env.NODE_ENV === 'development'
      )
    );

    // セッションクッキーに認証情報を保存（5分間有効）
    const sessionData = JSON.stringify({
      storeId,
      codeVerifier,
      state,
      redirectUri,
      clientId: storeData.smaregi_client_id,
      clientSecret: storeData.smaregi_client_secret,
    });

    response.cookies.set('smaregi-oauth-session', sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300, // 5分
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('OAuth認証開始エラー:', error);
    return NextResponse.json(
      { error: '認証開始に失敗しました' },
      { status: 500 }
    );
  }
}
