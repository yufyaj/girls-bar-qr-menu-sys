-- storesテーブルに設定カラムを追加
ALTER TABLE public.stores
ADD COLUMN enable_cast_management boolean NOT NULL DEFAULT true,
ADD COLUMN enable_smaregi_integration boolean NOT NULL DEFAULT true;

-- 既存の店舗データを更新
UPDATE public.stores
SET enable_cast_management = true,
    enable_smaregi_integration = true;

-- 新しいカラムに対するRLSポリシーを追加
CREATE POLICY "管理者のみ店舗設定を更新可能" ON public.stores
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.store_users
      WHERE user_id = auth.uid()
      AND store_id = stores.store_id
      AND role = 'admin'
    )
  );
