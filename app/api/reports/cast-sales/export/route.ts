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

    // 日付範囲フィルタを適用
    if (startDate) {
      historyQuery = historyQuery.gte('checkout_at', `${startDate}T00:00:00`);
    }

    if (endDate) {
      historyQuery = historyQuery.lte('checkout_at', `${endDate}T23:59:59`);
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
        total_sales: 0
      };
    });

    // 会計履歴がない場合は空のCSVを返す
    if (!historyData.length) {
      const csvHeaders = [
        'キャスト名',
        '指名回数',
        '指名料',
        '奢りドリンク数',
        '奢りドリンク売上',
        '合計売上'
      ];

      const csvContent = csvHeaders.join(',');
      const bom = '\uFEFF';
      const csvWithBom = bom + csvContent;

      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
      const filename = `cast_sales_${timestamp}.csv`;

      const headers = new Headers();
      headers.set('Content-Type', 'text/csv; charset=utf-8');
      headers.set('Content-Disposition', `attachment; filename="${filename}"`);

      return new NextResponse(csvWithBom, {
        status: 200,
        headers
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

    // 指名情報を集計
    if (nominations) {
      nominations.forEach(nomination => {
        if (nomination.cast_id && castSummary[nomination.cast_id]) {
          // 集計
          castSummary[nomination.cast_id].nomination_count += 1;
          castSummary[nomination.cast_id].total_nomination_fee += nomination.fee;
          castSummary[nomination.cast_id].total_sales += nomination.fee;
        }
      });
    }

    // 奢りドリンク情報を集計
    if (treatedDrinks) {
      treatedDrinks.forEach(drink => {
        if (drink.target_cast_id && castSummary[drink.target_cast_id]) {
          // 集計
          castSummary[drink.target_cast_id].treated_drink_count += drink.quantity;
          castSummary[drink.target_cast_id].treated_drink_sales += drink.subtotal;
          castSummary[drink.target_cast_id].total_sales += drink.subtotal;
        }
      });
    }

    // 売上合計でソート
    const sortedCastSummary = Object.values(castSummary).sort((a, b) => b.total_sales - a.total_sales);

    // CSVヘッダー
    const csvHeaders = [
      'キャスト名',
      '指名回数',
      '指名料',
      '奢りドリンク数',
      '奢りドリンク売上',
      '合計売上'
    ];

    // CSVデータの作成
    const csvRows = sortedCastSummary.map((cast: CastSummary) => [
      cast.cast_name,
      cast.nomination_count.toString(),
      cast.total_nomination_fee.toString(),
      cast.treated_drink_count.toString(),
      cast.treated_drink_sales.toString(),
      cast.total_sales.toString()
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
    const filename = `cast_sales_${timestamp}.csv`;

    // レスポンスヘッダーの設定
    const headers = new Headers();
    headers.set('Content-Type', 'text/csv; charset=utf-8');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);

    return new NextResponse(csvWithBom, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('キャスト別売上CSVエクスポートAPI: 予期せぬエラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
