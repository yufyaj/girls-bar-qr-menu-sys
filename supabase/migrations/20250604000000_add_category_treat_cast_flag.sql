-- menu_categoriesテーブルにallow_treat_castカラムを追加
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS allow_treat_cast BOOLEAN NOT NULL DEFAULT false;

-- order_itemsテーブルにtarget_cast_idカラムを再追加（スタッフドリンク機能削除で削除されていた場合）
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS target_cast_id UUID REFERENCES auth.users(id);
