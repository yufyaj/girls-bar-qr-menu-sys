-- スタッフドリンク機能の削除

-- 依存関係のあるビューを先に削除
DROP VIEW IF EXISTS public.v_staff_drinks;

-- menusテーブルからis_staff_drinkカラムを削除
ALTER TABLE public.menus DROP COLUMN IF EXISTS is_staff_drink;

-- order_itemsテーブルからtarget_cast_idカラムを削除
ALTER TABLE public.order_items DROP COLUMN IF EXISTS target_cast_id;
