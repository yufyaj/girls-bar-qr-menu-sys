-- 短時間（1分未満）の場合でもテーブル料金が0円にならないように修正
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
  v_elapsed_minutes numeric;
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
  
  -- 一時停止中の場合は、現在時刻を一時停止時間に設定
  IF v_charge_pause_time IS NOT NULL THEN
    v_current_time := v_charge_pause_time;
  END IF;
  
  -- セッション席種イベントを時系列順に取得
  FOR v_event IN (
    SELECT 
      event_id,
      seat_type_id,
      price_snapshot,
      changed_at,
      is_table_move_charge
    FROM public.session_seat_events
    WHERE session_id = p_session_id
    ORDER BY changed_at ASC
  ) LOOP
    -- 席移動による料金記録の場合は、そのまま合計に加算
    IF v_event.is_table_move_charge THEN
      v_total_charge := v_total_charge + v_event.price_snapshot;
      -- 次のイベントの開始時間として現在のイベント時間を設定
      v_last_event_time := v_event.changed_at;
      CONTINUE;
    END IF;
    
    -- 最初のイベントの場合
    IF v_last_event_time IS NULL THEN
      v_last_event_time := v_charge_start_time;
    END IF;
    
    -- 席種IDを取得
    v_seat_type_id := v_event.seat_type_id;
    
    -- 席種の時間単位を取得
    SELECT time_unit_minutes INTO v_time_unit_minutes
    FROM public.seat_types
    WHERE seat_type_id = v_seat_type_id;
    
    -- 時間単位が無効な場合はデフォルトの30分を使用
    IF v_time_unit_minutes IS NULL OR v_time_unit_minutes <= 0 THEN
      v_time_unit_minutes := 30;
    END IF;
    
    -- イベント間の経過時間を計算（分単位）
    v_elapsed_minutes := extract(epoch FROM (v_event.changed_at - v_last_event_time)) / 60;
    
    -- 1分未満の場合は時間単位として扱う（最低料金）
    IF v_elapsed_minutes < 1 THEN
      v_rounded_minutes := v_time_unit_minutes;
    ELSE
      -- 時間単位で切り上げ
      v_rounded_minutes := CEILING(v_elapsed_minutes::numeric / v_time_unit_minutes) * v_time_unit_minutes;
    END IF;
    
    -- 時間単位の数を計算
    v_time_units := v_rounded_minutes / v_time_unit_minutes;
    
    -- 区間のチャージ金額を計算
    v_event_charge := v_time_units * v_event.price_snapshot;
    
    -- 合計に加算
    v_total_charge := v_total_charge + v_event_charge;
    
    -- 次のイベントの開始時間として現在のイベント時間を設定
    v_last_event_time := v_event.changed_at;
  END LOOP;
  
  -- 最後のイベントがない場合は開始時間を使用
  IF v_last_event_time IS NULL THEN
    v_last_event_time := v_charge_start_time;
    
    -- 最後のセッションの席種IDを取得
    SELECT t.seat_type_id INTO v_seat_type_id
    FROM public.sessions s
    JOIN public.tables t ON s.table_id = t.table_id
    WHERE s.session_id = p_session_id;
  END IF;
  
  -- 席種の時間単位を取得
  SELECT time_unit_minutes INTO v_time_unit_minutes
  FROM public.seat_types
  WHERE seat_type_id = v_seat_type_id;
  
  -- 時間単位が無効な場合はデフォルトの30分を使用
  IF v_time_unit_minutes IS NULL OR v_time_unit_minutes <= 0 THEN
    v_time_unit_minutes := 30;
  END IF;
  
  -- 最後のイベントから現在までの経過時間を計算（分単位）
  v_elapsed_minutes := extract(epoch FROM (v_current_time - v_last_event_time)) / 60;
  
  -- 1分未満の場合は時間単位として扱う（最低料金）
  IF v_elapsed_minutes < 1 THEN
    v_rounded_minutes := v_time_unit_minutes;
  ELSE
    -- 時間単位で切り上げ
    v_rounded_minutes := CEILING(v_elapsed_minutes::numeric / v_time_unit_minutes) * v_time_unit_minutes;
  END IF;
  
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

-- コメント追加
COMMENT ON FUNCTION public.fn_calc_total_charge(uuid) IS '短時間（1分未満）の場合でもテーブル料金が0円にならないように修正（2025/08/04）';
