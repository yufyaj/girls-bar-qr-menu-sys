-- store_usersテーブルにdisplay_nameカラムを追加
ALTER TABLE public.store_users
ADD COLUMN display_name text;

-- 既存のキャストデータにはメールアドレスの@前の部分を名前として設定
UPDATE public.store_users su
SET display_name = (
  SELECT split_part(email, '@', 1)
  FROM auth.users
  WHERE id = su.user_id
)
WHERE role = 'cast';

-- RLSポリシーは既に正しく設定されているため、更新は不要
