-- seat_typesテーブルにstore_idカラムを追加
ALTER TABLE public.seat_types
ADD COLUMN store_id uuid REFERENCES public.stores(store_id) ON DELETE CASCADE;

-- 既存の席種データを移行するための一時的な処理
-- 既存のすべての席種を最初の店舗に紐づける
UPDATE public.seat_types
SET store_id = (SELECT store_id FROM public.stores LIMIT 1)
WHERE store_id IS NULL;

-- store_idカラムをNOT NULLに設定
ALTER TABLE public.seat_types
ALTER COLUMN store_id SET NOT NULL;

-- 店舗IDとコードの組み合わせでユニーク制約を設定
ALTER TABLE public.seat_types
DROP CONSTRAINT seat_types_code_key;

ALTER TABLE public.seat_types
ADD CONSTRAINT seat_types_store_id_code_key UNIQUE (store_id, code);

-- RLSポリシーの追加
ALTER TABLE public.seat_types ENABLE ROW LEVEL SECURITY;

-- 店舗管理者のみが席種を作成・編集・削除できるポリシー
CREATE POLICY seat_type_store_admin_all ON public.seat_types
  USING (store_id IN (
    SELECT store_id FROM public.store_users 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- 店舗スタッフは席種を閲覧のみ可能
CREATE POLICY seat_type_store_cast_select ON public.seat_types
  FOR SELECT
  USING (store_id IN (
    SELECT store_id FROM public.store_users 
    WHERE user_id = auth.uid()
  ));
