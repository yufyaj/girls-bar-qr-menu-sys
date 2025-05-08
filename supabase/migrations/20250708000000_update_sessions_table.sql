-- sessionsテーブルに新しいフィールドを追加
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS selected_cast_id UUID REFERENCES auth.users(id);
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS is_new_customer BOOLEAN;
