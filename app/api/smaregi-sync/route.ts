import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase';
import { getUserRoleInStore } from '@/lib/auth';
import { getSmaregiAccessToken, fetchSmaregiProducts, fetchSmaregiCategories, fetchSmaregiAllProductImages } from '@/lib/smaregi';

// スマレジAPIから商品情報を取得して整形する関数
async function getFormattedSmaregiProducts(storeId: string) {
  try {
    // OAuth認証を使用してスマレジAPIから商品情報と部門情報を取得
    const products = await fetchSmaregiProducts(storeId);
    const categories = await fetchSmaregiCategories(storeId);

    // スマレジAPIから全商品画像情報を一括取得
    const allProductImages = await fetchSmaregiAllProductImages(storeId);

    // 商品IDと画像URLのマッピングを作成
    const productImageMap = new Map();
    allProductImages.forEach((image: any) => {
      // APIレスポンスには imageUrl または url のどちらかで画像URLが含まれる可能性がある
      const imageUrl = image.imageUrl || image.url;
      if (image.productId && imageUrl) {
        // 同じ商品IDに複数の画像がある場合は上書きされるが、
        // 今回は最初の画像を使用するので問題ない
        productImageMap.set(image.productId, imageUrl);
      }
    });

    // 画像マッピング結果をログ出力
    console.log(`商品画像マッピング作成結果: ${productImageMap.size}件の商品に画像URLをマッピング`);

    // 部門IDと部門名のマッピングを作成
    const categoryMap = new Map();
    categories.forEach((category: any) => {
      categoryMap.set(category.categoryId, category.categoryName);
    });

    // スマレジの部門情報を返す
    const smaregiCategories = categories.map((category: any) => ({
      categoryId: category.categoryId,
      name: category.categoryName,
    }));

    // 商品情報を整形（画像情報を含む）
    const formattedProducts = [];

    // 各商品の情報を整形
    for (const product of products) {
      const categoryName = categoryMap.get(product.categoryId) || null;
      const categoryId = product.categoryId || null;

      // 商品画像を取得
      let imageUrl = product.url || null;

      // 商品画像マッピングから画像URLを取得
      if (product.productId && productImageMap.has(product.productId)) {
        imageUrl = productImageMap.get(product.productId);
      }

      formattedProducts.push({
        productId: product.productId,
        name: product.productName,
        price: parseInt(product.price, 10),
        categoryName: categoryName,
        categoryId: categoryId,
        description: product.description || null,
        imageUrl: imageUrl,
      });
    }

    return {
      products: formattedProducts,
      categories: smaregiCategories
    };
  } catch (error) {
    console.error('スマレジ商品情報取得エラー:', error);
    throw new Error('スマレジからの商品情報取得に失敗しました');
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const storeId = cookieStore.get('store-id')?.value;

    if (!storeId) {
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }

    // APIからユーザー情報を取得
    const userResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/auth/user`, {
      headers: {
        Cookie: request.headers.get('cookie') || ''
      }
    });

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: '認証されていません' },
        { status: 401 }
      );
    }

    const { user } = await userResponse.json();

    // 管理者でなければエラー
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // 店舗情報を取得
    const { data: store } = await supabase
      .from('stores')
      .select('enable_smaregi_integration, smaregi_client_id, smaregi_client_secret, smaregi_contract_id')
      .eq('store_id', storeId)
      .single();

    if (!store) {
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 404 }
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

    // 契約IDを店舗設定から取得
    const contractId = store.smaregi_contract_id;

    // スマレジAPIからメニュー情報を取得（OAuth認証を使用）
    const smaregiData = await getFormattedSmaregiProducts(storeId);

    const { products: smaregiProducts, categories: smaregiCategories } = smaregiData;

    // 1. カテゴリを同期
    // 既存のカテゴリを取得
    const { data: existingCategories } = await supabase
      .from('menu_categories')
      .select('category_id, name, smaregi_category_id')
      .eq('store_id', storeId);

    // スマレジカテゴリIDでマッピング（優先）とカテゴリ名でマッピング（後方互換性）
    const existingCategoryMap = new Map();
    const existingCategoryNameMap = new Map();
    existingCategories?.forEach(category => {
      if (category.smaregi_category_id) {
        existingCategoryMap.set(category.smaregi_category_id, category.category_id);
      }
      existingCategoryNameMap.set(category.name, category.category_id);
    });

    // スマレジから取得したカテゴリを登録
    const categoriesToUpsert = [];
    const categoryIdMap = new Map(); // スマレジカテゴリIDとDBカテゴリIDのマッピング

    for (const category of smaregiCategories) {
      if (category.name && category.categoryId) {
        // 既にスマレジカテゴリIDが登録されている場合はそのIDを使用
        if (existingCategoryMap.has(category.categoryId)) {
          categoryIdMap.set(category.categoryId, existingCategoryMap.get(category.categoryId));

          // カテゴリ名が変更されている場合は更新
          const existingCategoryId = existingCategoryMap.get(category.categoryId);
          const existingCategory = existingCategories?.find(c => c.category_id === existingCategoryId);
          if (existingCategory && existingCategory.name !== category.name) {
            await supabase
              .from('menu_categories')
              .update({ name: category.name })
              .eq('category_id', existingCategoryId);
          }
        }
        // 同じ名前のカテゴリが存在する場合は、スマレジカテゴリIDを更新
        else if (existingCategoryNameMap.has(category.name)) {
          const existingCategoryId = existingCategoryNameMap.get(category.name);
          await supabase
            .from('menu_categories')
            .update({ smaregi_category_id: category.categoryId })
            .eq('category_id', existingCategoryId);

          categoryIdMap.set(category.categoryId, existingCategoryId);
        }
        // 新規カテゴリの場合は追加
        else {
          const { data: newCategory, error } = await supabase
            .from('menu_categories')
            .insert({
              store_id: storeId,
              name: category.name,
              smaregi_category_id: category.categoryId,
              display_order: categoriesToUpsert.length + 1
            })
            .select()
            .single();

          if (error) {
            console.error('カテゴリ作成エラー:', error);
            // エラーがあっても処理は続行
          } else if (newCategory) {
            categoryIdMap.set(category.categoryId, newCategory.category_id);
          }
        }
      }
    }

    // 2. メニューを同期
    // 一括更新用のデータを準備
    const menusToUpsert = smaregiProducts.map(product => {
      // カテゴリIDをマッピング
      const dbCategoryId = product.categoryId ? categoryIdMap.get(product.categoryId) : null;

      return {
        store_id: storeId,
        product_id: product.productId,
        name: product.name,
        description: product.description || null,
        price: product.price,
        image_url: product.imageUrl || null,
        category: product.categoryName || null, // 後方互換性のために残す
        category_id: dbCategoryId,
        is_available: true,
      };
    });

    // 画像URL設定結果をログ出力
    const menusWithImage = menusToUpsert.filter(menu => menu.image_url).length;
    console.log(`メニュー画像設定結果: 合計${menusToUpsert.length}件中、画像有り${menusWithImage}件`);

    // 画像URLが設定された最初の5件をサンプルとしてログ出力
    const menuSamples = menusToUpsert.filter(menu => menu.image_url).slice(0, 5);
    if (menuSamples.length > 0) {
      console.log('画像URL設定サンプル:');
      menuSamples.forEach(menu => {
        console.log(`- ${menu.name}: ${menu.image_url}`);
      });
    }

    // メニューを一括更新（upsert）
    const { error: upsertError } = await supabase
      .from('menus')
      .upsert(menusToUpsert, {
        onConflict: 'store_id,product_id',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error('メニュー一括更新エラー:', upsertError);
      return NextResponse.json(
        { error: 'メニューの一括更新に失敗しました' },
        { status: 500 }
      );
    }

    // 3. スマレジに存在しないメニューを削除
    // スマレジから取得した商品IDのリストを作成
    const smaregiProductIds = smaregiProducts.map(product => product.productId);

    // 現在の店舗のメニュー一覧を取得
    const { data: existingMenus, error: menusError } = await supabase
      .from('menus')
      .select('menu_id, product_id')
      .eq('store_id', storeId);

    if (menusError) {
      console.error('メニュー一覧取得エラー:', menusError);
      return NextResponse.json(
        { error: 'メニュー一覧の取得に失敗しました' },
        { status: 500 }
      );
    }

    // スマレジに存在しないメニューを特定
    const menusToDelete = existingMenus.filter(menu => !smaregiProductIds.includes(menu.product_id));

    // 削除対象のメニューIDリストを作成
    const menuIdsToDelete = menusToDelete.map(menu => menu.menu_id);

    let deletedCount = 0;

    // 削除対象のメニューがある場合は削除を実行
    if (menuIdsToDelete.length > 0) {
      const { error: deleteError, count } = await supabase
        .from('menus')
        .delete()
        .in('menu_id', menuIdsToDelete);

      if (deleteError) {
        console.error('メニュー削除エラー:', deleteError);
        // 削除に失敗しても同期自体は成功とみなす
      } else {
        deletedCount = count || 0;
        console.log(`${deletedCount}件のメニューを削除しました`);
      }
    }

    return NextResponse.json({
      success: true,
      count: menusToUpsert.length,
      deletedCount: deletedCount,
      message: `${menusToUpsert.length}件のメニューを同期し、${deletedCount}件のメニューを削除しました`,
    });
  } catch (error) {
    console.error('スマレジ同期エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
