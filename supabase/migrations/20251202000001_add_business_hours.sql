-- 店舗テーブルに営業時間カラムを追加
ALTER TABLE public.stores
ADD COLUMN open_time time DEFAULT '18:00',
ADD COLUMN close_time time DEFAULT '02:00';

-- 既存の店舗データに営業時間のデフォルト値を設定
UPDATE public.stores
SET open_time = '18:00',
    close_time = '02:00'
WHERE open_time IS NULL OR close_time IS NULL;

-- コメントを追加
COMMENT ON COLUMN public.stores.open_time IS '開店時間';
COMMENT ON COLUMN public.stores.close_time IS '閉店時間（深夜営業の場合は翌日の時間）';
