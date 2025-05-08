import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ table_id: string; session_id: string }> }
) {
  try {
    const { table_id, session_id } = await params;

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // セッションが存在するか確認
    const { data: existingSession, error: sessionError } = await supabase
      .from('sessions')
      .select('session_id, table_id, charge_started_at, charge_paused_at')
      .eq('session_id', session_id)
      .eq('table_id', table_id)
      .single();

    if (sessionError || !existingSession) {
      console.error('セッション取得エラー:', sessionError);
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    // すでに一時停止中の場合はエラー
    if (existingSession.charge_paused_at) {
      return NextResponse.json(
        { error: 'すでに課金が一時停止されています' },
        { status: 400 }
      );
    }

    // 課金が開始されていない場合はエラー
    if (!existingSession.charge_started_at) {
      return NextResponse.json(
        { error: '課金が開始されていません' },
        { status: 400 }
      );
    }

    // 課金を一時停止
    const { data: updatedSession, error: updateError } = await supabase
      .from('sessions')
      .update({
        charge_paused_at: new Date().toISOString(),
      })
      .eq('session_id', session_id)
      .select()
      .single();

    if (updateError) {
      console.error('セッション更新エラー:', updateError);
      return NextResponse.json(
        { error: '課金の一時停止に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: '課金を一時停止しました',
      session: updatedSession,
    });
  } catch (error) {
    console.error('課金一時停止エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
