-- テーブル利用状況ビューを更新（time_unit_minutesを参照するように変更）
CREATE OR REPLACE VIEW public.v_table_usage AS
SELECT
  s.store_id,
  st.name AS store_name,
  t.table_id,
  t.name AS table_name,
  st2.display_name AS seat_type,
  st2.price_per_unit,
  st2.time_unit_minutes,
  s.session_id,
  s.start_at,
  s.charge_started_at,
  CASE
    WHEN s.charge_started_at IS NOT NULL THEN
      EXTRACT(epoch FROM (now() - s.charge_started_at)) / 60
    ELSE
      0
  END AS elapsed_minutes,
  CASE
    WHEN s.charge_started_at IS NOT NULL THEN
      CEILING(EXTRACT(epoch FROM (now() - s.charge_started_at)) / 60 / st2.time_unit_minutes) * st2.time_unit_minutes
    ELSE
      0
  END AS rounded_minutes,
  CASE
    WHEN s.charge_started_at IS NOT NULL THEN
      CEILING(EXTRACT(epoch FROM (now() - s.charge_started_at)) / 60 / st2.time_unit_minutes) * st2.price_per_unit
    ELSE
      0
  END AS current_charge
FROM
  public.sessions s
  JOIN public.tables t ON s.table_id = t.table_id
  JOIN public.stores st ON s.store_id = st.store_id
  JOIN public.seat_types st2 ON t.seat_type_id = st2.seat_type_id
WHERE
  s.charge_started_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.checkouts c
    WHERE c.session_id = s.session_id AND c.status = 'completed'
  );
