import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const queryStoreId = url.searchParams.get('storeId');

    const cookieStore = await cookies();
    const cookieStoreId = cookieStore.get('store-id')?.value;
    const cookieStoreIdLegacy = cookieStore.get('storeId')?.value;

    // 優先順位: クエリパラメータ > Cookieストア
    const storeId = queryStoreId || cookieStoreId || cookieStoreIdLegacy;

    console.log('GET /api/casts/[id]: 店舗ID比較:', {
      queryStoreId,
      cookieStoreId,
      cookieStoreIdLegacy,
      finalStoreId: storeId
    });

    if (!storeId) {
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }

    // APIからユーザー情報を取得
    const userResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/auth/user`, {
      headers: {
        Cookie: request.headers.get('cookie') || ''
      }
    });

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: '認証されていません' },
        { status: 401 }
      );
    }

    const { user } = await userResponse.json();

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // 管理者でなければエラー
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    // 店舗情報を取得
    const { data: store } = await supabase
      .from('stores')
      .select('enable_cast_management')
      .eq('store_id', storeId)
      .single();

    if (!store || !store.enable_cast_management) {
      return NextResponse.json(
        { error: 'キャスト管理機能が無効です' },
        { status: 403 }
      );
    }

    // キャスト情報を取得
    const { data: cast, error } = await supabase
      .from('store_users')
      .select(`
        id,
        role,
        user_id,
        display_name,
        nomination_fee
      `)
      .eq('id', id)
      .eq('store_id', storeId)
      .eq('role', 'cast')
      .single();

    // ユーザー情報を別途取得
    if (cast && cast.user_id) {
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(cast.user_id);
        if (userData && userData.user) {
          cast.email = userData.user.email;
        }
      } catch (userError) {
        console.error('ユーザー情報取得エラー:', userError);
      }
    }

    if (error) {
      console.error('キャスト取得エラー:', error);
      return NextResponse.json(
        { error: 'キャスト情報の取得に失敗しました' },
        { status: 404 }
      );
    }

    return NextResponse.json(cast);
  } catch (error) {
    console.error('キャスト取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const queryStoreId = url.searchParams.get('storeId');

    const cookieStore = await cookies();
    const cookieStoreId = cookieStore.get('store-id')?.value;
    const cookieStoreIdLegacy = cookieStore.get('storeId')?.value;

    // 優先順位: クエリパラメータ > Cookieストア
    const storeId = queryStoreId || cookieStoreId || cookieStoreIdLegacy;

    console.log('PATCH /api/casts/[id]: 店舗ID比較:', {
      queryStoreId,
      cookieStoreId,
      cookieStoreIdLegacy,
      finalStoreId: storeId
    });

    if (!storeId) {
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }

    // APIからユーザー情報を取得
    const userResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/auth/user`, {
      headers: {
        Cookie: request.headers.get('cookie') || ''
      }
    });

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: '認証されていません' },
        { status: 401 }
      );
    }

    const { user } = await userResponse.json();

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // 管理者でなければエラー
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    // 店舗情報を取得
    const { data: store } = await supabase
      .from('stores')
      .select('enable_cast_management')
      .eq('store_id', storeId)
      .single();

    if (!store || !store.enable_cast_management) {
      return NextResponse.json(
        { error: 'キャスト管理機能が無効です' },
        { status: 403 }
      );
    }

    const data = await request.json();

    // バリデーション
    if (!data.email || !data.display_name) {
      return NextResponse.json(
        { error: 'メールアドレスと名前は必須です' },
        { status: 400 }
      );
    }

    // キャスト情報を取得
    const { data: cast, error: castError } = await supabase
      .from('store_users')
      .select('id, user_id')
      .eq('id', id)
      .eq('store_id', storeId)
      .eq('role', 'cast')
      .single();

    if (castError || !cast) {
      return NextResponse.json(
        { error: 'キャストが見つかりません' },
        { status: 404 }
      );
    }

    // ユーザー情報を更新
    const updateData: any = {
      email: data.email,
      email_confirm: true,
    };

    // パスワードが指定されている場合のみ更新
    if (data.password) {
      updateData.password = data.password;
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      cast.user_id,
      updateData
    );

    if (updateError) {
      console.error('ユーザー更新エラー:', updateError);
      return NextResponse.json(
        { error: 'ユーザー情報の更新に失敗しました' },
        { status: 500 }
      );
    }

    // 指名料のバリデーション
    const nominationFee = data.nomination_fee !== undefined ? parseInt(data.nomination_fee, 10) : 0;

    // 表示名と指名料を更新
    const { error: updateStoreUserError } = await supabase
      .from('store_users')
      .update({
        display_name: data.display_name,
        nomination_fee: isNaN(nominationFee) ? 0 : nominationFee
      })
      .eq('id', cast.id);

    if (updateStoreUserError) {
      console.error('キャスト情報更新エラー:', updateStoreUserError);
      return NextResponse.json(
        { error: 'キャスト情報の更新に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('キャスト更新エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const queryStoreId = url.searchParams.get('storeId');

    const cookieStore = await cookies();
    const cookieStoreId = cookieStore.get('store-id')?.value;
    const cookieStoreIdLegacy = cookieStore.get('storeId')?.value;

    // 優先順位: クエリパラメータ > Cookieストア
    const storeId = queryStoreId || cookieStoreId || cookieStoreIdLegacy;

    console.log('DELETE /api/casts/[id]: 店舗ID比較:', {
      queryStoreId,
      cookieStoreId,
      cookieStoreIdLegacy,
      finalStoreId: storeId
    });

    if (!storeId) {
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }

    // APIからユーザー情報を取得
    const userResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/auth/user`, {
      headers: {
        Cookie: request.headers.get('cookie') || ''
      }
    });

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: '認証されていません' },
        { status: 401 }
      );
    }

    const { user } = await userResponse.json();

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // 管理者でなければエラー
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    // 店舗情報を取得
    const { data: store } = await supabase
      .from('stores')
      .select('enable_cast_management')
      .eq('store_id', storeId)
      .single();

    if (!store || !store.enable_cast_management) {
      return NextResponse.json(
        { error: 'キャスト管理機能が無効です' },
        { status: 403 }
      );
    }

    // キャスト情報を取得
    const { data: cast, error: castError } = await supabase
      .from('store_users')
      .select('user_id')
      .eq('id', id)
      .eq('store_id', storeId)
      .eq('role', 'cast')
      .single();

    if (castError || !cast) {
      return NextResponse.json(
        { error: 'キャストが見つかりません' },
        { status: 404 }
      );
    }

    // 店舗ユーザー関連付けを削除
    const { error: deleteError } = await supabase
      .from('store_users')
      .delete()
      .eq('id', id)
      .eq('store_id', storeId);

    if (deleteError) {
      console.error('店舗ユーザー関連付け削除エラー:', deleteError);
      return NextResponse.json(
        { error: '店舗ユーザー関連付けの削除に失敗しました' },
        { status: 500 }
      );
    }

    // ユーザーを削除
    const { error: userDeleteError } = await supabase.auth.admin.deleteUser(
      cast.user_id
    );

    if (userDeleteError) {
      console.error('ユーザー削除エラー:', userDeleteError);
      // ユーザー削除に失敗しても、関連付けは削除されているので成功とする
      console.warn('ユーザー削除に失敗しましたが、関連付けは削除されました');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('キャスト削除エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
