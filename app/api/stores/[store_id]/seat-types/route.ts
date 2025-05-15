import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { store_id: string } }
) {
  try {
    const { store_id } = params;

    if (!store_id) {
      return NextResponse.json(
        { error: '店舗IDは必須です' },
        { status: 400 }
      );
    }

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // 店舗に紐づく席種データを取得
    const { data: seatTypes, error } = await supabase
      .from('seat_types')
      .select('seat_type_id, display_name')
      .eq('store_id', store_id)
      .order('display_name');

    if (error) {
      console.error('席種情報取得エラー:', error);
      return NextResponse.json(
        { error: '席種情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ seatTypes });
  } catch (error) {
    console.error('席種情報取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
} 