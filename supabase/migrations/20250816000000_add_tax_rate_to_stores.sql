-- stores テーブルに tax_rate カラムを追加
ALTER TABLE public.stores
ADD COLUMN tax_rate NUMERIC(5, 2) DEFAULT 10.0 NOT NULL;

-- 既存のレコードには 10.0% をデフォルト値として設定

-- RLSポリシーの更新
CREATE POLICY "管理者のみtax_rateを更新可能" ON public.stores
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.store_users
      WHERE user_id = auth.uid()
      AND store_id = stores.store_id
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.store_users
      WHERE user_id = auth.uid()
      AND store_id = stores.store_id
      AND role = 'admin'
    )
  );
