-- メニューカテゴリテーブルの作成
CREATE TABLE IF NOT EXISTS public.menu_categories (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, name)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_menu_categories_store_id ON public.menu_categories(store_id);

-- RLSの有効化
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

-- RLSポリシーの作成
-- 匿名ユーザーも閲覧可能
CREATE POLICY "メニューカテゴリ情報は誰でも閲覧可能" ON public.menu_categories
  FOR SELECT USING (true);

-- 自分が所属する店舗のメニューカテゴリ情報のみ編集可能
CREATE POLICY "自分が所属する店舗のメニューカテゴリ情報のみ編集可能" ON public.menu_categories
  FOR ALL USING (
    store_id IN (
      SELECT store_id FROM public.store_users WHERE user_id = auth.uid()
    )
  );

-- menusテーブルにcategory_idカラムを追加
ALTER TABLE public.menus ADD COLUMN category_id UUID REFERENCES public.menu_categories(category_id);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_menus_category_id ON public.menus(category_id);
