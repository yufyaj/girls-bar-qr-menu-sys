-- チャージ計算用の関数
create or replace function public.fn_calc_total_charge(p_session_id uuid)
returns int
language plpgsql
security definer
as $$
declare
  v_total_charge int := 0;
  v_current_time timestamptz := now();
  v_charge_start_time timestamptz;
  v_last_event_time timestamptz;
  v_event record;
  v_elapsed_minutes int;
  v_rounded_minutes int;
  v_half_hour_units int;
  v_event_charge int;
begin
  -- セッションの開始時間を取得
  select charge_started_at into v_charge_start_time
  from public.sessions
  where session_id = p_session_id;

  -- チャージ開始時間が設定されていない場合は0を返す
  if v_charge_start_time is null then
    return 0;
  end if;

  -- セッション席種イベントを時系列順に取得
  for v_event in (
    select
      event_id,
      seat_type_id,
      price_snapshot,
      changed_at
    from public.session_seat_events
    where session_id = p_session_id
    order by changed_at asc
  ) loop
    -- 最初のイベントの場合
    if v_last_event_time is null then
      v_last_event_time := v_charge_start_time;
    end if;

    -- イベント間の経過時間を計算（分単位）
    v_elapsed_minutes := extract(epoch from (v_event.changed_at - v_last_event_time)) / 60;

    -- 30分単位で切り上げ
    v_rounded_minutes := ceiling(v_elapsed_minutes::numeric / 30) * 30;

    -- 30分単位の数を計算
    v_half_hour_units := v_rounded_minutes / 30;

    -- 区間のチャージ金額を計算
    v_event_charge := v_half_hour_units * (
      select price_per_unit
      from public.seat_types
      where seat_type_id = v_event.seat_type_id
    );

    -- 合計に加算
    v_total_charge := v_total_charge + v_event_charge;

    -- 次のイベントの開始時間として現在のイベント時間を設定
    v_last_event_time := v_event.changed_at;
  end loop;

  -- 最後のイベントから現在までの経過時間を計算
  if v_last_event_time is null then
    -- イベントがない場合は開始時間から現在までを計算
    v_last_event_time := v_charge_start_time;
  end if;

  -- 最後のイベントから現在までの経過時間を計算（分単位）
  v_elapsed_minutes := extract(epoch from (v_current_time - v_last_event_time)) / 60;

  -- 30分単位で切り上げ
  v_rounded_minutes := ceiling(v_elapsed_minutes::numeric / 30) * 30;

  -- 30分単位の数を計算
  v_half_hour_units := v_rounded_minutes / 30;

  -- 最後の区間のチャージ金額を計算
  v_event_charge := v_half_hour_units * (
    select price_per_unit
    from public.seat_types
    where seat_type_id = (
      select seat_type_id
      from public.session_seat_events
      where session_id = p_session_id
      order by changed_at desc
      limit 1
    )
  );

  -- 合計に加算
  v_total_charge := v_total_charge + v_event_charge;

  return v_total_charge;
end;
$$;

-- セッション開始時に席種スナップショットを作成する関数
create or replace function public.fn_create_session_seat_snapshot()
returns trigger
language plpgsql
security definer
as $$
begin
  -- チャージ開始時に席種スナップショットを作成
  if new.charge_started_at is not null and (old.charge_started_at is null or old.charge_started_at <> new.charge_started_at) then
    insert into public.session_seat_events (
      session_id,
      seat_type_id,
      price_snapshot,
      changed_at
    )
    select
      new.session_id,
      t.seat_type_id,
      st.price_per_unit,
      new.charge_started_at
    from
      public.tables t
      join public.seat_types st on t.seat_type_id = st.seat_type_id
    where
      t.table_id = new.table_id;
  end if;

  return new;
end;
$$;

-- セッション更新時のトリガー
create trigger trg_session_update
after update on public.sessions
for each row
execute function public.fn_create_session_seat_snapshot();

-- テーブルの席種変更時にセッション席種スナップショットを作成する関数
create or replace function public.fn_create_table_seat_change_snapshot()
returns trigger
language plpgsql
security definer
as $$
begin
  -- 席種が変更された場合
  if new.seat_type_id <> old.seat_type_id then
    -- アクティブなセッションがあれば席種スナップショットを作成
    insert into public.session_seat_events (
      session_id,
      seat_type_id,
      price_snapshot,
      changed_at
    )
    select
      s.session_id,
      new.seat_type_id,
      st.price_per_unit,
      now()
    from
      public.sessions s
      join public.seat_types st on st.seat_type_id = new.seat_type_id
    where
      s.table_id = new.table_id
      and s.charge_started_at is not null;
  end if;

  return new;
end;
$$;

-- テーブル更新時のトリガー
create trigger trg_table_update
after update on public.tables
for each row
execute function public.fn_create_table_seat_change_snapshot();
