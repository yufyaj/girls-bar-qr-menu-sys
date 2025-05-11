-- テーブル移動時の料金計算問題を最終的に修正
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
  v_price_snapshot int;
  v_last_move_charge_time timestamptz;
  v_has_move_charge boolean := false;
  v_next_event_after_move record;
  v_move_charge_count int := 0;
  v_session_start_time timestamptz;
BEGIN
  -- セッションの開始時間と一時停止時間を取得
  SELECT start_at, charge_started_at, charge_paused_at 
  INTO v_session_start_time, v_charge_start_time, v_charge_pause_time
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
  
  -- 席移動料金イベントの数を取得
  SELECT COUNT(*) INTO v_move_charge_count
  FROM public.session_seat_events
  WHERE session_id = p_session_id AND is_table_move_charge = true;
  
  -- 最後の席移動料金イベントの時間を取得（存在する場合）
  SELECT MAX(changed_at) INTO v_last_move_charge_time
  FROM public.session_seat_events
  WHERE session_id = p_session_id AND is_table_move_charge = true;
  
  IF v_last_move_charge_time IS NOT NULL THEN
    v_has_move_charge := true;
    
    -- 席移動後の最初のイベント（移動先テーブルの席種情報）を取得
    SELECT 
      event_id,
      seat_type_id,
      price_snapshot,
      changed_at,
      is_table_move_charge
    INTO v_next_event_after_move
    FROM public.session_seat_events
    WHERE 
      session_id = p_session_id AND 
      changed_at > v_last_move_charge_time AND
      is_table_move_charge = false
    ORDER BY changed_at ASC
    LIMIT 1;
  END IF;
  
  -- 席移動料金のみを合計に加算
  SELECT COALESCE(SUM(price_snapshot), 0) INTO v_total_charge
  FROM public.session_seat_events
  WHERE session_id = p_session_id AND is_table_move_charge = true;
  
  -- 最後のイベントの情報を取得（席移動料金イベントを除く）
  SELECT 
    seat_type_id,
    price_snapshot,
    changed_at
  INTO 
    v_seat_type_id,
    v_price_snapshot,
    v_last_event_time
  FROM public.session_seat_events
  WHERE 
    session_id = p_session_id AND 
    is_table_move_charge = false
  ORDER BY changed_at DESC
  LIMIT 1;
  
  -- 席移動直後（0分）の場合は、移動先テーブルの料金を計算しない
  IF v_has_move_charge AND v_next_event_after_move IS NOT NULL AND 
     v_last_event_time = v_next_event_after_move.changed_at THEN
    -- 最後のイベントから現在までの経過時間を計算（分単位）
    v_elapsed_minutes := extract(epoch FROM (v_current_time - v_last_event_time)) / 60;
    
    -- 1分未満の場合は、移動先テーブルの料金を加算しない
    IF v_elapsed_minutes < 1 THEN
      RETURN v_total_charge; -- 席移動料金のみを返す
    END IF;
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
  v_event_charge := v_time_units * v_price_snapshot;
  
  -- 合計に加算
  v_total_charge := v_total_charge + v_event_charge;
  
  RETURN v_total_charge;
END;
$$;

-- コメント追加
COMMENT ON FUNCTION public.fn_calc_total_charge(uuid) IS 'テーブル移動時の料金計算問題を最終的に修正（2025/08/09）';
