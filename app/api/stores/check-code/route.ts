import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // URLからクエリパラメータを取得
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: '店舗コードは必須です' },
        { status: 400 }
      );
    }

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // 店舗コードから店舗情報を取得
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('store_id')
      .eq('store_code', code)
      .single();

    if (storeError || !store) {
      return NextResponse.json(
        { error: '店舗が見つかりません' },
        { status: 404 }
      );
    }

    // 店舗が存在する場合は成功レスポンス
    return NextResponse.json({
      success: true,
      message: '店舗が見つかりました'
    });
  } catch (error) {
    console.error('店舗コード確認エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
} 