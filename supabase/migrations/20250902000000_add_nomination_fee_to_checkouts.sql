-- checkoutsテーブルにnomination_fee（指名料）カラムを追加
ALTER TABLE public.checkouts ADD COLUMN IF NOT EXISTS nomination_fee INTEGER NOT NULL DEFAULT 0;

-- 既存のレコードの指名料は0円に設定
UPDATE public.checkouts
SET nomination_fee = 0
WHERE nomination_fee IS NULL;
