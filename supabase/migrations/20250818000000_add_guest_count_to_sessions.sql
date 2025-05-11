-- sessionsテーブルにguest_countカラムを追加
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS guest_count INTEGER DEFAULT 1;
