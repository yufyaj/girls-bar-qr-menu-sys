-- seat_typesテーブルにsmaregi_product_idカラムを追加
ALTER TABLE public.seat_types
ADD COLUMN smaregi_product_id TEXT;

-- 既存のレコードにはNULLを設定（デフォルト値）

-- RLSポリシーの更新
CREATE POLICY "管理者のみsmaregi_product_idを更新可能" ON public.seat_types
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.store_users
      WHERE user_id = auth.uid()
      AND store_id = seat_types.store_id
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.store_users
      WHERE user_id = auth.uid()
      AND store_id = seat_types.store_id
      AND role = 'admin'
    )
  );
