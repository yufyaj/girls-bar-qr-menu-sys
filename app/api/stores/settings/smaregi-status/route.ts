import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const storeId = cookieStore.get('store-id')?.value;

    if (!storeId) {
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // 店舗情報を取得
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('enable_smaregi_integration')
      .eq('store_id', storeId)
      .single();

    if (storeError) {
      console.error('店舗情報取得エラー:', storeError);
      return NextResponse.json(
        { error: '店舗情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      enabled: store.enable_smaregi_integration
    });
  } catch (error) {
    console.error('スマレジ連携状態取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
