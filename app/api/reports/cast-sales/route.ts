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

    // キャスト情報を取得
    let castQuery = supabase
      .from('store_users')
      .select('user_id, display_name')
      .eq('store_id', storeId)
      .eq('role', 'cast');

    if (castId) {
      castQuery = castQuery.eq('user_id', castId);
    }

    const { data: castData, error: castError } = await castQuery;

    if (castError) {
      console.error('キャスト情報取得エラー:', castError);
      return NextResponse.json(
        { error: 'キャスト情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 会計履歴を取得するクエリの基本部分
    let historyQuery = supabase
      .from('checkout_history')
      .select(`
        history_id, 
        checkout_at,
        total_amount
      `)
      .eq('store_id', storeId);

    // 日付範囲フィルタを適用（営業時間を考慮）
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

    // 会計履歴を取得
    const { data: historyData, error: historyError } = await historyQuery;

    if (historyError) {
      console.error('会計履歴取得エラー:', historyError);
      return NextResponse.json(
        { error: '会計履歴の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 集計結果を整理するためのデータ構造
    interface CastSummary {
      cast_id: string;
      cast_name: string;
      nomination_count: number;
      total_nomination_fee: number;
      treated_drink_count: number;
      treated_drink_sales: number;
      total_sales: number;
      daily_data: Record<string, {
        date: string;
        nomination_count: number;
        total_nomination_fee: number;
        treated_drink_count: number;
        treated_drink_sales: number;
      }>;
    }

    // キャスト別の集計データを初期化
    const castSummary: Record<string, CastSummary> = {};

    // すべてのキャストに対して集計データを初期化
    castData.forEach(cast => {
      castSummary[cast.user_id] = {
        cast_id: cast.user_id,
        cast_name: cast.display_name || 'キャスト',
        nomination_count: 0,
        total_nomination_fee: 0,
        treated_drink_count: 0,
        treated_drink_sales: 0,
        total_sales: 0,
        daily_data: {}
      };
    });

    // 会計履歴がない場合は空の結果を返す
    if (!historyData.length) {
      return NextResponse.json({
        data: Object.values(castSummary),
        summary: {
          total_nominations: 0,
          total_nomination_fee: 0,
          total_treated_drinks: 0,
          total_treated_drink_sales: 0,
          total_sales: 0
        }
      });
    }

    // 会計履歴IDのリスト
    const historyIds = historyData.map(history => history.history_id);

    // 指名情報を取得
    const { data: nominations, error: nominationsError } = await supabase
      .from('checkout_nominations')
      .select('history_id, cast_id, cast_name, fee')
      .in('history_id', historyIds);

    if (nominationsError) {
      console.error('指名情報取得エラー:', nominationsError);
      // エラーがあっても処理は続行
    }

    // 奢りドリンク情報を取得
    const { data: treatedDrinks, error: treatedDrinksError } = await supabase
      .from('checkout_order_items')
      .select('history_id, product_name, price, quantity, subtotal, target_cast_id, target_cast_name')
      .in('history_id', historyIds)
      .not('target_cast_id', 'is', null);

    if (treatedDrinksError) {
      console.error('奢りドリンク情報取得エラー:', treatedDrinksError);
      // エラーがあっても処理は続行
    }

    // 会計履歴の日付をマッピング
    const historyDates: Record<string, string> = {};
    historyData.forEach(history => {
      const date = new Date(history.checkout_at);
      // 日本時間で日付を取得（YYYY-MM-DD形式）
      const jpDate = date.toLocaleDateString('ja-JP', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        timeZone: 'Asia/Tokyo'
      }).replace(/\//g, '-');

      historyDates[history.history_id] = jpDate;
    });

    // 指名情報を集計
    if (nominations) {
      nominations.forEach(nomination => {
        if (nomination.cast_id && castSummary[nomination.cast_id]) {
          const date = historyDates[nomination.history_id];
          
          // 日次データを初期化
          if (!castSummary[nomination.cast_id].daily_data[date]) {
            castSummary[nomination.cast_id].daily_data[date] = {
              date,
              nomination_count: 0,
              total_nomination_fee: 0,
              treated_drink_count: 0,
              treated_drink_sales: 0
            };
          }
          
          // 集計
          castSummary[nomination.cast_id].nomination_count += 1;
          castSummary[nomination.cast_id].total_nomination_fee += nomination.fee;
          castSummary[nomination.cast_id].total_sales += nomination.fee;
          
          // 日次データも集計
          castSummary[nomination.cast_id].daily_data[date].nomination_count += 1;
          castSummary[nomination.cast_id].daily_data[date].total_nomination_fee += nomination.fee;
        }
      });
    }

    // 奢りドリンク情報を集計
    if (treatedDrinks) {
      treatedDrinks.forEach(drink => {
        if (drink.target_cast_id && castSummary[drink.target_cast_id]) {
          const date = historyDates[drink.history_id];
          
          // 日次データを初期化
          if (!castSummary[drink.target_cast_id].daily_data[date]) {
            castSummary[drink.target_cast_id].daily_data[date] = {
              date,
              nomination_count: 0,
              total_nomination_fee: 0,
              treated_drink_count: 0,
              treated_drink_sales: 0
            };
          }
          
          // 集計
          castSummary[drink.target_cast_id].treated_drink_count += drink.quantity;
          castSummary[drink.target_cast_id].treated_drink_sales += drink.subtotal;
          castSummary[drink.target_cast_id].total_sales += drink.subtotal;
          
          // 日次データも集計
          castSummary[drink.target_cast_id].daily_data[date].treated_drink_count += drink.quantity;
          castSummary[drink.target_cast_id].daily_data[date].treated_drink_sales += drink.subtotal;
        }
      });
    }

    // 日次データを配列に変換して日付でソート
    Object.values(castSummary).forEach(cast => {
      const dailyArray = Object.values(cast.daily_data).sort((a, b) => 
        a.date.localeCompare(b.date)
      );
      
      // 日次データを配列に置き換え
      (cast as any).daily_data = dailyArray;
    });

    // 売上合計でソート
    const sortedCastSummary = Object.values(castSummary).sort((a, b) => b.total_sales - a.total_sales);

    // 全体の合計を計算
    const summary = {
      total_nominations: sortedCastSummary.reduce((sum, cast) => sum + cast.nomination_count, 0),
      total_nomination_fee: sortedCastSummary.reduce((sum, cast) => sum + cast.total_nomination_fee, 0),
      total_treated_drinks: sortedCastSummary.reduce((sum, cast) => sum + cast.treated_drink_count, 0),
      total_treated_drink_sales: sortedCastSummary.reduce((sum, cast) => sum + cast.treated_drink_sales, 0),
      total_sales: sortedCastSummary.reduce((sum, cast) => sum + cast.total_sales, 0)
    };

    return NextResponse.json({
      data: sortedCastSummary,
      summary
    });
  } catch (error) {
    console.error('キャスト別売上API: 予期せぬエラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
