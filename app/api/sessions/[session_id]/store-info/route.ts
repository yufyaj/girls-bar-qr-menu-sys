import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ session_id: string }> }
) {
  try {
    const { session_id } = await params;

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // セッション情報を取得
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('store_id')
      .eq('session_id', session_id)
      .single();

    if (sessionError || !session) {
      console.error('セッション取得エラー:', sessionError);
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    // 店舗情報を取得
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('store_id, name, tax_rate')
      .eq('store_id', session.store_id)
      .single();

    if (storeError || !store) {
      console.error('店舗情報取得エラー:', storeError);
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
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
