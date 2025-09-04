import { createServerSupabaseClient } from '@/lib/supabase';
import crypto from 'crypto';

/**
 * PKCE用のcode_verifierとcode_challengeを生成
 */
export function generatePKCE() {
  // code_verifierを生成（43-128文字のランダム文字列）
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  
  // code_challengeを生成（SHA256ハッシュのBase64URL）
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return {
    codeVerifier,
    codeChallenge
  };
}

/**
 * CSRF対策用のstateパラメータを生成
 */
export function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * スマレジOAuth認証URLを生成
 */
export function generateSmaregiAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  codeChallenge: string,
  scope: string = 'openid pos.products:read pos.transactions:write',
  isSandbox: boolean = process.env.NODE_ENV === 'development'
): string {
  const baseUrl = isSandbox ? 'https://id.smaregi.dev' : 'https://id.smaregi.jp';
  const authUrl = new URL(`${baseUrl}/authorize`);
  
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  
  return authUrl.toString();
}

/**
 * 認可コードからアクセストークンを取得
 */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  isSandbox: boolean = process.env.NODE_ENV === 'development'
): Promise<{
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}> {
  const baseUrl = isSandbox ? 'https://id.smaregi.dev' : 'https://id.smaregi.jp';
  const tokenUrl = `${baseUrl}/authorize/token`;
  
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('スマレジトークン取得エラー:', errorText);
    throw new Error('アクセストークンの取得に失敗しました');
  }
  
  return await response.json();
}

/**
 * リフレッシュトークンを使用してアクセストークンを更新
 */
export async function refreshSmaregiToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  isSandbox: boolean = process.env.NODE_ENV === 'development'
): Promise<{
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}> {
  const baseUrl = isSandbox ? 'https://id.smaregi.dev' : 'https://id.smaregi.jp';
  const tokenUrl = `${baseUrl}/authorize/token`;
  
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('スマレジトークン更新エラー:', errorText);
    throw new Error('アクセストークンの更新に失敗しました');
  }
  
  return await response.json();
}

/**
 * データベースにOAuthトークンを保存
 */
export async function saveOAuthToken(
  storeId: string,
  tokenData: {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
    scope: string;
  }
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
  
  const { error } = await supabase
    .from('smaregi_oauth_tokens')
    .upsert({
      store_id: storeId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type,
      expires_at: expiresAt.toISOString(),
      scope: tokenData.scope,
    }, {
      onConflict: 'store_id'
    });
  
  if (error) {
    console.error('OAuthトークン保存エラー:', error);
    throw new Error('認証情報の保存に失敗しました');
  }
}

/**
 * 店舗の有効なアクセストークンを取得（自動更新含む）
 */
export async function getValidSmaregiAccessToken(storeId: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  
  // 現在のトークン情報を取得
  const { data: tokenData, error } = await supabase
    .from('smaregi_oauth_tokens')
    .select('*')
    .eq('store_id', storeId)
    .single();
  
  if (error || !tokenData) {
    return null;
  }
  
  const now = new Date();
  const expiresAt = new Date(tokenData.expires_at);
  
  // トークンが有効期限内の場合はそのまま返す
  if (expiresAt > now) {
    return tokenData.access_token;
  }
  
  // リフレッシュトークンがない場合は再認証が必要
  if (!tokenData.refresh_token) {
    return null;
  }
  
  try {
    // 店舗情報を取得してクライアント認証情報を取得
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('smaregi_client_id, smaregi_client_secret')
      .eq('store_id', storeId)
      .single();
    
    if (storeError || !storeData?.smaregi_client_id || !storeData?.smaregi_client_secret) {
      console.error('店舗のスマレジ認証情報が見つかりません');
      return null;
    }
    
    // トークンを更新
    const newTokenData = await refreshSmaregiToken(
      tokenData.refresh_token,
      storeData.smaregi_client_id,
      storeData.smaregi_client_secret,
      process.env.NODE_ENV === 'development'
    );
    
    // 新しいトークンを保存
    await saveOAuthToken(storeId, newTokenData);
    
    return newTokenData.access_token;
  } catch (error) {
    console.error('トークン更新エラー:', error);
    return null;
  }
}

/**
 * 店舗のOAuth認証状態を確認
 */
export async function checkSmaregiOAuthStatus(storeId: string): Promise<{
  isAuthenticated: boolean;
  expiresAt?: string;
  scope?: string;
}> {
  const supabase = await createServerSupabaseClient();
  
  const { data: tokenData, error } = await supabase
    .from('smaregi_oauth_tokens')
    .select('expires_at, scope')
    .eq('store_id', storeId)
    .single();
  
  if (error || !tokenData) {
    return { isAuthenticated: false };
  }
  
  const now = new Date();
  const expiresAt = new Date(tokenData.expires_at);
  
  return {
    isAuthenticated: expiresAt > now,
    expiresAt: tokenData.expires_at,
    scope: tokenData.scope,
  };
}

/**
 * 店舗のOAuth認証を解除
 */
export async function revokeSmaregiOAuth(storeId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  
  const { error } = await supabase
    .from('smaregi_oauth_tokens')
    .delete()
    .eq('store_id', storeId);
  
  if (error) {
    console.error('OAuth認証解除エラー:', error);
    throw new Error('認証解除に失敗しました');
  }
}

/**
 * 店舗IDから契約IDを取得
 */
export async function getContractIdFromStore(storeId: string): Promise<string> {
  const supabase = await createServerSupabaseClient();
  
  const { data: storeData, error } = await supabase
    .from('stores')
    .select('smaregi_contract_id')
    .eq('store_id', storeId)
    .single();
  
  if (error || !storeData?.smaregi_contract_id) {
    throw new Error('スマレジ契約IDが設定されていません');
  }
  
  return storeData.smaregi_contract_id;
}

/**
 * OAuth認証を使用してスマレジAPIを呼び出す汎用関数
 */
export async function callSmaregiAPI(
  storeId: string,
  endpoint: string,
  options: RequestInit = {},
  isSandbox: boolean = process.env.NODE_ENV === 'development'
): Promise<any> {
  // 有効なアクセストークンを取得
  const accessToken = await getValidSmaregiAccessToken(storeId);
  if (!accessToken) {
    throw new Error('OAuth認証が必要です。店舗設定でスマレジとの連携を行ってください。');
  }
  
  // 契約IDを取得
  const contractId = await getContractIdFromStore(storeId);
  
  // APIエンドポイントURLを構築
  const baseUrl = isSandbox ? 'https://api.smaregi.dev' : 'https://api.smaregi.jp';
  const url = `${baseUrl}/${contractId}${endpoint}`;
  
  // リクエストオプションを設定
  const requestOptions: RequestInit = {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };
  
  try {
    const response = await fetch(url, requestOptions);
    
    if (!response.ok) {
      // 401エラーの場合、トークンが無効になっている可能性があるため再試行
      if (response.status === 401) {
        console.log('401エラー検出、トークン再取得を試行します');
        
        // トークンを強制的に再取得（リフレッシュ）
        const newAccessToken = await getValidSmaregiAccessToken(storeId);
        if (newAccessToken && newAccessToken !== accessToken) {
          // 新しいトークンでリトライ
          const retryOptions: RequestInit = {
            ...requestOptions,
            headers: {
              ...requestOptions.headers,
              'Authorization': `Bearer ${newAccessToken}`,
            },
          };
          
          const retryResponse = await fetch(url, retryOptions);
          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            throw new Error(`スマレジAPI呼び出しエラー (${retryResponse.status}): ${errorText}`);
          }
          
          return await retryResponse.json();
        }
      }
      
      const errorText = await response.text();
      throw new Error(`スマレジAPI呼び出しエラー (${response.status}): ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('スマレジAPI呼び出しエラー:', error);
    throw error;
  }
}
