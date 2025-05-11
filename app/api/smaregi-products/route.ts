import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase';
import { getSmaregiAccessToken, fetchSmaregiProducts } from '@/lib/smaregi';

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

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // 店舗情報を取得
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('enable_smaregi_integration, smaregi_client_id, smaregi_client_secret, smaregi_contract_id')
      .eq('store_id', storeId)
      .single();

    if (storeError) {
      console.error('店舗情報取得エラー:', storeError);
      return NextResponse.json(
        { error: '店舗情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    // スマレジ連携が無効の場合はエラー
    if (!store.enable_smaregi_integration) {
      return NextResponse.json(
        { error: 'スマレジ連携が無効になっています' },
        { status: 403 }
      );
    }

    // スマレジAPIの認証情報が設定されていない場合はエラー
    if (!store.smaregi_client_id || !store.smaregi_client_secret || !store.smaregi_contract_id) {
      return NextResponse.json(
        { error: 'スマレジAPIの認証情報が設定されていません' },
        { status: 400 }
      );
    }

    // スマレジAPIのアクセストークンを取得
    const accessToken = await getSmaregiAccessToken(
      store.smaregi_client_id,
      store.smaregi_client_secret,
      store.smaregi_contract_id
    );

    // スマレジAPIから商品情報を取得
    const products = await fetchSmaregiProducts(accessToken, store.smaregi_contract_id);

    // 商品情報を整形
    const formattedProducts = products.map(product => ({
      productId: product.productId,
      name: product.productName,
      price: parseInt(product.price, 10)
    }));

    return NextResponse.json({
      products: formattedProducts
    });
  } catch (error) {
    console.error('スマレジ商品取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
