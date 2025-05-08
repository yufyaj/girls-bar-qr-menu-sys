-- sessionsテーブルの外部キー制約を再作成するマイグレーション

-- sessionsテーブルのtable_idの外部キー制約を再作成
ALTER TABLE public.sessions
DROP CONSTRAINT IF EXISTS sessions_table_id_fkey;

ALTER TABLE public.sessions
ADD CONSTRAINT sessions_table_id_fkey
FOREIGN KEY (table_id) REFERENCES public.tables(table_id) ON DELETE CASCADE;

-- 関連するトリガー関数を更新
CREATE OR REPLACE FUNCTION public.fn_create_session_seat_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- チャージ開始時に席種スナップショットを作成
  IF NEW.charge_started_at IS NOT NULL AND (OLD.charge_started_at IS NULL OR OLD.charge_started_at <> NEW.charge_started_at) THEN
    INSERT INTO public.session_seat_events (
      session_id,
      seat_type_id,
      price_snapshot,
      changed_at
    )
    SELECT
      NEW.session_id,
      t.seat_type_id,
      st.price_per_30min,
      NEW.charge_started_at
    FROM
      public.tables t
      JOIN public.seat_types st ON t.seat_type_id = st.seat_type_id
    WHERE
      t.table_id = NEW.table_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- テーブルの席種変更時にセッション席種スナップショットを作成する関数
CREATE OR REPLACE FUNCTION public.fn_create_table_seat_change_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 席種が変更された場合
  IF NEW.seat_type_id <> OLD.seat_type_id THEN
    -- アクティブなセッションがあれば席種スナップショットを作成
    INSERT INTO public.session_seat_events (
      session_id,
      seat_type_id,
      price_snapshot,
      changed_at
    )
    SELECT
      s.session_id,
      NEW.seat_type_id,
      st.price_per_30min,
      NOW()
    FROM
      public.sessions s
      JOIN public.seat_types st ON st.seat_type_id = NEW.seat_type_id
    WHERE
      s.table_id = NEW.table_id
      AND s.charge_started_at IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- テーブル更新時のトリガーを再作成
DROP TRIGGER IF EXISTS trg_table_update ON public.tables;

CREATE TRIGGER trg_table_update
AFTER UPDATE ON public.tables
FOR EACH ROW
EXECUTE FUNCTION public.fn_create_table_seat_change_snapshot();
