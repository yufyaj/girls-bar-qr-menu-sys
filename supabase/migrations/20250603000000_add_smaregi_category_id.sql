-- menu_categoriesテーブルにsmaregi_category_idカラムを追加
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS smaregi_category_id TEXT;

-- smaregi_category_idにインデックスを作成
CREATE INDEX IF NOT EXISTS idx_menu_categories_smaregi_category_id ON public.menu_categories(smaregi_category_id);

-- store_idとsmaregi_category_idの組み合わせに一意制約を追加
ALTER TABLE public.menu_categories ADD CONSTRAINT unique_store_smaregi_category_id UNIQUE (store_id, smaregi_category_id) DEFERRABLE INITIALLY DEFERRED;
