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

    // 一時停止されていない場合はエラー
    if (!existingSession.charge_paused_at) {
      return NextResponse.json(
        { error: '課金は一時停止されていません' },
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

    // 一時停止していた時間を計算
    const pauseStartTime = new Date(existingSession.charge_paused_at);
    const now = new Date();
    const pauseDurationMs = now.getTime() - pauseStartTime.getTime();

    // 元の課金開始時間
    const originalStartTime = new Date(existingSession.charge_started_at);

    // 一時停止していた時間分だけ課金開始時間を調整（後ろにずらす）
    const newStartTime = new Date(originalStartTime.getTime() + pauseDurationMs);

    // 課金を再開（charge_paused_atをnullに設定し、charge_started_atを調整）
    const { data: updatedSession, error: updateError } = await supabase
      .from('sessions')
      .update({
        charge_paused_at: null,
        charge_started_at: newStartTime.toISOString(), // 調整後の新しい開始時間
      })
      .eq('session_id', session_id)
      .select()
      .single();

    if (updateError) {
      console.error('セッション更新エラー:', updateError);
      return NextResponse.json(
        { error: '課金の再開に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: '課金を再開しました',
      session: updatedSession,
    });
  } catch (error) {
    console.error('課金再開エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
