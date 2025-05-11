import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // URLクエリパラメータからstore-idを取得
    const storeIdFromQuery = request.nextUrl.searchParams.get('storeId');

    // "null"文字列の場合はnullとして扱う
    const validStoreIdFromQuery = storeIdFromQuery === 'null' ? null : storeIdFromQuery;

    // Cookieからstore-idを取得
    const cookieStore = await cookies();
    const storeIdFromCookie = cookieStore.get('store-id')?.value;

    // クエリパラメータを優先し、なければCookieから取得
    const storeId = validStoreIdFromQuery || storeIdFromCookie;

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

    // メニュー情報を取得
    const { data: menu, error } = await supabase
      .from('menus')
      .select('*')
      .eq('menu_id', id)
      .eq('store_id', storeId)
      .single();

    if (error) {
      console.error('メニュー取得エラー:', error);
      return NextResponse.json(
        { error: 'メニュー情報の取得に失敗しました' },
        { status: 404 }
      );
    }

    return NextResponse.json(menu);
  } catch (error) {
    console.error('メニュー取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // URLクエリパラメータからstore-idを取得
    const storeIdFromQuery = request.nextUrl.searchParams.get('storeId');

    // "null"文字列の場合はnullとして扱う
    const validStoreIdFromQuery = storeIdFromQuery === 'null' ? null : storeIdFromQuery;

    // Cookieからstore-idを取得
    const cookieStore = await cookies();
    const storeIdFromCookie = cookieStore.get('store-id')?.value;

    // クエリパラメータを優先し、なければCookieから取得
    const storeId = validStoreIdFromQuery || storeIdFromCookie;

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

    const data = await request.json();

    // バリデーション
    if (!data.name || data.price < 0) {
      return NextResponse.json(
        { error: '必須項目が不足しているか、無効な値です' },
        { status: 400 }
      );
    }

    // メニューが存在するか確認
    const { data: existingMenu, error: checkError } = await supabase
      .from('menus')
      .select('menu_id')
      .eq('menu_id', id)
      .eq('store_id', storeId)
      .single();

    if (checkError || !existingMenu) {
      return NextResponse.json(
        { error: 'メニューが見つかりません' },
        { status: 404 }
      );
    }

    // メニュー情報を更新
    const { data: updatedMenu, error: updateError } = await supabase
      .from('menus')
      .update({
        name: data.name,
        description: data.description || null,
        price: data.price,
        image_url: data.image_url || null,
        category: data.category || null,
        category_id: data.category_id || null,
        is_available: data.is_available !== false,
      })
      .eq('menu_id', id)
      .eq('store_id', storeId)
      .select()
      .single();

    if (updateError) {
      console.error('メニュー更新エラー:', updateError);
      return NextResponse.json(
        { error: 'メニュー情報の更新に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedMenu);
  } catch (error) {
    console.error('メニュー更新エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // URLクエリパラメータからstore-idを取得
    const storeIdFromQuery = request.nextUrl.searchParams.get('storeId');

    // "null"文字列の場合はnullとして扱う
    const validStoreIdFromQuery = storeIdFromQuery === 'null' ? null : storeIdFromQuery;

    // Cookieからstore-idを取得
    const cookieStore = await cookies();
    const storeIdFromCookie = cookieStore.get('store-id')?.value;

    // クエリパラメータを優先し、なければCookieから取得
    const storeId = validStoreIdFromQuery || storeIdFromCookie;

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

    // メニューが存在するか確認
    const { data: existingMenu, error: checkError } = await supabase
      .from('menus')
      .select('menu_id')
      .eq('menu_id', id)
      .eq('store_id', storeId)
      .single();

    if (checkError || !existingMenu) {
      return NextResponse.json(
        { error: 'メニューが見つかりません' },
        { status: 404 }
      );
    }

    // メニューを削除
    const { error: deleteError } = await supabase
      .from('menus')
      .delete()
      .eq('menu_id', id)
      .eq('store_id', storeId);

    if (deleteError) {
      console.error('メニュー削除エラー:', deleteError);
      return NextResponse.json(
        { error: 'メニューの削除に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('メニュー削除エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
