-- チャージ計算用の関数を更新（price_per_30minをprice_per_unitに変更）
CREATE OR REPLACE FUNCTION public.fn_calc_total_charge(p_session_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_charge int := 0;
  v_current_time timestamptz := now();
  v_charge_start_time timestamptz;
  v_last_event_time timestamptz;
  v_event record;
  v_elapsed_minutes int;
  v_rounded_minutes int;
  v_half_hour_units int;
  v_event_charge int;
BEGIN
  -- セッションの開始時間を取得
  SELECT charge_started_at INTO v_charge_start_time
  FROM public.sessions
  WHERE session_id = p_session_id;
  
  -- チャージ開始時間が設定されていない場合は0を返す
  IF v_charge_start_time IS NULL THEN
    RETURN 0;
  END IF;
  
  -- セッション席種イベントを時系列順に取得
  FOR v_event IN (
    SELECT 
      event_id,
      seat_type_id,
      price_snapshot,
      changed_at
    FROM public.session_seat_events
    WHERE session_id = p_session_id
    ORDER BY changed_at ASC
  ) LOOP
    -- 最初のイベントの場合
    IF v_last_event_time IS NULL THEN
      v_last_event_time := v_charge_start_time;
    END IF;
    
    -- イベント間の経過時間を計算（分単位）
    v_elapsed_minutes := extract(epoch FROM (v_event.changed_at - v_last_event_time)) / 60;
    
    -- 30分単位で切り上げ
    v_rounded_minutes := ceiling(v_elapsed_minutes::numeric / 30) * 30;
    
    -- 30分単位の数を計算
    v_half_hour_units := v_rounded_minutes / 30;
    
    -- 区間のチャージ金額を計算
    v_event_charge := v_half_hour_units * v_event.price_snapshot;
    
    -- 合計に加算
    v_total_charge := v_total_charge + v_event_charge;
    
    -- 次のイベントの開始時間として現在のイベント時間を設定
    v_last_event_time := v_event.changed_at;
  END LOOP;
  
  -- 最後のイベントから現在までの経過時間を計算（分単位）
  v_elapsed_minutes := extract(epoch FROM (v_current_time - v_last_event_time)) / 60;
  
  -- 30分単位で切り上げ
  v_rounded_minutes := ceiling(v_elapsed_minutes::numeric / 30) * 30;
  
  -- 30分単位の数を計算
  v_half_hour_units := v_rounded_minutes / 30;
  
  -- 最後の区間のチャージ金額を計算
  v_event_charge := v_half_hour_units * (
    SELECT price_snapshot 
    FROM public.session_seat_events 
    WHERE session_id = p_session_id 
    ORDER BY changed_at DESC 
    LIMIT 1
  );
  
  -- 合計に加算
  v_total_charge := v_total_charge + v_event_charge;
  
  RETURN v_total_charge;
END;
$$;

-- セッション開始時に席種スナップショットを作成する関数を更新
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
      st.price_per_unit,
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

-- テーブルの席種変更時にセッション席種スナップショットを作成する関数を更新
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
      st.price_per_unit,
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
