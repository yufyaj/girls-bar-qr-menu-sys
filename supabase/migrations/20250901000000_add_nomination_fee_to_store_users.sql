-- store_usersテーブルにnomination_fee（指名料）カラムを追加
ALTER TABLE public.store_users ADD COLUMN IF NOT EXISTS nomination_fee INTEGER NOT NULL DEFAULT 0;

-- 既存のキャストデータの指名料は0円に設定
UPDATE public.store_users
SET nomination_fee = 0
WHERE role = 'cast' AND nomination_fee IS NULL;

-- RLSポリシーは既に正しく設定されているため、更新は不要
