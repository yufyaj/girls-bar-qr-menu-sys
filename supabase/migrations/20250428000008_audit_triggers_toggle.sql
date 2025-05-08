-- 監査ログトリガーを無効化するRPC関数
create or replace function public.disable_audit_triggers()
returns void
language plpgsql
security definer
as $$
begin
  alter table public.stores disable trigger trg_audit_stores;
  alter table public.tables disable trigger trg_audit_tables;
  alter table public.sessions disable trigger trg_audit_sessions;
  alter table public.orders disable trigger trg_audit_orders;
  alter table public.order_items disable trigger trg_audit_order_items;
  alter table public.menus disable trigger trg_audit_menus;
  alter table public.store_users disable trigger trg_audit_store_users;
  alter table public.checkouts disable trigger trg_audit_checkouts;
end;
$$;

-- 監査ログトリガーを有効化するRPC関数
create or replace function public.enable_audit_triggers()
returns void
language plpgsql
security definer
as $$
begin
  alter table public.stores enable trigger trg_audit_stores;
  alter table public.tables enable trigger trg_audit_tables;
  alter table public.sessions enable trigger trg_audit_sessions;
  alter table public.orders enable trigger trg_audit_orders;
  alter table public.order_items enable trigger trg_audit_order_items;
  alter table public.menus enable trigger trg_audit_menus;
  alter table public.store_users enable trigger trg_audit_store_users;
  alter table public.checkouts enable trigger trg_audit_checkouts;
end;
$$;
