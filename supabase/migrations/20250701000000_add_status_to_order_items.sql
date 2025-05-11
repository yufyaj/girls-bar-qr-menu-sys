-- order_itemsテーブルにstatusカラムを追加
ALTER TABLE public.order_items
ADD COLUMN status TEXT CHECK (status IN ('new', 'ack', 'prep', 'served', 'closed', 'cancel'));

-- 既存の注文アイテムのステータスを親注文のステータスに合わせる
UPDATE public.order_items oi
SET status = o.status
FROM public.orders o
WHERE oi.order_id = o.order_id;

-- statusカラムをNOT NULLに設定
ALTER TABLE public.order_items
ALTER COLUMN status SET NOT NULL;

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_order_items_status ON public.order_items(status);
