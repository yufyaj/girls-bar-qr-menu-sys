import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ table_id: string; session_id: string }> }
) {
  try {
    const { table_id, session_id } = await params;

    // リクエストボディを取得
    const data = await request.json();

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // セッションが存在するか確認
    const { data: existingSession, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('session_id', session_id)
      .eq('table_id', table_id)
      .single();

    if (sessionError || !existingSession) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    // 更新するフィールドを準備
    const updateData: any = {};

    // charge_started_atの更新
    if (data.charge_started_at !== undefined) {
      updateData.charge_started_at = data.charge_started_at;
    }

    // selected_cast_idの更新
    if (data.selected_cast_id !== undefined) {
      updateData.selected_cast_id = data.selected_cast_id;
    }

    // is_new_customerの更新
    if (data.is_new_customer !== undefined) {
      updateData.is_new_customer = data.is_new_customer;
    }

    // guest_countの更新
    if (data.guest_count !== undefined) {
      updateData.guest_count = data.guest_count;
    }

    // セッションを更新
    const { data: updatedSession, error: updateError } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('session_id', session_id)
      .select()
      .single();

    if (updateError) {
      console.error('セッション更新エラー:', updateError);
      return NextResponse.json(
        { error: 'セッションの更新に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      session_id: updatedSession.session_id,
      table_id: updatedSession.table_id,
      store_id: updatedSession.store_id,
      start_at: updatedSession.start_at,
      charge_started_at: updatedSession.charge_started_at,
      selected_cast_id: updatedSession.selected_cast_id,
      is_new_customer: updatedSession.is_new_customer,
      guest_count: updatedSession.guest_count
    });
  } catch (error) {
    console.error('セッション更新エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
