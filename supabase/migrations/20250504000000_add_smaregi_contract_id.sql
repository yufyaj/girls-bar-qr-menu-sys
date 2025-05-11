-- storesテーブルにスマレジ契約IDのカラムを追加
ALTER TABLE public.stores
ADD COLUMN smaregi_contract_id text;

-- 既存のRLSポリシーは既に管理者のみが店舗設定を更新できるようになっているため、
-- 追加のポリシーは不要
