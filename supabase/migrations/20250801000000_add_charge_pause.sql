-- sessionsテーブルにcharge_paused_atフィールドを追加
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS charge_paused_at TIMESTAMPTZ;

-- チャージ計算用の関数を更新（charge_paused_atを考慮）
CREATE OR REPLACE FUNCTION public.fn_calc_total_charge(p_session_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_charge int := 0;
  v_current_time timestamptz := now();
  v_charge_start_time timestamptz;
  v_charge_pause_time timestamptz;
  v_last_event_time timestamptz;
  v_event record;
  v_elapsed_minutes int;
  v_rounded_minutes int;
  v_time_units int;
  v_event_charge int;
  v_time_unit_minutes int;
  v_seat_type_id uuid;
BEGIN
  -- セッションの開始時間と一時停止時間を取得
  SELECT charge_started_at, charge_paused_at INTO v_charge_start_time, v_charge_pause_time
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
    
    -- 一時停止中の場合、計算終了時間を一時停止時間にする
    IF v_charge_pause_time IS NOT NULL AND v_charge_pause_time > v_last_event_time AND v_charge_pause_time < v_event.changed_at THEN
      -- イベント間の経過時間を計算（分単位）- 一時停止時間まで
      v_elapsed_minutes := EXTRACT(epoch FROM (v_charge_pause_time - v_last_event_time)) / 60;
    ELSE
      -- イベント間の経過時間を計算（分単位）
      v_elapsed_minutes := EXTRACT(epoch FROM (v_event.changed_at - v_last_event_time)) / 60;
    END IF;
    
    -- 席種の時間単位を取得
    SELECT time_unit_minutes INTO v_time_unit_minutes
    FROM public.seat_types
    WHERE seat_type_id = v_event.seat_type_id;
    
    -- 時間単位が設定されていない場合はデフォルト値（30分）を使用
    IF v_time_unit_minutes IS NULL OR v_time_unit_minutes <= 0 THEN
      v_time_unit_minutes := 30;
    END IF;
    
    -- 時間単位で切り上げ
    v_rounded_minutes := CEILING(v_elapsed_minutes::numeric / v_time_unit_minutes) * v_time_unit_minutes;
    
    -- 時間単位の数を計算
    v_time_units := v_rounded_minutes / v_time_unit_minutes;
    
    -- 区間のチャージ金額を計算
    v_event_charge := v_time_units * v_event.price_snapshot;
    
    -- 合計に加算
    v_total_charge := v_total_charge + v_event_charge;
    
    -- 次のイベントの開始時間を設定
    v_last_event_time := v_event.changed_at;
    
    -- 一時停止中の場合、それ以降の計算は行わない
    IF v_charge_pause_time IS NOT NULL AND v_charge_pause_time <= v_event.changed_at THEN
      RETURN v_total_charge;
    END IF;
  END LOOP;
  
  -- 最後のイベントから現在（または一時停止時間）までの経過時間を計算
  IF v_last_event_time IS NULL THEN
    -- イベントがない場合は開始時間から計算
    v_last_event_time := v_charge_start_time;
  END IF;
  
  -- 最後の席種IDを取得
  SELECT seat_type_id INTO v_seat_type_id
  FROM public.session_seat_events
  WHERE session_id = p_session_id
  ORDER BY changed_at DESC
  LIMIT 1;
  
  -- 席種の時間単位を取得
  SELECT time_unit_minutes INTO v_time_unit_minutes
  FROM public.seat_types
  WHERE seat_type_id = v_seat_type_id;
  
  -- 時間単位が設定されていない場合はデフォルト値（30分）を使用
  IF v_time_unit_minutes IS NULL OR v_time_unit_minutes <= 0 THEN
    v_time_unit_minutes := 30;
  END IF;
  
  -- 一時停止中の場合、計算終了時間を一時停止時間にする
  IF v_charge_pause_time IS NOT NULL THEN
    -- 一時停止時間が最後のイベント時間より前の場合は計算しない
    IF v_charge_pause_time <= v_last_event_time THEN
      RETURN v_total_charge;
    END IF;
    
    -- 最後のイベントから一時停止時間までの経過時間を計算（分単位）
    v_elapsed_minutes := EXTRACT(epoch FROM (v_charge_pause_time - v_last_event_time)) / 60;
  ELSE
    -- 最後のイベントから現在までの経過時間を計算（分単位）
    v_elapsed_minutes := EXTRACT(epoch FROM (v_current_time - v_last_event_time)) / 60;
  END IF;
  
  -- 時間単位で切り上げ
  v_rounded_minutes := CEILING(v_elapsed_minutes::numeric / v_time_unit_minutes) * v_time_unit_minutes;
  
  -- 時間単位の数を計算
  v_time_units := v_rounded_minutes / v_time_unit_minutes;
  
  -- 最後の区間のチャージ金額を計算
  v_event_charge := v_time_units * (
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
