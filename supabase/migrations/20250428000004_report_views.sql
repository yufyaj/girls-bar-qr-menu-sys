-- 日次売上レポート用ビュー
create or replace view public.v_daily_sales as
select
  c.store_id,
  s.name as store_name,
  date_trunc('day', c.created_at) as sales_date,
  count(distinct c.checkout_id) as checkout_count,
  sum(c.total_amount) as total_sales,
  sum(c.charge_amount) as charge_sales,
  sum(c.order_amount) as order_sales
from
  public.checkouts c
  join public.stores s on c.store_id = s.store_id
where
  c.status = 'completed'
group by
  c.store_id,
  s.name,
  date_trunc('day', c.created_at);

-- スタッフドリンク集計用ビュー
create or replace view public.v_staff_drinks as
select
  o.store_id,
  s.name as store_name,
  date_trunc('day', o.created_at) as sales_date,
  oi.target_cast_id,
  u.email as cast_email,
  count(oi.order_item_id) as drink_count,
  sum(oi.price * oi.quantity) as drink_sales
from
  public.order_items oi
  join public.orders o on oi.order_id = o.order_id
  join public.stores s on o.store_id = s.store_id
  left join auth.users u on oi.target_cast_id = u.id
where
  oi.target_cast_id is not null
  and o.status not in ('cancel')
group by
  o.store_id,
  s.name,
  date_trunc('day', o.created_at),
  oi.target_cast_id,
  u.email;

-- テーブル利用状況ビュー
create or replace view public.v_table_usage as
select
  s.store_id,
  st.name as store_name,
  t.table_id,
  t.name as table_name,
  st2.display_name as seat_type,
  st2.price_per_30min,
  s.session_id,
  s.start_at,
  s.charge_started_at,
  case
    when s.charge_started_at is not null then
      extract(epoch from (now() - s.charge_started_at)) / 60
    else
      0
  end as elapsed_minutes,
  case
    when s.charge_started_at is not null then
      ceiling(extract(epoch from (now() - s.charge_started_at)) / 60 / 30) * 30
    else
      0
  end as rounded_minutes,
  case
    when s.charge_started_at is not null then
      ceiling(extract(epoch from (now() - s.charge_started_at)) / 60 / 30) * st2.price_per_30min
    else
      0
  end as current_charge
from
  public.sessions s
  join public.tables t on s.table_id = t.table_id
  join public.stores st on s.store_id = st.store_id
  join public.seat_types st2 on t.seat_type_id = st2.seat_type_id
where
  s.charge_started_at is not null
  and not exists (
    select 1 from public.checkouts c
    where c.session_id = s.session_id and c.status = 'completed'
  );

-- 注文ステータス集計ビュー
create or replace view public.v_order_status as
select
  o.store_id,
  s.name as store_name,
  o.status,
  count(*) as order_count
from
  public.orders o
  join public.stores s on o.store_id = s.store_id
where
  o.created_at > now() - interval '24 hours'
group by
  o.store_id,
  s.name,
  o.status;
