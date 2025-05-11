-- RLSを有効化
alter table public.stores enable row level security;
alter table public.seat_types enable row level security;
alter table public.tables enable row level security;
alter table public.sessions enable row level security;
alter table public.session_seat_events enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.menus enable row level security;
alter table public.store_users enable row level security;
alter table public.checkouts enable row level security;
alter table public.broadcast enable row level security;
alter table public.audit_logs enable row level security;

-- 匿名ユーザー用のポリシー
-- 店舗情報は匿名ユーザーも閲覧可能
create policy "店舗情報は誰でも閲覧可能" on public.stores
  for select using (true);

-- テーブル情報は匿名ユーザーも閲覧可能
create policy "テーブル情報は誰でも閲覧可能" on public.tables
  for select using (true);

-- 席種情報は匿名ユーザーも閲覧可能
create policy "席種情報は誰でも閲覧可能" on public.seat_types
  for select using (true);

-- メニュー情報は匿名ユーザーも閲覧可能
create policy "メニュー情報は誰でも閲覧可能" on public.menus
  for select using (true);

-- セッション情報は匿名ユーザーも閲覧可能（テーブルIDで絞り込み）
create policy "セッション情報は誰でも閲覧可能" on public.sessions
  for select using (true);

-- 匿名ユーザーは注文を作成可能
create policy "匿名ユーザーは注文を作成可能" on public.orders
  for insert with check (created_by_role = 'customer');

-- 匿名ユーザーは注文明細を作成可能
create policy "匿名ユーザーは注文明細を作成可能" on public.order_items
  for insert with check (
    order_id in (
      select order_id from public.orders where created_by_role = 'customer'
    )
  );

-- 認証済みユーザー用のポリシー
-- 自分が所属する店舗の情報のみ閲覧・編集可能
create policy "自分が所属する店舗の情報のみ閲覧可能" on public.stores
  for all using (
    store_id in (
      select store_id from public.store_users where user_id = auth.uid()
    )
  );

-- 自分が所属する店舗のテーブル情報のみ閲覧・編集可能
create policy "自分が所属する店舗のテーブル情報のみ閲覧・編集可能" on public.tables
  for all using (
    store_id in (
      select store_id from public.store_users where user_id = auth.uid()
    )
  );

-- 自分が所属する店舗のセッション情報のみ閲覧・編集可能
create policy "自分が所属する店舗のセッション情報のみ閲覧・編集可能" on public.sessions
  for all using (
    store_id in (
      select store_id from public.store_users where user_id = auth.uid()
    )
  );

-- 自分が所属する店舗のセッション席種イベント情報のみ閲覧・編集可能
create policy "自分が所属する店舗のセッション席種イベント情報のみ閲覧・編集可能" on public.session_seat_events
  for all using (
    session_id in (
      select session_id from public.sessions where store_id in (
        select store_id from public.store_users where user_id = auth.uid()
      )
    )
  );

-- 自分が所属する店舗の注文情報のみ閲覧・編集可能
create policy "自分が所属する店舗の注文情報のみ閲覧・編集可能" on public.orders
  for all using (
    store_id in (
      select store_id from public.store_users where user_id = auth.uid()
    )
  );

-- 自分が所属する店舗の注文明細情報のみ閲覧・編集可能
create policy "自分が所属する店舗の注文明細情報のみ閲覧・編集可能" on public.order_items
  for all using (
    order_id in (
      select order_id from public.orders where store_id in (
        select store_id from public.store_users where user_id = auth.uid()
      )
    )
  );

-- 自分が所属する店舗のメニュー情報のみ閲覧・編集可能
create policy "自分が所属する店舗のメニュー情報のみ閲覧・編集可能" on public.menus
  for all using (
    store_id in (
      select store_id from public.store_users where user_id = auth.uid()
    )
  );

-- 自分が所属する店舗の会計情報のみ閲覧・編集可能
create policy "自分が所属する店舗の会計情報のみ閲覧・編集可能" on public.checkouts
  for all using (
    store_id in (
      select store_id from public.store_users where user_id = auth.uid()
    )
  );

-- 自分が所属する店舗の監査ログのみ閲覧可能
create policy "自分が所属する店舗の監査ログのみ閲覧可能" on public.audit_logs
  for select using (
    store_id in (
      select store_id from public.store_users where user_id = auth.uid()
    )
  );

-- 店舗ユーザー関連は自分が所属する店舗のみ閲覧可能
create policy "自分が所属する店舗のユーザー関連のみ閲覧可能" on public.store_users
  for select using (
    store_id in (
      select store_id from public.store_users where user_id = auth.uid()
    )
  );

-- 管理者のみ店舗ユーザー関連を編集可能
create policy "管理者のみ店舗ユーザー関連を編集可能" on public.store_users
  for insert with check (
    exists (
      select 1 from public.store_users 
      where user_id = auth.uid() and store_id = store_users.store_id and role = 'admin'
    )
  );

create policy "管理者のみ店舗ユーザー関連を更新可能" on public.store_users
  for update using (
    exists (
      select 1 from public.store_users 
      where user_id = auth.uid() and store_id = store_users.store_id and role = 'admin'
    )
  );

create policy "管理者のみ店舗ユーザー関連を削除可能" on public.store_users
  for delete using (
    exists (
      select 1 from public.store_users 
      where user_id = auth.uid() and store_id = store_users.store_id and role = 'admin'
    )
  );

-- 席種は管理者のみ編集可能
create policy "席種は管理者のみ編集可能" on public.seat_types
  for insert with check (
    exists (
      select 1 from public.store_users where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "席種は管理者のみ更新可能" on public.seat_types
  for update using (
    exists (
      select 1 from public.store_users where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "席種は管理者のみ削除可能" on public.seat_types
  for delete using (
    exists (
      select 1 from public.store_users where user_id = auth.uid() and role = 'admin'
    )
  );

-- ブロードキャストは誰でも閲覧可能
create policy "ブロードキャストは誰でも閲覧可能" on public.broadcast
  for select using (true);

-- ブロードキャストは認証済みユーザーのみ作成可能
create policy "ブロードキャストは認証済みユーザーのみ作成可能" on public.broadcast
  for insert with check (auth.role() = 'authenticated');
