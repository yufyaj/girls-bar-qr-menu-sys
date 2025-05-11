-- 席種テーブルからsmaregi_product_idカラムを削除
ALTER TABLE public.seat_types
DROP COLUMN IF EXISTS smaregi_product_id;

-- 関連するRLSポリシーを削除
DROP POLICY IF EXISTS "管理者のみsmaregi_product_idを更新可能" ON public.seat_types;
