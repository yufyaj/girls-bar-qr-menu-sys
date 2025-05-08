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

    // カテゴリ一覧を取得
    const { data: categoryData, error: categoryError } = await supabase
      .from('menu_categories')
      .select('category_id, name, display_order, allow_treat_cast')
      .eq('store_id', table.store_id)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (categoryError) {
      console.error('カテゴリ一覧取得エラー:', categoryError);
      return NextResponse.json(
        { error: 'カテゴリ一覧の取得に失敗しました' },
        { status: 500 }
      );
    }

    // カテゴリIDとカテゴリ情報のマッピングを作成
    const categoryMap = new Map();
    const categoryAllowTreatMap = new Map();
    categoryData?.forEach(category => {
      categoryMap.set(category.category_id, category.name);
      categoryAllowTreatMap.set(category.category_id, category.allow_treat_cast);
    });

    // 店舗IDに紐づくメニュー一覧を取得（利用可能なもののみ）
    const { data: menuData, error: menusError } = await supabase
      .from('menus')
      .select('menu_id, product_id, name, description, price, image_url, category, category_id, is_available')
      .eq('store_id', table.store_id)
      .eq('is_available', true)
      .order('name', { ascending: true });

    if (menusError) {
      console.error('メニュー一覧取得エラー:', menusError);
      return NextResponse.json(
        { error: 'メニュー一覧の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 必要なデータのみを抽出して新しい配列を作成
    const menus = (menuData || []).map(item => ({
      menu_id: item.menu_id,
      product_id: item.product_id,
      name: item.name,
      description: item.description,
      price: item.price,
      image_url: item.image_url,
      category: item.category_id ? categoryMap.get(item.category_id) || item.category || '未分類' : (item.category || '未分類'),
      category_id: item.category_id,
      is_available: item.is_available,
      allow_treat_cast: item.category_id ? categoryAllowTreatMap.get(item.category_id) || false : false
    }));

    // カテゴリーごとにメニューをグループ化
    const menusByCategory: Record<string, any[]> = {};

    // まず、カテゴリテーブルに基づいて空の配列を作成（表示順を保持するため）
    const categoryInfoMap = new Map();
    categoryData?.forEach(category => {
      menusByCategory[category.name] = [];
      categoryInfoMap.set(category.name, {
        category_id: category.category_id,
        allow_treat_cast: category.allow_treat_cast
      });
    });

    // 未分類カテゴリを追加
    if (!menusByCategory['未分類']) {
      menusByCategory['未分類'] = [];
    }

    // メニューをカテゴリごとに振り分け
    menus.forEach(menu => {
      const categoryName = menu.category;
      if (!menusByCategory[categoryName]) {
        menusByCategory[categoryName] = [];
      }
      menusByCategory[categoryName].push(menu);
    });

    return NextResponse.json({
      menus,
      menusByCategory,
      categories: categoryData || []
    });
  } catch (error) {
    console.error('メニュー一覧取得エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
