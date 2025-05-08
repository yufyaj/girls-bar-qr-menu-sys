-- 初期スキーマ作成
-- 店舗テーブル
create table if not exists public.stores (
  store_id uuid primary key default gen_random_uuid(),
  store_code text unique not null,
  name text not null,
  created_at timestamptz default now()
);

-- 席種テーブル
create table if not exists public.seat_types (
  seat_type_id serial primary key,
  code text unique not null,
  display_name text not null,
  price_per_30min int not null,
  created_at timestamptz default now()
);

-- テーブルテーブル
create table if not exists public.tables (
  table_id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores on delete cascade not null,
  name text not null,
  seat_type_id int references public.seat_types not null,
  created_at timestamptz default now()
);

-- セッションテーブル
create table if not exists public.sessions (
  session_id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores on delete cascade not null,
  table_id uuid references public.tables on delete cascade not null,
  start_at timestamptz default now(),
  charge_started_at timestamptz,
  created_at timestamptz default now()
);

-- セッション席種イベントテーブル
create table if not exists public.session_seat_events (
  event_id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions on delete cascade not null,
  seat_type_id int references public.seat_types not null,
  price_snapshot int not null,
  changed_at timestamptz default now(),
  created_at timestamptz default now()
);

-- 注文テーブル
create table if not exists public.orders (
  order_id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores on delete cascade not null,
  session_id uuid references public.sessions on delete cascade not null,
  status text check (status in ('new','ack','prep','served','closed','cancel')) not null,
  created_by_role text,
  proxy boolean default false,
  created_at timestamptz default now()
);

-- 注文明細テーブル
create table if not exists public.order_items (
  order_item_id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders on delete cascade not null,
  product_id text not null,
  product_name text not null,
  quantity int not null,
  price int not null,
  target_cast_id uuid references auth.users,
  created_at timestamptz default now()
);

-- メニューテーブル
create table if not exists public.menus (
  menu_id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores on delete cascade not null,
  product_id text not null,
  name text not null,
  description text,
  price int not null,
  image_url text,
  category text,
  is_staff_drink boolean default false,
  is_available boolean default true,
  created_at timestamptz default now(),
  unique(store_id, product_id)
);

-- 店舗ユーザー関連テーブル
create table if not exists public.store_users (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role text check (role in ('admin','cast')) not null,
  created_at timestamptz default now(),
  unique(store_id, user_id)
);

-- 会計履歴テーブル
create table if not exists public.checkouts (
  checkout_id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores on delete cascade not null,
  session_id uuid references public.sessions on delete cascade not null,
  total_amount int not null,
  charge_amount int not null,
  order_amount int not null,
  smaregi_receipt_id text,
  status text check (status in ('pending','completed','failed')) not null default 'pending',
  created_at timestamptz default now()
);

-- ブロードキャストテーブル（リアルタイム通知用）
create table if not exists public.broadcast (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  payload jsonb not null,
  created_at timestamptz default now()
);

-- 監査ログテーブル
create table if not exists public.audit_logs (
  log_id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores on delete cascade not null,
  user_id uuid references auth.users,
  action text not null,
  table_name text not null,
  record_id uuid not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
);

-- インデックス作成
create index if not exists idx_tables_store_id on public.tables(store_id);
create index if not exists idx_sessions_store_id on public.sessions(store_id);
create index if not exists idx_sessions_table_id on public.sessions(table_id);
create index if not exists idx_orders_store_id on public.orders(store_id);
create index if not exists idx_orders_session_id on public.orders(session_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_menus_store_id on public.menus(store_id);
create index if not exists idx_store_users_store_id on public.store_users(store_id);
create index if not exists idx_store_users_user_id on public.store_users(user_id);
create index if not exists idx_session_seat_events_session_id on public.session_seat_events(session_id);
create index if not exists idx_checkouts_store_id on public.checkouts(store_id);
create index if not exists idx_checkouts_session_id on public.checkouts(session_id);
create index if not exists idx_audit_logs_store_id on public.audit_logs(store_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at);
