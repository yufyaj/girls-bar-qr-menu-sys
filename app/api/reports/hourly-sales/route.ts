import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServerComponentClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    // 時間間隔（分単位）: 30または60
    const intervalMinutes = parseInt(searchParams.get('interval') || '60', 10);
    const startHour = parseInt(searchParams.get('start_hour') || '0', 10);
    const endHour = parseInt(searchParams.get('end_hour') || '24', 10);

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

    // 時間間隔のチェック
    if (intervalMinutes !== 30 && intervalMinutes !== 60) {
      return NextResponse.json(
        { error: '時間間隔は30分または60分を指定してください' },
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
        nomination_fee,
        checkout_nominations(*)
      `)
      .eq('store_id', storeId);

    // 日付フィルタの適用
    if (date) {
      // 指定日の00:00:00から23:59:59まで
      query = query.gte('checkout_at', `${date}T00:00:00+09:00`)
        .lte('checkout_at', `${date}T23:59:59+09:00`);
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

    // 時間帯スロットを初期化
    // 例: 30分間隔なら "00:00-00:30", "00:30-01:00", ...
    // 例: 60分間隔なら "00:00-01:00", "01:00-02:00", ...
    for (let hour = startHour; hour < endHour; hour++) {
      if (intervalMinutes === 30) {
        const slot1 = `${hour.toString().padStart(2, '0')}:00-${hour.toString().padStart(2, '0')}:30`;
        const slot2 = `${hour.toString().padStart(2, '0')}:30-${(hour + 1).toString().padStart(2, '0')}:00`;
        
        hourlyData[slot1] = {
          time_slot: slot1,
          sales_amount: 0,
          transaction_count: 0,
          nomination_count: 0
        };
        
        hourlyData[slot2] = {
          time_slot: slot2,
          sales_amount: 0,
          transaction_count: 0,
          nomination_count: 0
        };
      } else {
        const slot = `${hour.toString().padStart(2, '0')}:00-${(hour + 1).toString().padStart(2, '0')}:00`;
        
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
      const minute = jpDate.getUTCMinutes();
      
      // スロットキーを生成
      let timeSlot = '';
      
      if (intervalMinutes === 30) {
        if (minute < 30) {
          timeSlot = `${hour.toString().padStart(2, '0')}:00-${hour.toString().padStart(2, '0')}:30`;
        } else {
          timeSlot = `${hour.toString().padStart(2, '0')}:30-${(hour + 1).toString().padStart(2, '0')}:00`;
        }
      } else {
        timeSlot = `${hour.toString().padStart(2, '0')}:00-${(hour + 1).toString().padStart(2, '0')}:00`;
      }
      
      // 時間帯が定義されている場合のみ集計
      if (hourlyData[timeSlot]) {
        hourlyData[timeSlot].sales_amount += record.total_amount;
        hourlyData[timeSlot].transaction_count += 1;
        
        // 指名回数をカウント（checkout_nominationsの数）
        const nominations = record.checkout_nominations || [];
        hourlyData[timeSlot].nomination_count += nominations.length;
      }
    });

    // 時間帯順にソートして配列に変換
    const result = Object.values(hourlyData).sort((a, b) => 
      a.time_slot.localeCompare(b.time_slot)
    );

    // 合計を計算
    const summary = {
      total_sales: result.reduce((sum, hour) => sum + hour.sales_amount, 0),
      total_transactions: result.reduce((sum, hour) => sum + hour.transaction_count, 0),
      total_nominations: result.reduce((sum, hour) => sum + hour.nomination_count, 0)
    };

    return NextResponse.json({
      data: result,
      summary
    });
  } catch (error) {
    console.error('時間帯別売上API: 予期せぬエラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 