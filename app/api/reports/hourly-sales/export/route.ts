import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServerComponentClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');

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
    if (date && !dateRegex.test(date)) {
      return NextResponse.json(
        { error: '日付フォーマットが不正です（YYYY-MM-DD）' },
        { status: 400 }
      );
    }

    // 店舗の営業時間を取得
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('open_time, close_time')
      .eq('store_id', storeId)
      .single();

    if (storeError || !storeData) {
      return NextResponse.json(
        { error: '店舗情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 営業時間を解析（HH:MM形式）
    const openTime = storeData.open_time || '18:00'; // 例: "18:00"
    const closeTime = storeData.close_time || '12:00'; // 例: "12:00"
    
    const openHour = parseInt(openTime.split(':')[0], 10);
    const closeHour = parseInt(closeTime.split(':')[0], 10);
    
    // 営業時間の解釈：18時から翌日12時まで（18:00-12:00）
    const isOvernightOperation = closeHour < openHour;
    
    console.log('営業時間解析結果:', { openTime, closeTime, openHour, closeHour, isOvernightOperation });

    // 基本的なクエリ
    let query = supabase
      .from('checkout_history')
      .select(`
        history_id,
        checkout_at,
        store_id,
        total_amount,
        nomination_fee,
        checkout_nominations(*)
      `)
      .eq('store_id', storeId);

    // 日付フィルタの適用（ガールズバーの営業時間に合わせて）
    if (date) {
      if (isOvernightOperation) {
        // 翌日営業の場合：指定日の開店時間から翌日の閉店時間まで
        // 例：6/27を指定した場合、6/27 18:00から6/28 12:00まで
        const startDateTime = `${date}T${openTime}+09:00`;
        
        // 翌日の日付を計算（より安全な方法）
        const [year, month, day] = date.split('-').map(Number);
        const nextDate = new Date(year, month - 1, day + 1); // monthは0ベースなので-1
        const nextYear = nextDate.getFullYear();
        const nextMonth = String(nextDate.getMonth() + 1).padStart(2, '0');
        const nextDay = String(nextDate.getDate()).padStart(2, '0');
        const nextDateStr = `${nextYear}-${nextMonth}-${nextDay}`;
        const endDateTime = `${nextDateStr}T${closeTime}+09:00`;
        
        query = query.gte('checkout_at', startDateTime)
          .lte('checkout_at', endDateTime);
      } else {
        // 同日営業の場合：指定日の開店時間から閉店時間まで
        query = query.gte('checkout_at', `${date}T${openTime}+09:00`)
          .lte('checkout_at', `${date}T${closeTime}+09:00`);
      }
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

    // 時間帯ごとにグループ化
    interface HourlySales {
      time_slot: string;
      sales_amount: number;
      transaction_count: number;
      nomination_count: number;
    }

    const hourlyData: Record<string, HourlySales> = {};

    // 営業時間に基づいて時間帯スロットを初期化（1時間ごと）
    if (isOvernightOperation) {
      // 翌日営業の場合（例：18:00-12:00）
      // 開店時間から24時まで
      for (let hour = openHour; hour < 24; hour++) {
        const nextHour = hour + 1;
        const slot = `${hour.toString().padStart(2, '0')}:00-${nextHour.toString().padStart(2, '0')}:00`;
        
        hourlyData[slot] = {
          time_slot: slot,
          sales_amount: 0,
          transaction_count: 0,
          nomination_count: 0
        };
      }
      
      // 0時から閉店時間まで
      for (let hour = 0; hour < closeHour; hour++) {
        const nextHour = hour + 1;
        const slot = `${hour.toString().padStart(2, '0')}:00-${nextHour.toString().padStart(2, '0')}:00`;
        
        hourlyData[slot] = {
          time_slot: slot,
          sales_amount: 0,
          transaction_count: 0,
          nomination_count: 0
        };
      }
    } else {
      // 同日営業の場合（例：10:00-22:00）
      for (let hour = openHour; hour < closeHour; hour++) {
        const nextHour = hour + 1;
        const slot = `${hour.toString().padStart(2, '0')}:00-${nextHour.toString().padStart(2, '0')}:00`;
        
        hourlyData[slot] = {
          time_slot: slot,
          sales_amount: 0,
          transaction_count: 0,
          nomination_count: 0
        };
      }
    }

    // データを時間帯に割り当て
    data.forEach(record => {
      // 日本時間で日時を取得
      const utcDate = new Date(record.checkout_at);
      // UTCタイムスタンプに9時間（日本時間との差）を加算
      const jpTimestamp = utcDate.getTime() + (9 * 60 * 60 * 1000);
      const jpDate = new Date(jpTimestamp);
      
      const hour = jpDate.getUTCHours(); // UTCの時間を取得（ローカルタイムゾーンの影響を受けない）
      
      // 1時間ごとのスロットキーを生成
      const nextHour = hour + 1;
      const timeSlot = `${hour.toString().padStart(2, '0')}:00-${nextHour.toString().padStart(2, '0')}:00`;
      
      // 時間帯が定義されている場合のみ集計
      if (hourlyData[timeSlot]) {
        hourlyData[timeSlot].sales_amount += record.total_amount;
        hourlyData[timeSlot].transaction_count += 1;
        
        // 指名回数をカウント（checkout_nominationsの数）
        const nominations = record.checkout_nominations || [];
        hourlyData[timeSlot].nomination_count += nominations.length;
      }
    });

    // 営業時間順にソートして配列に変換
    let result: HourlySales[] = [];
    
    if (isOvernightOperation) {
      // 翌日営業の場合：開店時間から24時まで、その後0時から閉店時間まで
      // 開店時間から24時まで
      for (let hour = openHour; hour < 24; hour++) {
        const nextHour = hour + 1;
        const slot = `${hour.toString().padStart(2, '0')}:00-${nextHour.toString().padStart(2, '0')}:00`;
        if (hourlyData[slot]) {
          result.push(hourlyData[slot]);
        }
      }
      
      // 0時から閉店時間まで
      for (let hour = 0; hour < closeHour; hour++) {
        const nextHour = hour + 1;
        const slot = `${hour.toString().padStart(2, '0')}:00-${nextHour.toString().padStart(2, '0')}:00`;
        if (hourlyData[slot]) {
          result.push(hourlyData[slot]);
        }
      }
    } else {
      // 同日営業の場合：開店時間から閉店時間まで
      for (let hour = openHour; hour < closeHour; hour++) {
        const nextHour = hour + 1;
        const slot = `${hour.toString().padStart(2, '0')}:00-${nextHour.toString().padStart(2, '0')}:00`;
        if (hourlyData[slot]) {
          result.push(hourlyData[slot]);
        }
      }
    }

    // CSVヘッダー
    const csvHeaders = [
      '時間帯',
      '売上',
      '取引数',
      '指名回数'
    ];

    // CSVデータの作成
    const csvRows = result.map((slot: HourlySales) => [
      slot.time_slot,
      slot.sales_amount.toString(),
      slot.transaction_count.toString(),
      slot.nomination_count.toString()
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
    const dateStr = date || 'all';
    const filename = `hourly_sales_${dateStr}_${timestamp}.csv`;

    // レスポンスヘッダーの設定
    const headers = new Headers();
    headers.set('Content-Type', 'text/csv; charset=utf-8');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);

    return new NextResponse(csvWithBom, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('時間帯別売上CSVエクスポートAPI: 予期せぬエラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
