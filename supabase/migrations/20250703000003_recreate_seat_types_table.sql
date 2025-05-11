-- 席種テーブルを再作成するマイグレーション
-- 依存関係の問題を回避するため、テーブルを再作成する方法

-- 既存のデータを一時テーブルに保存
CREATE TEMP TABLE temp_seat_types AS
SELECT
  seat_type_id AS old_seat_type_id,
  code AS new_seat_type_id,
  store_id,
  display_name,
  price_per_30min,
  created_at
FROM public.seat_types;

-- 依存するビューを特定して削除
DO $$
DECLARE
  view_record RECORD;
BEGIN
  -- 依存するビューを検索して削除
  FOR view_record IN
    SELECT viewname, schemaname
    FROM pg_views
    WHERE schemaname = 'public'
  LOOP
    EXECUTE 'DROP VIEW IF EXISTS ' || view_record.schemaname || '.' || view_record.viewname || ' CASCADE';
    RAISE NOTICE 'Dropped view: %.%', view_record.schemaname, view_record.viewname;
  END LOOP;
END $$;

-- 依存するマテリアライズドビューを特定して削除
DO $$
DECLARE
  mview_record RECORD;
BEGIN
  -- 依存するマテリアライズドビューを検索して削除
  FOR mview_record IN
    SELECT matviewname, schemaname
    FROM pg_matviews
    WHERE schemaname = 'public'
  LOOP
    EXECUTE 'DROP MATERIALIZED VIEW IF EXISTS ' || mview_record.schemaname || '.' || mview_record.matviewname || ' CASCADE';
    RAISE NOTICE 'Dropped materialized view: %.%', mview_record.schemaname, mview_record.matviewname;
  END LOOP;
END $$;

-- 関連テーブルの外部キー制約を一時的に削除
ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS tables_seat_type_id_fkey;
ALTER TABLE public.session_seat_events DROP CONSTRAINT IF EXISTS session_seat_events_seat_type_id_fkey;

-- 既存のRLSポリシーを削除
DROP POLICY IF EXISTS seat_type_store_admin_all ON public.seat_types;
DROP POLICY IF EXISTS seat_type_store_cast_select ON public.seat_types;

-- 新しい席種テーブルを作成（一時的な名前）
CREATE TABLE public.seat_types_new (
  seat_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(store_id) ON DELETE CASCADE NOT NULL,
  display_name TEXT NOT NULL,
  price_per_30min INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 店舗IDと席種IDの組み合わせでユニーク制約を設定
ALTER TABLE public.seat_types_new
ADD CONSTRAINT seat_types_new_store_id_seat_type_id_key UNIQUE (store_id, seat_type_id);

-- 既存のデータを新しいテーブルに移行
INSERT INTO public.seat_types_new (seat_type_id, store_id, display_name, price_per_30min, created_at)
SELECT
  new_seat_type_id AS seat_type_id,
  store_id,
  display_name,
  price_per_30min,
  created_at
FROM temp_seat_types;

-- 既存のテーブルデータをバックアップ
CREATE TEMP TABLE temp_tables AS
SELECT * FROM public.tables;

CREATE TEMP TABLE temp_session_seat_events AS
SELECT * FROM public.session_seat_events;

-- 関連テーブルを一時的に削除（依存関係を解消）
DROP TABLE IF EXISTS public.tables CASCADE;
DROP TABLE IF EXISTS public.session_seat_events CASCADE;

-- テーブルテーブルを再作成（seat_type_idをUUID型に変更）
CREATE TABLE public.tables (
  table_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(store_id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  seat_type_id UUID NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- セッション席種イベントテーブルを再作成（seat_type_idをUUID型に変更）
CREATE TABLE public.session_seat_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(session_id) ON DELETE CASCADE NOT NULL,
  seat_type_id UUID NULL,
  price_snapshot INTEGER NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 古いテーブルを削除し、新しいテーブルをリネーム
DROP TABLE public.seat_types CASCADE;
ALTER TABLE public.seat_types_new RENAME TO seat_types;

-- テーブルデータを復元
INSERT INTO public.tables (table_id, store_id, name, seat_type_id, created_at)
SELECT
  tt.table_id,
  tt.store_id,
  tt.name,
  ts.new_seat_type_id,
  tt.created_at
FROM temp_tables tt
LEFT JOIN temp_seat_types ts ON tt.seat_type_id::text = ts.old_seat_type_id::text;

-- セッション席種イベントデータを復元
INSERT INTO public.session_seat_events (event_id, session_id, seat_type_id, price_snapshot, changed_at, created_at)
SELECT
  tsse.event_id,
  tsse.session_id,
  ts.new_seat_type_id,
  tsse.price_snapshot,
  tsse.changed_at,
  tsse.created_at
FROM temp_session_seat_events tsse
LEFT JOIN temp_seat_types ts ON tsse.seat_type_id::text = ts.old_seat_type_id::text;

-- 外部キー制約を再作成
ALTER TABLE public.tables
ADD CONSTRAINT tables_seat_type_id_fkey
FOREIGN KEY (seat_type_id) REFERENCES public.seat_types(seat_type_id);

ALTER TABLE public.session_seat_events
ADD CONSTRAINT session_seat_events_seat_type_id_fkey
FOREIGN KEY (seat_type_id) REFERENCES public.seat_types(seat_type_id);

-- RLSポリシーの再作成
ALTER TABLE public.seat_types ENABLE ROW LEVEL SECURITY;

-- 店舗管理者のみが席種を作成・編集・削除できるポリシー
CREATE POLICY seat_type_store_admin_all ON public.seat_types
  USING (store_id IN (
    SELECT store_id FROM public.store_users
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- 店舗スタッフは席種を閲覧のみ可能
CREATE POLICY seat_type_store_cast_select ON public.seat_types
  FOR SELECT
  USING (store_id IN (
    SELECT store_id FROM public.store_users
    WHERE user_id = auth.uid()
  ));

-- 一時テーブルを削除
DROP TABLE temp_seat_types;

-- データベース型定義の更新に関するコメント
COMMENT ON COLUMN public.seat_types.seat_type_id IS 'システム内部で使用する一意のID（UUID自動生成）';
