-- storesテーブルにスマレジ連携キーのカラムを追加
ALTER TABLE public.stores
ADD COLUMN smaregi_client_id text,
ADD COLUMN smaregi_client_secret text;

-- 既存のRLSポリシーは既に管理者のみが店舗設定を更新できるようになっているため、
-- 追加のポリシーは不要
