import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServerComponentClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

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

    // 日付フィルタの適用（営業時間を考慮）
    if (startDate) {
      if (isOvernightOperation) {
        // 翌日営業の場合：開始日の開店時間から
        query = query.gte('checkout_at', `${startDate}T${openTime}+09:00`);
      } else {
        // 同日営業の場合：開始日の開店時間から
        query = query.gte('checkout_at', `${startDate}T${openTime}+09:00`);
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
        query = query.lte('checkout_at', `${nextDateStr}T${closeTime}+09:00`);
      } else {
        // 同日営業の場合：終了日の閉店時間まで
        query = query.lte('checkout_at', `${endDate}T${closeTime}+09:00`);
      }
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

    // CSVヘッダー
    const csvHeaders = [
      '日付',
      '売上合計',
      '来店組数',
      '来店人数',
      '客単価（1人あたり）',
      '平均滞在時間（分）'
    ];

    // CSVデータの作成
    const csvRows = result.map((day: any) => [
      day.date,
      day.total_sales.toString(),
      day.visit_count.toString(),
      day.total_guests.toString(),
      day.average_sales_per_guest.toString(),
      day.average_stay_minutes.toString()
    ]);

    // CSVコンテンツの生成
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    // BOM付きUTF-8でエンコード（Excelで文字化けを防ぐため）
    const bom = '\uFEFF';
    const csvWithBom = bom + csvContent;

    // ファイル名の生成
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
    const filename = `daily_summary_${timestamp}.csv`;

    // レスポンスヘッダーの設定
    const headers = new Headers();
    headers.set('Content-Type', 'text/csv; charset=utf-8');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);

    return new NextResponse(csvWithBom, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('日次売上サマリーCSVエクスポートAPI: 予期せぬエラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
