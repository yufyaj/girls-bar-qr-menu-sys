import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // 店舗一覧を取得
    const { data: stores, error } = await supabase
      .from('stores')
      .select('store_id, store_code, name')
      .order('name');

    if (error) {
      console.error('店舗一覧取得エラー:', error);
      return NextResponse.json(
        { error: '店舗一覧の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(stores);
  } catch (error) {
    console.error('店舗一覧取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
