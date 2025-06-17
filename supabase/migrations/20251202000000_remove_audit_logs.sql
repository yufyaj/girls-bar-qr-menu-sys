-- 監査ログトリガーを全て削除
drop trigger if exists trg_audit_stores on public.stores;
drop trigger if exists trg_audit_tables on public.tables;
drop trigger if exists trg_audit_sessions on public.sessions;
drop trigger if exists trg_audit_orders on public.orders;
drop trigger if exists trg_audit_order_items on public.order_items;
drop trigger if exists trg_audit_menus on public.menus;
drop trigger if exists trg_audit_store_users on public.store_users;
drop trigger if exists trg_audit_checkouts on public.checkouts;

-- 監査ログ関数を削除
drop function if exists public.fn_audit_log();
drop function if exists public.fn_cleanup_audit_logs();
drop function if exists public.disable_audit_triggers();
drop function if exists public.enable_audit_triggers();

-- 監査ログテーブルを削除
drop table if exists public.audit_logs; 