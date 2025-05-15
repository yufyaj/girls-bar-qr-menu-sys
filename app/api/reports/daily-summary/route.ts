import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServerComponentClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const seatType = searchParams.get('seat_type');

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

    // ユーザーの店舗情報を取得
    const { data: storeUser, error: storeUserError } = await supabase
      .from('store_users')
      .select('store_id')
      .eq('user_id', user.id)
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

    // 基本的なクエリ
    let query = supabase
      .from('checkout_history')
      .select(`
        history_id,
        checkout_at,
        store_id,
        total_amount,
        subtotal_amount,
        charge_amount,
        order_amount,
        nomination_fee,
        tax_amount,
        stay_minutes,
        guest_count,
        seat_type_name
      `)
      .eq('store_id', storeId);

    // 日付フィルタの適用
    if (startDate) {
      // 開始日の00:00:00から
      query = query.gte('checkout_at', `${startDate}T00:00:00`);
    }

    if (endDate) {
      // 終了日の23:59:59まで
      query = query.lte('checkout_at', `${endDate}T23:59:59`);
    }

    // 席種フィルタの適用
    if (seatType) {
      query = query.eq('seat_type_name', seatType);
    }

    // データ取得
    const { data, error } = await query;

    if (error) {
      console.error('会計履歴取得エラー:', error);
      return NextResponse.json(
        { error: '会計履歴の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 日付ごとにグループ化
    interface DailySummary {
      date: string;
      total_sales: number;
      total_guests: number;
      visit_count: number;
      total_stay_minutes: number;
      average_sales_per_guest: number;
      average_stay_minutes: number;
    }

    const dailyData: Record<string, DailySummary> = {};

    // 日本時間の日付をキーとして使用
    data.forEach(record => {
      const date = new Date(record.checkout_at);
      // 日本時間で日付を取得（YYYY-MM-DD形式）
      const jpDate = date.toLocaleDateString('ja-JP', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        timeZone: 'Asia/Tokyo'
      }).replace(/\//g, '-');

      if (!dailyData[jpDate]) {
        dailyData[jpDate] = {
          date: jpDate,
          total_sales: 0,
          total_guests: 0,
          visit_count: 0,
          total_stay_minutes: 0,
          average_sales_per_guest: 0,
          average_stay_minutes: 0
        };
      }

      dailyData[jpDate].total_sales += record.total_amount;
      dailyData[jpDate].total_guests += record.guest_count;
      dailyData[jpDate].visit_count += 1;
      dailyData[jpDate].total_stay_minutes += record.stay_minutes;
    });

    // 集計データの平均値を計算
    Object.values(dailyData).forEach((day: any) => {
      day.average_sales_per_guest = day.total_guests > 0 
        ? Math.round(day.total_sales / day.total_guests) 
        : 0;
        
      day.average_stay_minutes = day.visit_count > 0 
        ? Math.round(day.total_stay_minutes / day.visit_count) 
        : 0;
    });

    // 日付順にソートして配列に変換
    const result = Object.values(dailyData).sort((a: any, b: any) => 
      a.date.localeCompare(b.date)
    );

    return NextResponse.json({
      data: result,
      summary: {
        total_sales: result.reduce((sum: number, day: any) => sum + day.total_sales, 0),
        total_guests: result.reduce((sum: number, day: any) => sum + day.total_guests, 0),
        total_visits: result.reduce((sum: number, day: any) => sum + day.visit_count, 0),
        average_sales_per_guest: result.reduce((sum: number, day: any) => sum + day.total_guests, 0) > 0
          ? Math.round(result.reduce((sum: number, day: any) => sum + day.total_sales, 0) / 
              result.reduce((sum: number, day: any) => sum + day.total_guests, 0))
          : 0,
        average_stay_minutes: result.reduce((sum: number, day: any) => sum + day.visit_count, 0) > 0
          ? Math.round(result.reduce((sum: number, day: any) => sum + day.total_stay_minutes, 0) / 
              result.reduce((sum: number, day: any) => sum + day.visit_count, 0))
          : 0
      }
    });
  } catch (error) {
    console.error('日次売上サマリーAPI: 予期せぬエラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 