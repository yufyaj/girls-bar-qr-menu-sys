import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ store_id: string }> }
) {
  try {
    const { store_id } = await params;

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // 店舗情報を取得
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('store_id', store_id)
      .single();

    if (storeError || !store) {
      return NextResponse.json(
        { error: '店舗が見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json(store);
  } catch (error) {
    console.error('店舗情報取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
