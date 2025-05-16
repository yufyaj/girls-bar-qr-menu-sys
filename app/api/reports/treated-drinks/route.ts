import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServerComponentClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const castId = searchParams.get('cast_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

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

    // 会計履歴を取得するクエリの基本部分
    let historyQuery = supabase
      .from('checkout_history')
      .select('history_id, checkout_at')
      .eq('store_id', storeId);

    // 日付範囲フィルタを適用
    if (startDate) {
      historyQuery = historyQuery.gte('checkout_at', `${startDate}T00:00:00`);
      console.log(`日付フィルタ（開始）: ${startDate}T00:00:00`);
    }

    if (endDate) {
      historyQuery = historyQuery.lte('checkout_at', `${endDate}T23:59:59`);
      console.log(`日付フィルタ（終了）: ${endDate}T23:59:59`);
    }

    console.log('店舗ID:', storeId);
    console.log('会計履歴クエリ:', '店舗IDと日付範囲でフィルタリング');

    // 会計履歴を取得
    const { data: historyData, error: historyError } = await historyQuery;

    if (historyError) {
      console.error('会計履歴取得エラー:', historyError);
      return NextResponse.json(
        { error: '会計履歴の取得に失敗しました' },
        { status: 500 }
      );
    }

    console.log('取得した会計履歴数:', historyData?.length || 0);
    
    // 会計履歴がない場合は空の結果を返す
    if (!historyData || !historyData.length) {
      console.log('会計履歴データが存在しません。日付範囲や店舗IDを確認してください。');
      return NextResponse.json({
        data: [],
        summary: {
          total_quantity: 0,
          total_sales: 0
        }
      });
    }

    // 会計履歴IDのリスト
    const historyIds = historyData.map(history => history.history_id);

    // 奢りドリンク情報を取得するクエリ
    let drinksQuery = supabase
      .from('checkout_order_items')
      .select('history_id, product_id, product_name, price, quantity, subtotal, target_cast_id, target_cast_name')
      .in('history_id', historyIds)
      .not('target_cast_id', 'is', null); // キャストへの奢りドリンクのみを対象とする
    
    // クエリデバッグ情報
    console.log('会計履歴ID:', historyIds);
    console.log('奢りドリンク取得クエリ:', '会計履歴IDで検索、target_cast_idがnullでないものに限定');
    
    // 特定のキャストでフィルタリング
    if (castId) {
      drinksQuery = drinksQuery.eq('target_cast_id', castId);
      console.log('キャストIDでフィルタリング:', castId);
    }
    
    // 奢りドリンク情報を取得
    const { data: drinksData, error: drinksError } = await drinksQuery;
    
    if (drinksError) {
      console.error('奢りドリンク情報取得エラー:', drinksError);
      return NextResponse.json(
        { error: '奢りドリンク情報の取得に失敗しました' },
        { status: 500 }
      );
    }
    
    // デバッグ - 取得結果
    console.log('キャスト向け奢りドリンク取得結果数:', drinksData?.length || 0);
    
    // キャスト情報を取得
    const { data: castsData, error: castsError } = await supabase
      .from('store_users')
      .select('user_id, display_name')
      .eq('store_id', storeId)
      .eq('role', 'cast');
    
    if (castsError) {
      console.error('キャスト情報取得エラー:', castsError);
      // エラーがあっても処理は続行
    }
    
    // キャストIDと名前のマッピング
    const castNameMap: Record<string, string> = {};
    if (castsData) {
      castsData.forEach(cast => {
        if (cast.user_id) {
          castNameMap[cast.user_id] = cast.display_name || 'キャスト';
        }
      });
    }
    
    // キャスト別・商品別に集計
    interface DrinkSummary {
      cast_id: string;
      cast_name: string;
      product_id: string;
      product_name: string;
      quantity: number;
      total_sales: number;
    }
    
    // キャスト別・商品別のグループ化のキーを作成
    const groupByKey = (item: any) => `${item.target_cast_id}:${item.product_id}`;
    
    const drinkSummaryMap: Record<string, DrinkSummary> = {};
    
    // 奢りドリンク情報を集計
    drinksData.forEach(drink => {
      // ここでは全てのdrinkはtarget_cast_idが存在することが保証されています
      const key = groupByKey(drink);
      
      if (!drinkSummaryMap[key]) {
        const castName = drink.target_cast_name || castNameMap[drink.target_cast_id] || 'キャスト';
        
        drinkSummaryMap[key] = {
          cast_id: drink.target_cast_id,
          cast_name: castName,
          product_id: drink.product_id,
          product_name: drink.product_name,
          quantity: 0,
          total_sales: 0
        };
      }
      
      drinkSummaryMap[key].quantity += drink.quantity;
      drinkSummaryMap[key].total_sales += drink.subtotal;
    });

    // 配列に変換
    const drinkSummary = Object.values(drinkSummaryMap);

    // キャストごとの集計
    interface CastDrinkSummary {
      cast_id: string;
      cast_name: string;
      total_quantity: number;
      total_sales: number;
      drinks: DrinkSummary[];
    }

    const castDrinkMap: Record<string, CastDrinkSummary> = {};

    // キャストごとにグループ化
    drinkSummary.forEach(item => {
      if (!castDrinkMap[item.cast_id]) {
        castDrinkMap[item.cast_id] = {
          cast_id: item.cast_id,
          cast_name: item.cast_name,
          total_quantity: 0,
          total_sales: 0,
          drinks: []
        };
      }
      
      castDrinkMap[item.cast_id].drinks.push(item);
      castDrinkMap[item.cast_id].total_quantity += item.quantity;
      castDrinkMap[item.cast_id].total_sales += item.total_sales;
    });

    // 各キャスト内で売上金額順にソート
    Object.values(castDrinkMap).forEach(castSummary => {
      castSummary.drinks.sort((a, b) => b.total_sales - a.total_sales);
    });

    // キャスト別集計を売上合計金額順にソート
    const sortedCastDrinkSummary = Object.values(castDrinkMap).sort((a, b) => 
      b.total_sales - a.total_sales
    );

    // 全体の合計
    const summary = {
      total_quantity: sortedCastDrinkSummary.reduce((sum, cast) => sum + cast.total_quantity, 0),
      total_sales: sortedCastDrinkSummary.reduce((sum, cast) => sum + cast.total_sales, 0)
    };

    return NextResponse.json({
      data: sortedCastDrinkSummary,
      summary
    });
  } catch (error) {
    console.error('奢りドリンク内訳API: 予期せぬエラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 