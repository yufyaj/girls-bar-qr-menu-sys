import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

// 指名情報の取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ session_id: string }> }
) {
  try {
    const { session_id } = await params;

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // セッションが存在するか確認
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('session_id, store_id')
      .eq('session_id', session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    // 指名情報を取得
    const { data: nominations, error: nominationsError } = await supabase
      .from('session_cast_nominations')
      .select(`
        nomination_id,
        cast_id,
        nomination_fee,
        created_at
      `)
      .eq('session_id', session_id)
      .order('created_at', { ascending: false });

    if (nominationsError) {
      console.error('指名情報取得エラー:', nominationsError);
      return NextResponse.json(
        { error: '指名情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    // キャスト情報を取得して結合
    if (nominations && nominations.length > 0) {
      const castIds = nominations.map(nom => nom.cast_id);
      const { data: casts, error: castsError } = await supabase
        .from('store_users')
        .select('user_id, display_name')
        .eq('store_id', session.store_id)
        .eq('role', 'cast')
        .in('user_id', castIds);

      if (castsError) {
        console.error('キャスト情報取得エラー:', castsError);
        return NextResponse.json(
          { error: 'キャスト情報の取得に失敗しました' },
          { status: 500 }
        );
      }

      // キャスト情報を指名情報に結合
      const nominationsWithCastInfo = nominations.map(nomination => {
        const cast = casts?.find(c => c.user_id === nomination.cast_id);
        return {
          ...nomination,
          display_name: cast?.display_name || 'キャスト'
        };
      });

      return NextResponse.json(nominationsWithCastInfo);
    }

    return NextResponse.json(nominations || []);
  } catch (error) {
    console.error('指名情報取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}

// 指名情報の登録
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ session_id: string }> }
) {
  try {
    const { session_id } = await params;
    const data = await request.json();

    // バリデーション
    if (!data.cast_id) {
      return NextResponse.json(
        { error: 'キャストIDが必要です' },
        { status: 400 }
      );
    }

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // セッションが存在するか確認
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('session_id, store_id')
      .eq('session_id', session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    // キャストが存在するか確認
    const { data: cast, error: castError } = await supabase
      .from('store_users')
      .select('user_id, display_name, nomination_fee')
      .eq('store_id', session.store_id)
      .eq('role', 'cast')
      .eq('user_id', data.cast_id)
      .single();

    if (castError || !cast) {
      return NextResponse.json(
        { error: 'キャストが見つかりません' },
        { status: 404 }
      );
    }

    // 指名料を取得（リクエストから指定されていない場合はキャストの設定値を使用）
    const nominationFee = data.nomination_fee !== undefined ? data.nomination_fee : cast.nomination_fee;

    // 指名情報を登録
    const { data: nomination, error: nominationError } = await supabase
      .from('session_cast_nominations')
      .insert({
        session_id,
        cast_id: data.cast_id,
        nomination_fee: nominationFee
      })
      .select()
      .single();

    if (nominationError) {
      console.error('指名情報登録エラー:', nominationError);
      return NextResponse.json(
        { error: '指名情報の登録に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...nomination,
      display_name: cast.display_name
    });
  } catch (error) {
    console.error('指名情報登録エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
