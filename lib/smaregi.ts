import axios from 'axios';
import { getValidSmaregiAccessToken } from './smaregi-oauth';

/**
 * スマレジAPIのアクセストークンを取得する（OAuth認証優先）
 * @param storeId 店舗ID（OAuth認証用）
 * @param clientId クライアントID（フォールバック用）
 * @param clientSecret クライアントシークレット（フォールバック用）
 * @param contractId 契約ID
 * @param scope APIスコープ（デフォルト: 'pos.products:read pos.transactions:write'）
 * @param isSandbox サンドボックス環境かどうか
 * @returns アクセストークン
 */
export async function getSmaregiAccessToken(
  storeIdOrClientId: string,
  clientSecretOrContractId?: string,
  contractIdOrScope?: string,
  scope: string = 'pos.products:read pos.transactions:write',
  isSandbox: boolean = true
): Promise<string> {
  // 新しい呼び出し方法（OAuth認証）: getSmaregiAccessToken(storeId)
  if (!clientSecretOrContractId) {
    const storeId = storeIdOrClientId;
    const accessToken = await getValidSmaregiAccessToken(storeId);
    if (accessToken) {
      return accessToken;
    }
    throw new Error('OAuth認証が必要です。店舗設定でスマレジとの連携を行ってください。');
  }

  // 従来の呼び出し方法（Client Credentials）: getSmaregiAccessToken(clientId, clientSecret, contractId, scope, isSandbox)
  const clientId = storeIdOrClientId;
  const clientSecret = clientSecretOrContractId;
  const contractId = contractIdOrScope || '';
  
  const baseUrl = isSandbox ? 'https://id.smaregi.dev' : 'https://id.smaregi.jp';
  const url = `${baseUrl}/app/${contractId}/token`;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    console.log("baseUrl="+baseUrl)
    const response = await axios.post(
      url,
      new URLSearchParams({
        grant_type: 'client_credentials',
        scope: scope,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`,
        },
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('スマレジアクセストークン取得エラー:', error);
    throw new Error('スマレジアクセストークンの取得に失敗しました');
  }
}

/**
 * スマレジAPIから商品情報を取得する（ページネーション対応）
 * @param storeIdOrAccessToken 店舗ID（OAuth認証）またはアクセストークン（従来方式）
 * @param contractIdOrIsSandbox 契約ID（従来方式）またはサンドボックス環境フラグ（OAuth認証）
 * @param isSandbox サンドボックス環境かどうか（従来方式のみ）
 * @returns 商品情報の配列
 */
export async function fetchSmaregiProducts(
  storeIdOrAccessToken: string,
  contractIdOrIsSandbox?: string | boolean,
  isSandbox: boolean = false
): Promise<any[]> {
  // OAuth認証を使用する場合（新しい方法）
  if (typeof contractIdOrIsSandbox === 'boolean' || contractIdOrIsSandbox === undefined) {
    const storeId = storeIdOrAccessToken;
    const useSandbox = typeof contractIdOrIsSandbox === 'boolean' ? contractIdOrIsSandbox : (process.env.NODE_ENV === 'development');
    
    const { callSmaregiAPI } = await import('./smaregi-oauth');
    
    const limit = 1000;
    let page = 1;
    let allProducts: any[] = [];
    let hasMore = true;

    try {
      while (hasMore) {
        const products = await callSmaregiAPI(
          storeId,
          `/pos/products?limit=${limit}&page=${page}`,
          { method: 'GET' },
          useSandbox
        );

        // 最初のページの最初の商品のデータ構造をログ出力（デバッグ用）
        if (page === 1 && products.length > 0) {
          console.log('スマレジ商品情報の構造サンプル:', JSON.stringify(products[0], null, 2));
        }

        allProducts = [...allProducts, ...products];

        // 取得件数が指定した上限より少ない場合、全ての商品を取得したと判断
        if (products.length < limit) {
          hasMore = false;
        } else {
          page++;
        }
      }

      return allProducts;
    } catch (error) {
      console.error('スマレジ商品情報取得エラー:', error);
      throw new Error('スマレジからの商品情報取得に失敗しました');
    }
  }

  // 従来の方法（Client Credentials）
  const accessToken = storeIdOrAccessToken;
  const contractId = contractIdOrIsSandbox as string;
  
  const baseUrl = isSandbox ? 'https://api.smaregi.dev' : 'https://api.smaregi.jp';
  const url = `${baseUrl}/${contractId}/pos/products`;
  const limit = 1000;
  let page = 1;
  let allProducts: any[] = [];
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          limit,
          page
        }
      });

      const products = response.data;

      if (page === 1 && products.length > 0) {
        console.log('スマレジ商品情報の構造サンプル:', JSON.stringify(products[0], null, 2));
      }

      allProducts = [...allProducts, ...products];

      if (products.length < limit) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return allProducts;
  } catch (error) {
    console.error('スマレジ商品情報取得エラー:', error);
    throw new Error('スマレジからの商品情報取得に失敗しました');
  }
}

/**
 * スマレジAPIから商品画像情報を取得する（個別商品）
 * @param accessToken アクセストークン
 * @param contractId 契約ID
 * @param productId 商品ID
 * @param isSandbox サンドボックス環境かどうか
 * @returns 商品画像情報の配列
 * @deprecated 代わりに fetchSmaregiAllProductImages を使用してください
 */
export async function fetchSmaregiProductImages(
  accessToken: string,
  contractId: string,
  productId: string,
  isSandbox: boolean = true
): Promise<any[]> {
  const baseUrl = isSandbox ? 'https://api.smaregi.dev' : 'https://api.smaregi.jp';
  const url = `${baseUrl}/${contractId}/pos/products/${productId}/images`;

  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error(`スマレジ商品画像取得エラー (productId: ${productId}):`, error);

    // エラーレスポンスの詳細情報を出力
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response: { status: number; statusText: string; data: any } };
      console.error(`エラーレスポンス (productId: ${productId}):`, {
        status: axiosError.response.status,
        statusText: axiosError.response.statusText,
        data: axiosError.response.data
      });
    }

    // エラーが発生しても処理を続行するため、空の配列を返す
    return [];
  }
}

/**
 * スマレジAPIから全商品画像情報を一括取得する
 * @param storeIdOrAccessToken 店舗ID（OAuth認証）またはアクセストークン（従来方式）
 * @param contractIdOrIsSandbox 契約ID（従来方式）またはサンドボックス環境フラグ（OAuth認証）
 * @param isSandbox サンドボックス環境かどうか（従来方式のみ）
 * @returns 商品画像情報の配列
 */
export async function fetchSmaregiAllProductImages(
  storeIdOrAccessToken: string,
  contractIdOrIsSandbox?: string | boolean,
  isSandbox: boolean = true
): Promise<any[]> {
  // OAuth認証を使用する場合（新しい方法）
  if (typeof contractIdOrIsSandbox === 'boolean' || contractIdOrIsSandbox === undefined) {
    const storeId = storeIdOrAccessToken;
    const useSandbox = typeof contractIdOrIsSandbox === 'boolean' ? contractIdOrIsSandbox : (process.env.NODE_ENV === 'development');
    
    const { callSmaregiAPI } = await import('./smaregi-oauth');
    
    const limit = 1000;
    let page = 1;
    let allProductImages: any[] = [];
    let hasMore = true;

    try {
      while (hasMore) {
        const productImages = await callSmaregiAPI(
          storeId,
          `/pos/products/images?limit=${limit}&page=${page}`,
          { method: 'GET' },
          useSandbox
        );

        allProductImages = [...allProductImages, ...productImages];

        if (productImages.length < limit) {
          hasMore = false;
        } else {
          page++;
        }
      }

      // 画像取得結果のサマリーをログ出力
      const imageCount = allProductImages.length;
      const imagesWithUrl = allProductImages.filter(img => img.url || img.imageUrl).length;
      console.log(`スマレジ商品画像取得結果: 合計${imageCount}件、URL有り${imagesWithUrl}件`);

      if (allProductImages.length > 0) {
        const sampleImages = allProductImages.slice(0, 5);
        console.log('画像サンプル:', JSON.stringify(sampleImages));
      }

      return allProductImages;
    } catch (error) {
      console.error('スマレジ全商品画像取得エラー:', error);
      return [];
    }
  }

  // 従来の方法（Client Credentials）
  const accessToken = storeIdOrAccessToken;
  const contractId = contractIdOrIsSandbox as string;
  
  const baseUrl = isSandbox ? 'https://api.smaregi.dev' : 'https://api.smaregi.jp';
  const url = `${baseUrl}/${contractId}/pos/products/images`;
  const limit = 1000;
  let page = 1;
  let allProductImages: any[] = [];
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          limit,
          page
        }
      });

      const productImages = response.data;
      allProductImages = [...allProductImages, ...productImages];

      if (productImages.length < limit) {
        hasMore = false;
      } else {
        page++;
      }
    }

    const imageCount = allProductImages.length;
    const imagesWithUrl = allProductImages.filter(img => img.url || img.imageUrl).length;
    console.log(`スマレジ商品画像取得結果: 合計${imageCount}件、URL有り${imagesWithUrl}件`);

    if (allProductImages.length > 0) {
      const sampleImages = allProductImages.slice(0, 5);
      console.log('画像サンプル:', JSON.stringify(sampleImages));
    }

    return allProductImages;
  } catch (error) {
    console.error('スマレジ全商品画像取得エラー:', error);

    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response: { status: number; statusText: string; data: any } };
      console.error('エラーレスポンス:', {
        status: axiosError.response.status,
        statusText: axiosError.response.statusText,
        data: axiosError.response.data
      });
    }

    return [];
  }
}

/**
 * スマレジAPIから部門情報を取得する（ページネーション対応）
 * @param storeIdOrAccessToken 店舗ID（OAuth認証）またはアクセストークン（従来方式）
 * @param contractIdOrIsSandbox 契約ID（従来方式）またはサンドボックス環境フラグ（OAuth認証）
 * @param isSandbox サンドボックス環境かどうか（従来方式のみ）
 * @returns 部門情報の配列
 */
export async function fetchSmaregiCategories(
  storeIdOrAccessToken: string,
  contractIdOrIsSandbox?: string | boolean,
  isSandbox: boolean = true
): Promise<any[]> {
  // OAuth認証を使用する場合（新しい方法）
  if (typeof contractIdOrIsSandbox === 'boolean' || contractIdOrIsSandbox === undefined) {
    const storeId = storeIdOrAccessToken;
    const useSandbox = typeof contractIdOrIsSandbox === 'boolean' ? contractIdOrIsSandbox : (process.env.NODE_ENV === 'development');
    
    const { callSmaregiAPI } = await import('./smaregi-oauth');
    
    const limit = 1000;
    let page = 1;
    let allCategories: any[] = [];
    let hasMore = true;

    try {
      while (hasMore) {
        const categories = await callSmaregiAPI(
          storeId,
          `/pos/categories?limit=${limit}&page=${page}`,
          { method: 'GET' },
          useSandbox
        );

        allCategories = [...allCategories, ...categories];

        if (categories.length < limit) {
          hasMore = false;
        } else {
          page++;
        }
      }

      return allCategories;
    } catch (error) {
      console.error('スマレジ部門情報取得エラー:', error);
      throw new Error('スマレジからの部門情報取得に失敗しました');
    }
  }

  // 従来の方法（Client Credentials）
  const accessToken = storeIdOrAccessToken;
  const contractId = contractIdOrIsSandbox as string;
  
  const baseUrl = isSandbox ? 'https://api.smaregi.dev' : 'https://api.smaregi.jp';
  const url = `${baseUrl}/${contractId}/pos/categories`;
  const limit = 1000;
  let page = 1;
  let allCategories: any[] = [];
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          limit,
          page
        }
      });

      const categories = response.data;
      allCategories = [...allCategories, ...categories];

      if (categories.length < limit) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return allCategories;
  } catch (error) {
    console.error('スマレジ部門情報取得エラー:', error);
    throw new Error('スマレジからの部門情報取得に失敗しました');
  }
}

/**
 * スマレジAPIに取引データを登録する
 * @param storeIdOrAccessToken 店舗ID（OAuth認証）またはアクセストークン（従来方式）
 * @param transactionDataOrContractId 取引データ（OAuth認証）または契約ID（従来方式）
 * @param transactionDataOrIsSandbox 取引データ（従来方式）またはサンドボックス環境フラグ（OAuth認証）
 * @param isSandbox サンドボックス環境かどうか（従来方式のみ）
 * @returns 登録された取引情報
 */
export async function registerSmaregiTransaction(
  storeIdOrAccessToken: string,
  transactionDataOrContractId: any,
  transactionDataOrIsSandbox?: any | boolean,
  isSandbox: boolean = true
): Promise<any> {
  // OAuth認証を使用する場合（新しい方法）
  if (typeof transactionDataOrIsSandbox === 'boolean' || transactionDataOrIsSandbox === undefined) {
    const storeId = storeIdOrAccessToken;
    const transactionData = transactionDataOrContractId;
    const useSandbox = typeof transactionDataOrIsSandbox === 'boolean' ? transactionDataOrIsSandbox : (process.env.NODE_ENV === 'development');
    
    const { callSmaregiAPI } = await import('./smaregi-oauth');
    
    try {
      const result = await callSmaregiAPI(
        storeId,
        '/pos/transactions',
        {
          method: 'POST',
          body: JSON.stringify(transactionData),
        },
        useSandbox
      );

      return result;
    } catch (error) {
      console.error('スマレジ取引登録エラー:', error);
      console.error('リクエストデータ:', JSON.stringify(transactionData, null, 2));
      throw new Error('スマレジへの取引登録に失敗しました');
    }
  }

  // 従来の方法（Client Credentials）
  const accessToken = storeIdOrAccessToken;
  const contractId = transactionDataOrContractId;
  const transactionData = transactionDataOrIsSandbox;
  
  const baseUrl = isSandbox ? 'https://api.smaregi.dev' : 'https://api.smaregi.jp';
  const url = `${baseUrl}/${contractId}/pos/transactions`;

  try {
    const response = await axios.post(
      url,
      transactionData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('スマレジ取引登録エラー:', error);

    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response: { status: number; statusText: string; data: any } };
      console.error('エラーレスポンス:', {
        status: axiosError.response.status,
        statusText: axiosError.response.statusText,
        data: axiosError.response.data
      });

      console.error('リクエストデータ:', JSON.stringify(transactionData, null, 2));
    }

    throw new Error('スマレジへの取引登録に失敗しました');
  }
}
