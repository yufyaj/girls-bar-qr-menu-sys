-- 監査ログ用のトリガー関数を修正（order_itemsテーブルのitem_id → order_item_idに修正）
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
    
    -- テーブルごとに主キーを取得
    if TG_TABLE_NAME = 'stores' then
      v_record_id := new.store_id;
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'tables' then
      v_record_id := new.table_id;
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'sessions' then
      v_record_id := new.session_id;
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'orders' then
      v_record_id := new.order_id;
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'menus' then
      v_record_id := new.menu_id;
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'store_users' then
      v_record_id := new.id;
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'checkouts' then
      v_record_id := new.checkout_id;
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'order_items' then
      v_record_id := new.order_item_id;  -- item_id → order_item_id に修正
      select store_id into v_store_id from public.orders where order_id = new.order_id;
    elsif TG_TABLE_NAME = 'session_seat_events' then
      v_record_id := new.event_id;
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
    
    -- テーブルごとに主キーを取得
    if TG_TABLE_NAME = 'stores' then
      v_record_id := new.store_id;
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'tables' then
      v_record_id := new.table_id;
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'sessions' then
      v_record_id := new.session_id;
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'orders' then
      v_record_id := new.order_id;
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'menus' then
      v_record_id := new.menu_id;
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'store_users' then
      v_record_id := new.id;
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'checkouts' then
      v_record_id := new.checkout_id;
      v_store_id := new.store_id;
    elsif TG_TABLE_NAME = 'order_items' then
      v_record_id := new.order_item_id;  -- item_id → order_item_id に修正
      select store_id into v_store_id from public.orders where order_id = new.order_id;
    elsif TG_TABLE_NAME = 'session_seat_events' then
      v_record_id := new.event_id;
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
    
    -- テーブルごとに主キーを取得
    if TG_TABLE_NAME = 'stores' then
      v_record_id := old.store_id;
      v_store_id := old.store_id;
    elsif TG_TABLE_NAME = 'tables' then
      v_record_id := old.table_id;
      v_store_id := old.store_id;
    elsif TG_TABLE_NAME = 'sessions' then
      v_record_id := old.session_id;
      v_store_id := old.store_id;
    elsif TG_TABLE_NAME = 'orders' then
      v_record_id := old.order_id;
      v_store_id := old.store_id;
    elsif TG_TABLE_NAME = 'menus' then
      v_record_id := old.menu_id;
      v_store_id := old.store_id;
    elsif TG_TABLE_NAME = 'store_users' then
      v_record_id := old.id;
      v_store_id := old.store_id;
    elsif TG_TABLE_NAME = 'checkouts' then
      v_record_id := old.checkout_id;
      v_store_id := old.store_id;
    elsif TG_TABLE_NAME = 'order_items' then
      v_record_id := old.order_item_id;  -- item_id → order_item_id に修正
      select store_id into v_store_id from public.orders where order_id = old.order_id;
    elsif TG_TABLE_NAME = 'session_seat_events' then
      v_record_id := old.event_id;
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