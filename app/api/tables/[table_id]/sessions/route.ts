import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table_id: string }> }
) {
  try {
    const { table_id } = await params;

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // テーブル情報を取得して店舗IDを特定
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('store_id')
      .eq('table_id', table_id)
      .single();

    if (tableError || !table) {
      return NextResponse.json(
        { error: 'テーブルが見つかりません' },
        { status: 404 }
      );
    }

    // アクティブなセッションを取得（課金が開始されているセッションを優先）
    const { data: existingSession, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('table_id', table_id)
      .not('charge_started_at', 'is', null)
      .order('start_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 課金が開始されているセッションがない場合は、最新のセッションを取得
    if (!existingSession) {
      const { data: latestSession, error: latestSessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('table_id', table_id)
        .order('start_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestSessionError) {
        console.error('最新セッション取得エラー:', latestSessionError);
      } else if (latestSession) {
        return NextResponse.json(latestSession);
      }
    }

    if (sessionError) {
      console.error('セッション取得エラー:', sessionError);
      return NextResponse.json(
        { error: 'セッション情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    // セッションが存在する場合はそれを返す
    if (existingSession) {
      return NextResponse.json({
        session_id: existingSession.session_id,
        table_id: existingSession.table_id,
        store_id: existingSession.store_id,
        start_at: existingSession.start_at,
        charge_started_at: existingSession.charge_started_at,
        charge_paused_at: existingSession.charge_paused_at,
        selected_cast_id: existingSession.selected_cast_id,
        is_new_customer: existingSession.is_new_customer
      });
    }

    // セッションが存在しない場合は新規作成
    const { data: newSession, error: createError } = await supabase
      .from('sessions')
      .insert({
        table_id,
        store_id: table.store_id,
        start_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error('セッション作成エラー:', createError);
      return NextResponse.json(
        { error: 'セッションの作成に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      session_id: newSession.session_id,
      table_id: newSession.table_id,
      store_id: newSession.store_id,
      start_at: newSession.start_at,
      charge_started_at: newSession.charge_started_at,
      charge_paused_at: newSession.charge_paused_at,
      selected_cast_id: newSession.selected_cast_id,
      is_new_customer: newSession.is_new_customer
    });
  } catch (error) {
    console.error('セッション管理エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}


