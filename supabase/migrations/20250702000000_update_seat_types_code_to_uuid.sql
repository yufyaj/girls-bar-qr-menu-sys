-- UUID拡張機能が有効化されていることを確認
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 既存のデータを一時的に保存するための一時テーブルを作成
CREATE TEMP TABLE temp_seat_types AS
SELECT * FROM public.seat_types;

-- 既存のユニーク制約を削除
ALTER TABLE public.seat_types
DROP CONSTRAINT IF EXISTS seat_types_store_id_code_key;

-- codeカラムの型をUUIDに変更し、デフォルト値を設定
-- まず既存のcodeカラムを削除
ALTER TABLE public.seat_types
DROP COLUMN code;

-- 次にUUID型のcodeカラムを追加（sessionsテーブルと同様にgen_random_uuid()を使用）
ALTER TABLE public.seat_types
ADD COLUMN code UUID DEFAULT gen_random_uuid() NOT NULL;

-- 既存のデータを更新（既存のコードはそのまま保持できないため、新しいUUIDを生成）
UPDATE public.seat_types st
SET code = gen_random_uuid()
FROM temp_seat_types tt
WHERE st.seat_type_id = tt.seat_type_id;

-- 店舗IDとコードの組み合わせでユニーク制約を再設定
ALTER TABLE public.seat_types
ADD CONSTRAINT seat_types_store_id_code_key UNIQUE (store_id, code);

-- 一時テーブルを削除
DROP TABLE temp_seat_types;

-- データベース型定義の更新に関するコメント
COMMENT ON COLUMN public.seat_types.code IS 'システム内部で使用する一意のコード（UUID自動生成）';
