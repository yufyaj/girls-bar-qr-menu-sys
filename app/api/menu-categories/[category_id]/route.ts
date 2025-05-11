import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient, createServerComponentClient } from '@/lib/supabase';
import { getUserRoleInStore } from '@/lib/auth';

// カテゴリ取得API
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category_id: string }> }
) {
  try {
    const { category_id } = await params;
    const cookieStore = await cookies();
    const storeId = cookieStore.get('store-id')?.value;

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

    // 管理者でなければエラー
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    // カテゴリー情報を取得
    const { data: category, error } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('category_id', category_id)
      .eq('store_id', storeId)
      .single();

    if (error) {
      console.error('カテゴリー取得エラー:', error);
      return NextResponse.json(
        { error: 'カテゴリー情報の取得に失敗しました' },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error('カテゴリー取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}

// カテゴリ更新API
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ category_id: string }> }
) {
  try {
    const { category_id } = await params;
    const cookieStore = await cookies();
    const storeId = cookieStore.get('store-id')?.value;

    if (!storeId) {
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }

    // 認証用クライアント（Cookieベース）
    const authClient = await createServerComponentClient();

    // ユーザー情報を取得
    const { data: { user } } = await authClient.auth.getUser();

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    if (!user) {
      return NextResponse.json(
        { error: '認証されていません' },
        { status: 401 }
      );
    }

    // ユーザーの役割を取得
    const userRole = await getUserRoleInStore(user.id, storeId);

    // 管理者でなければエラー
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    // カテゴリ情報を取得
    const { data: category } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('category_id', category_id)
      .eq('store_id', storeId)
      .single();

    if (!category) {
      return NextResponse.json(
        { error: 'カテゴリが見つかりません' },
        { status: 404 }
      );
    }

    // リクエストボディを取得
    const data = await request.json();

    // バリデーション
    if (!data.name) {
      return NextResponse.json(
        { error: 'カテゴリ名は必須です' },
        { status: 400 }
      );
    }

    // カテゴリを更新
    const { data: updatedCategory, error: updateError } = await supabase
      .from('menu_categories')
      .update({
        name: data.name,
        display_order: data.display_order !== undefined ? data.display_order : category.display_order,
        smaregi_category_id: data.smaregi_category_id !== undefined ? data.smaregi_category_id : category.smaregi_category_id,
        allow_treat_cast: data.allow_treat_cast !== undefined ? data.allow_treat_cast : category.allow_treat_cast
      })
      .eq('category_id', category_id)
      .select()
      .single();

    if (updateError) {
      // 一意制約違反の場合
      if (updateError.code === '23505') {
        return NextResponse.json(
          { error: '同じ名前のカテゴリが既に存在します' },
          { status: 400 }
        );
      }

      console.error('カテゴリ更新エラー:', updateError);
      return NextResponse.json(
        { error: 'カテゴリの更新に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedCategory);
  } catch (error) {
    console.error('カテゴリ更新エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}

// カテゴリ削除API
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ category_id: string }> }
) {
  try {
    const { category_id } = await params;
    const cookieStore = await cookies();
    const storeId = cookieStore.get('store-id')?.value;

    if (!storeId) {
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }

    // 認証用クライアント（Cookieベース）
    const authClient = await createServerComponentClient();

    // ユーザー情報を取得
    const { data: { user } } = await authClient.auth.getUser();

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

    if (!user) {
      return NextResponse.json(
        { error: '認証されていません' },
        { status: 401 }
      );
    }

    // ユーザーの役割を取得
    const userRole = await getUserRoleInStore(user.id, storeId);

    // 管理者でなければエラー
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    // カテゴリ情報を取得
    const { data: category } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('category_id', category_id)
      .eq('store_id', storeId)
      .single();

    if (!category) {
      return NextResponse.json(
        { error: 'カテゴリが見つかりません' },
        { status: 404 }
      );
    }

    // このカテゴリに属するメニュー数を確認
    const { count, error: countError } = await supabase
      .from('menus')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', category_id);

    if (countError) {
      console.error('メニュー数取得エラー:', countError);
      return NextResponse.json(
        { error: 'メニュー数の取得に失敗しました' },
        { status: 500 }
      );
    }

    // メニューが存在する場合は削除不可
    if (count && count > 0) {
      return NextResponse.json(
        { error: 'このカテゴリに属するメニューが存在するため削除できません' },
        { status: 400 }
      );
    }

    // 削除前の全カテゴリを取得（デバッグ用）
    const { data: beforeCategories } = await supabase
      .from('menu_categories')
      .select('category_id, name, display_order')
      .eq('store_id', storeId)
      .order('display_order', { ascending: true });

    console.log('削除前のカテゴリ一覧:', beforeCategories);

    // 削除するカテゴリの表示順を保存
    const deletedCategoryOrder = category.display_order;
    console.log('削除するカテゴリの表示順:', deletedCategoryOrder);

    // カテゴリを削除
    const { error: deleteError } = await supabase
      .from('menu_categories')
      .delete()
      .eq('category_id', category_id);

    if (deleteError) {
      console.error('カテゴリ削除エラー:', deleteError);
      return NextResponse.json(
        { error: 'カテゴリの削除に失敗しました' },
        { status: 500 }
      );
    }

    console.log('カテゴリを削除しました。カテゴリID:', category_id);

    // 全カテゴリを取得
    const { data: allCategories, error: fetchError } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('store_id', storeId)
      .order('display_order', { ascending: true });

    if (fetchError) {
      console.error('カテゴリ取得エラー:', fetchError);
      // エラーがあっても、カテゴリ自体は削除されているので成功として返す
    } else {
      console.log('全カテゴリ:', allCategories);

      if (allCategories && allCategories.length > 0) {
        console.log('カテゴリ数:', allCategories.length);

        // 更新が必要なカテゴリのリストを作成
        const categoriesToUpdate = [];

        for (let i = 0; i < allCategories.length; i++) {
          const category = allCategories[i];
          const newOrder = i + 1; // 1から始まる連番

          // 表示順が変わる場合のみリストに追加
          if (category.display_order !== newOrder) {
            console.log(`カテゴリ "${category.name}" の表示順を ${category.display_order} から ${newOrder} に更新します`);
            categoriesToUpdate.push({
              ...category,
              display_order: newOrder
            });
          }
        }

        // 更新が必要なカテゴリがある場合
        if (categoriesToUpdate.length > 0) {
          console.log('更新するカテゴリ数:', categoriesToUpdate.length);

          // 一括更新
          for (const category of categoriesToUpdate) {
            const { error: updateError } = await supabase
              .from('menu_categories')
              .update({ display_order: category.display_order })
              .eq('category_id', category.category_id);

            if (updateError) {
              console.error(`カテゴリ "${category.name}" の表示順更新エラー:`, updateError);
            } else {
              console.log(`カテゴリ "${category.name}" の表示順を ${category.display_order} に更新しました`);
            }

            // 更新間隔を空ける（競合を避けるため）
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } else {
          console.log('更新が必要なカテゴリはありません');
        }
      } else {
        console.log('カテゴリがありません');
      }
    }

    // 更新後の全カテゴリを取得（デバッグ用）
    const { data: afterCategories } = await supabase
      .from('menu_categories')
      .select('category_id, name, display_order')
      .eq('store_id', storeId)
      .order('display_order', { ascending: true });

    console.log('更新後のカテゴリ一覧:', afterCategories);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('カテゴリ削除エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
