-- 監査ログ用のトリガー関数
create or replace function public.fn_audit_log()
returns trigger
language plpgsql
security definer
as $$
declare
  v_store_id uuid;
  v_user_id uuid := auth.uid();
  v_action text;
  v_record_id uuid;
begin
  -- アクションの種類を設定
  if TG_OP = 'INSERT' then
    v_action := 'insert';
    v_record_id := new.id;
    
    -- テーブルごとに店舗IDを取得
    if TG_TABLE_NAME = 'stores' then
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'tables' then
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'sessions' then
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'orders' then
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'menus' then
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'store_users' then
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'checkouts' then
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'order_items' then
      select store_id into v_store_id from public.orders where order_id = new.order_id;
    elsif TG_TABLE_NAME = 'session_seat_events' then
      select store_id into v_store_id from public.sessions where session_id = new.session_id;
    end if;
    
    -- 監査ログを挿入
    insert into public.audit_logs (
      store_id,
      user_id,
      action,
      table_name,
      record_id,
      new_data
    ) values (
      v_store_id,
      v_user_id,
      v_action,
      TG_TABLE_NAME,
      v_record_id,
      to_jsonb(new)
    );
    
  elsif TG_OP = 'UPDATE' then
    v_action := 'update';
    v_record_id := new.id;
    
    -- テーブルごとに店舗IDを取得
    if TG_TABLE_NAME = 'stores' then
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'tables' then
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'sessions' then
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'orders' then
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'menus' then
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'store_users' then
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'checkouts' then
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'order_items' then
      select store_id into v_store_id from public.orders where order_id = new.order_id;
    elsif TG_TABLE_NAME = 'session_seat_events' then
      select store_id into v_store_id from public.sessions where session_id = new.session_id;
    end if;
    
    -- 監査ログを挿入
    insert into public.audit_logs (
      store_id,
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data
    ) values (
      v_store_id,
      v_user_id,
      v_action,
      TG_TABLE_NAME,
      v_record_id,
      to_jsonb(old),
      to_jsonb(new)
    );
    
  elsif TG_OP = 'DELETE' then
    v_action := 'delete';
    v_record_id := old.id;
    
    -- テーブルごとに店舗IDを取得
    if TG_TABLE_NAME = 'stores' then
      v_store_id := old.store_id;
    elsif TG_TABLE_NAME = 'tables' then
      v_store_id := old.store_id;
    elsif TG_TABLE_NAME = 'sessions' then
      v_store_id := old.store_id;
    elsif TG_TABLE_NAME = 'orders' then
      v_store_id := old.store_id;
    elsif TG_TABLE_NAME = 'menus' then
      v_store_id := old.store_id;
    elsif TG_TABLE_NAME = 'store_users' then
      v_store_id := old.store_id;
    elsif TG_TABLE_NAME = 'checkouts' then
      v_store_id := old.store_id;
    elsif TG_TABLE_NAME = 'order_items' then
      select store_id into v_store_id from public.orders where order_id = old.order_id;
    elsif TG_TABLE_NAME = 'session_seat_events' then
      select store_id into v_store_id from public.sessions where session_id = old.session_id;
    end if;
    
    -- 監査ログを挿入
    insert into public.audit_logs (
      store_id,
      user_id,
      action,
      table_name,
      record_id,
      old_data
    ) values (
      v_store_id,
      v_user_id,
      v_action,
      TG_TABLE_NAME,
      v_record_id,
      to_jsonb(old)
    );
  end if;
  
  return null;
end;
$$;

-- 監査ログトリガーを各テーブルに適用
create trigger trg_audit_stores
after insert or update or delete on public.stores
for each row execute function public.fn_audit_log();

create trigger trg_audit_tables
after insert or update or delete on public.tables
for each row execute function public.fn_audit_log();

create trigger trg_audit_sessions
after insert or update or delete on public.sessions
for each row execute function public.fn_audit_log();

create trigger trg_audit_orders
after insert or update or delete on public.orders
for each row execute function public.fn_audit_log();

create trigger trg_audit_order_items
after insert or update or delete on public.order_items
for each row execute function public.fn_audit_log();

create trigger trg_audit_menus
after insert or update or delete on public.menus
for each row execute function public.fn_audit_log();

create trigger trg_audit_store_users
after insert or update or delete on public.store_users
for each row execute function public.fn_audit_log();

create trigger trg_audit_checkouts
after insert or update or delete on public.checkouts
for each row execute function public.fn_audit_log();

-- 90日以上経過した監査ログを削除する関数
create or replace function public.fn_cleanup_audit_logs()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.audit_logs
  where created_at < now() - interval '90 days';
end;
$$;
