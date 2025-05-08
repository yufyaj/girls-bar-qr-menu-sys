import axios from 'axios';

/**
 * スマレジAPIのアクセストークンを取得する
 * @param clientId クライアントID
 * @param clientSecret クライアントシークレット
 * @param contractId 契約ID
 * @param isSandbox サンドボックス環境かどうか
 * @returns アクセストークン
 */
export async function getSmaregiAccessToken(
  clientId: string,
  clientSecret: string,
  contractId: string,
  isSandbox: boolean = true
): Promise<string> {
  const baseUrl = isSandbox ? 'https://id.smaregi.dev' : 'https://id.smaregi.jp';
  const url = `${baseUrl}/app/${contractId}/token`;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await axios.post(
      url,
      new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'pos.products:read',
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
 * @param accessToken アクセストークン
 * @param contractId 契約ID
 * @param isSandbox サンドボックス環境かどうか
 * @returns 商品情報の配列
 */
export async function fetchSmaregiProducts(
  accessToken: string,
  contractId: string,
  isSandbox: boolean = true
): Promise<any[]> {
  const baseUrl = isSandbox ? 'https://api.smaregi.dev' : 'https://api.smaregi.jp';
  const url = `${baseUrl}/${contractId}/pos/products`;
  const limit = 1000; // 1回のリクエストで取得する最大件数（APIの上限は1000）
  let page = 1;
  let allProducts: any[] = [];
  let hasMore = true;

  try {
    // 全ての商品を取得するまでループ
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
      allProducts = [...allProducts, ...products];

      // 取得件数が指定した上限より少ない場合、全ての商品を取得したと判断
      if (products.length < limit) {
        hasMore = false;
      } else {
        // 次のページへ
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
 * @param accessToken アクセストークン
 * @param contractId 契約ID
 * @param isSandbox サンドボックス環境かどうか
 * @returns 商品画像情報の配列
 */
export async function fetchSmaregiAllProductImages(
  accessToken: string,
  contractId: string,
  isSandbox: boolean = true
): Promise<any[]> {
  const baseUrl = isSandbox ? 'https://api.smaregi.dev' : 'https://api.smaregi.jp';
  const url = `${baseUrl}/${contractId}/pos/products/images`;
  const limit = 1000; // 1回のリクエストで取得する最大件数（APIの上限は1000）
  let page = 1;
  let allProductImages: any[] = [];
  let hasMore = true;

  try {
    // 全ての商品画像を取得するまでループ
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

      // 取得件数が指定した上限より少ない場合、全ての商品画像を取得したと判断
      if (productImages.length < limit) {
        hasMore = false;
      } else {
        // 次のページへ
        page++;
      }
    }

    // 画像取得結果のサマリーをログ出力
    const imageCount = allProductImages.length;
    const imagesWithUrl = allProductImages.filter(img => img.url || img.imageUrl).length;
    console.log(`スマレジ商品画像取得結果: 合計${imageCount}件、URL有り${imagesWithUrl}件`);

    // 最初の5件の画像情報をサンプルとしてログ出力
    if (allProductImages.length > 0) {
      const sampleImages = allProductImages.slice(0, 5);
      console.log('画像サンプル:', JSON.stringify(sampleImages));
    }

    return allProductImages;
  } catch (error) {
    console.error('スマレジ全商品画像取得エラー:', error);

    // エラーレスポンスの詳細情報を出力
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response: { status: number; statusText: string; data: any } };
      console.error('エラーレスポンス:', {
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
 * スマレジAPIから部門情報を取得する（ページネーション対応）
 * @param accessToken アクセストークン
 * @param contractId 契約ID
 * @param isSandbox サンドボックス環境かどうか
 * @returns 部門情報の配列
 */
export async function fetchSmaregiCategories(
  accessToken: string,
  contractId: string,
  isSandbox: boolean = true
): Promise<any[]> {
  const baseUrl = isSandbox ? 'https://api.smaregi.dev' : 'https://api.smaregi.jp';
  const url = `${baseUrl}/${contractId}/pos/categories`;
  const limit = 1000; // 1回のリクエストで取得する最大件数（APIの上限は1000）
  let page = 1;
  let allCategories: any[] = [];
  let hasMore = true;

  try {
    // 全ての部門を取得するまでループ
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

      // 取得件数が指定した上限より少ない場合、全ての部門を取得したと判断
      if (categories.length < limit) {
        hasMore = false;
      } else {
        // 次のページへ
        page++;
      }
    }


    return allCategories;
  } catch (error) {
    console.error('スマレジ部門情報取得エラー:', error);
    throw new Error('スマレジからの部門情報取得に失敗しました');
  }
}
