import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

// セッション削除API
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ session_id: string }> }
) {
  try {
    const { session_id } = await params;
    console.log('セッション削除API: リクエスト受信', { session_id });

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // セッションが存在するか確認
    const { data: existingSession, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('session_id', session_id)
      .single();

    if (sessionError || !existingSession) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    // セッションを削除
    const { error: deleteError } = await supabase
      .from('sessions')
      .delete()
      .eq('session_id', session_id);

    if (deleteError) {
      console.error('セッション削除エラー:', deleteError);
      return NextResponse.json(
        { error: 'セッションの削除に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'セッションが正常に削除されました'
    });
  } catch (error) {
    console.error('セッション削除処理エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
