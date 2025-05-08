-- メニュー画像用のストレージバケットを作成
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('menu-images', 'menu-images', true, false, 5242880, '{image/jpeg,image/png,image/webp,image/gif}')
ON CONFLICT (id) DO NOTHING;

-- メニュー画像バケットのRLSポリシーを設定
-- 誰でも閲覧可能
CREATE POLICY "メニュー画像は誰でも閲覧可能" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'menu-images');

-- 管理者のみアップロード可能
CREATE POLICY "管理者のみメニュー画像をアップロード可能" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'menu-images' AND
    EXISTS (
      SELECT 1 FROM public.store_users
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- 管理者のみ更新可能
CREATE POLICY "管理者のみメニュー画像を更新可能" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'menu-images' AND
    EXISTS (
      SELECT 1 FROM public.store_users
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- 管理者のみ削除可能
CREATE POLICY "管理者のみメニュー画像を削除可能" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'menu-images' AND
    EXISTS (
      SELECT 1 FROM public.store_users
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );
