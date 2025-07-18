import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServerComponentClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const category = searchParams.get('category');

    // 認証用クライアント（Cookieベース）
    const authClient = await createServerComponentClient();

    // ユーザー情報を取得
    const { data: { user } } = await authClient.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: '認証されていません' },
        { status: 401 }
      );
    }

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // Cookieからログイン中の店舗IDを取得
    const cookieStore = await cookies();
    const activeStoreId = cookieStore.get('store-id')?.value;

    if (!activeStoreId) {
      return NextResponse.json(
        { error: 'ログイン中の店舗情報が見つかりません' },
        { status: 404 }
      );
    }

    // ユーザーの店舗情報を取得（ログイン中の店舗IDも条件に追加）
    const { data: storeUser, error: storeUserError } = await supabase
      .from('store_users')
      .select('store_id')
      .eq('user_id', user.id)
      .eq('store_id', activeStoreId)
      .single();

    if (storeUserError || !storeUser) {
      return NextResponse.json(
        { error: 'ユーザーの店舗情報が見つかりません' },
        { status: 404 }
      );
    }

    const storeId = storeUser.store_id;

    // 日付のフォーマットチェック（YYYY-MM-DD）
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if ((startDate && !dateRegex.test(startDate)) || (endDate && !dateRegex.test(endDate))) {
      return NextResponse.json(
        { error: '日付フォーマットが不正です（YYYY-MM-DD）' },
        { status: 400 }
      );
    }

    // 店舗の営業時間を取得
    let openTime = '18:00';
    let closeTime = '12:00';
    
    try {
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('open_time, close_time')
        .eq('store_id', storeId)
        .single();

      if (!storeError && storeData) {
        openTime = storeData.open_time || '18:00';
        closeTime = storeData.close_time || '12:00';
      }
    } catch (err) {
      // エラーの場合はデフォルト値を使用
    }

    const openHour = parseInt(openTime.split(':')[0], 10);
    const closeHour = parseInt(closeTime.split(':')[0], 10);
    const isOvernightOperation = closeHour < openHour;

    // 基本的なクエリ - 会計履歴IDの取得
    let historyQuery = supabase
      .from('checkout_history')
      .select('history_id, store_id')
      .eq('store_id', storeId);

    // 日付フィルタの適用（営業時間を考慮）
    if (startDate) {
      if (isOvernightOperation) {
        // 翌日営業の場合：開始日の開店時間から
        historyQuery = historyQuery.gte('checkout_at', `${startDate}T${openTime}+09:00`);
      } else {
        // 同日営業の場合：開始日の開店時間から
        historyQuery = historyQuery.gte('checkout_at', `${startDate}T${openTime}+09:00`);
      }
    }

    if (endDate) {
      if (isOvernightOperation) {
        // 翌日営業の場合：終了日の翌日の閉店時間まで
        const [year, month, day] = endDate.split('-').map(Number);
        const nextDate = new Date(year, month - 1, day + 1);
        const nextYear = nextDate.getFullYear();
        const nextMonth = String(nextDate.getMonth() + 1).padStart(2, '0');
        const nextDay = String(nextDate.getDate()).padStart(2, '0');
        const nextDateStr = `${nextYear}-${nextMonth}-${nextDay}`;
        historyQuery = historyQuery.lte('checkout_at', `${nextDateStr}T${closeTime}+09:00`);
      } else {
        // 同日営業の場合：終了日の閉店時間まで
        historyQuery = historyQuery.lte('checkout_at', `${endDate}T${closeTime}+09:00`);
      }
    }

    // 会計履歴IDを取得
    const { data: historyData, error: historyError } = await historyQuery;

    if (historyError) {
      console.error('会計履歴取得エラー:', historyError);
      return NextResponse.json(
        { error: '会計履歴の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 会計履歴がない場合は空の結果を返す
    if (!historyData.length) {
      return NextResponse.json({
        data: [],
        summary: {
          total_sales: 0,
          total_quantity: 0
        }
      });
    }

    // 会計履歴IDの配列を作成
    const historyIds = historyData.map(history => history.history_id);

    // 注文アイテムのクエリ
    let itemsQuery = supabase
      .from('checkout_order_items')
      .select(`
        product_id,
        product_name,
        price,
        quantity,
        subtotal
      `)
      .in('history_id', historyIds);

    // カテゴリーフィルタの適用
    // カテゴリー情報が注文アイテムに直接ないため、別途メニューテーブルから取得する必要がある
    const { data: items, error: itemsError } = await itemsQuery;

    if (itemsError) {
      console.error('注文アイテム取得エラー:', itemsError);
      return NextResponse.json(
        { error: '注文アイテムの取得に失敗しました' },
        { status: 500 }
      );
    }

    // メニュー情報（カテゴリー等）を取得
    const { data: menuItems, error: menuError } = await supabase
      .from('menus')
      .select('product_id, category')
      .eq('store_id', storeId);

    if (menuError) {
      console.error('メニュー情報取得エラー:', menuError);
      // エラーがあっても処理を続行（カテゴリー情報がない場合もある）
    }

    // 商品IDとカテゴリーのマップを作成
    const categoryMap: Record<string, string> = {};
    if (menuItems) {
      menuItems.forEach(menu => {
        if (menu.product_id) {
          categoryMap[menu.product_id] = menu.category || '未分類';
        }
      });
    }

    // 商品ごとにグループ化
    interface MenuSales {
      product_id: string;
      product_name: string;
      category: string;
      quantity: number;
      total_sales: number;
      percentage: number;
    }

    const menuData: Record<string, MenuSales> = {};

    // 商品ごとの売上をグループ化
    items.forEach(item => {
      const productKey = `${item.product_id}:${item.product_name}`;
      
      if (!menuData[productKey]) {
        menuData[productKey] = {
          product_id: item.product_id,
          product_name: item.product_name,
          category: categoryMap[item.product_id] || '未分類',
          quantity: 0,
          total_sales: 0,
          percentage: 0
        };
      }
      
      menuData[productKey].quantity += item.quantity;
      menuData[productKey].total_sales += item.subtotal;
    });

    // カテゴリーでフィルタリング
    let filteredMenu = Object.values(menuData);
    if (category) {
      filteredMenu = filteredMenu.filter(item => item.category === category);
    }

    // 合計売上を計算
    const totalSales = filteredMenu.reduce((sum, item) => sum + item.total_sales, 0);
    const totalQuantity = filteredMenu.reduce((sum, item) => sum + item.quantity, 0);

    // 構成比を計算
    filteredMenu.forEach(item => {
      item.percentage = totalSales > 0 ? Math.round((item.total_sales / totalSales) * 1000) / 10 : 0;
    });

    // 売上高順にソート
    filteredMenu.sort((a, b) => b.total_sales - a.total_sales);

    // カテゴリーリストを作成
    const categories = Array.from(new Set(
      Object.values(menuData).map(item => item.category)
    )).sort();

    return NextResponse.json({
      data: filteredMenu,
      summary: {
        total_sales: totalSales,
        total_quantity: totalQuantity
      },
      categories
    });
  } catch (error) {
    console.error('メニュー別売上API: 予期せぬエラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
