import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // 会計履歴データを取得
    const { data: histories, error: historiesError } = await supabase
      .from('checkout_history')
      .select('history_id, store_id, checkout_at')
      .order('checkout_at', { ascending: false })
      .limit(10);

    if (historiesError) {
      console.error('会計履歴取得エラー:', historiesError);
      return NextResponse.json(
        { error: '会計履歴の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 会計履歴がなければ空のレスポンスを返す
    if (!histories || histories.length === 0) {
      return NextResponse.json({
        message: '会計履歴データが存在しません',
        histories: [],
        orderItems: []
      });
    }

    // 会計履歴IDのリスト
    const historyIds = histories.map(history => history.history_id);

    // 奢りドリンク情報を取得するクエリ
    const { data: allOrderItems, error: orderItemsError } = await supabase
      .from('checkout_order_items')
      .select('*')
      .in('history_id', historyIds);

    if (orderItemsError) {
      console.error('注文アイテム取得エラー:', orderItemsError);
      return NextResponse.json(
        { error: '注文アイテムの取得に失敗しました' },
        { status: 500 }
      );
    }

    // 奢りドリンク情報を取得するクエリ
    const { data: treatedDrinks, error: treatedDrinksError } = await supabase
      .from('checkout_order_items')
      .select('*')
      .in('history_id', historyIds)
      .not('target_cast_id', 'is', null);

    if (treatedDrinksError) {
      console.error('奢りドリンク取得エラー:', treatedDrinksError);
      return NextResponse.json(
        { error: '奢りドリンクの取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: '会計履歴とアイテムデータを取得しました',
      histories: histories,
      totalOrderItems: allOrderItems?.length || 0,
      orderItems: allOrderItems,
      totalTreatedDrinks: treatedDrinks?.length || 0,
      treatedDrinks: treatedDrinks
    });
  } catch (error) {
    console.error('デバッグAPI: 予期せぬエラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 