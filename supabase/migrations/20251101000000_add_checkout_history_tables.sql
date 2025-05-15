-- 会計履歴テーブル（拡張版）
CREATE TABLE IF NOT EXISTS public.checkout_history (
  history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_id UUID NOT NULL, -- 元の会計ID
  store_id UUID REFERENCES public.stores NOT NULL,
  table_id UUID NOT NULL, -- 元のテーブルID
  table_name TEXT NOT NULL,
  seat_type_name TEXT NOT NULL,
  
  -- 金額情報
  total_amount INT NOT NULL,
  subtotal_amount INT NOT NULL, -- 税抜き合計
  charge_amount INT NOT NULL,
  order_amount INT NOT NULL,
  nomination_fee INT NOT NULL DEFAULT 0,
  tax_amount INT NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL,
  
  -- セッション情報
  session_start_at TIMESTAMPTZ NOT NULL,
  charge_started_at TIMESTAMPTZ,
  checkout_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stay_minutes INT NOT NULL, -- 滞在時間（分）
  guest_count INT NOT NULL DEFAULT 1, -- 人数
  
  -- 参照情報
  smaregi_receipt_id TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 注文履歴詳細テーブル
CREATE TABLE IF NOT EXISTS public.checkout_order_items (
  item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  history_id UUID REFERENCES public.checkout_history(history_id) ON DELETE CASCADE NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  price INT NOT NULL,
  quantity INT NOT NULL,
  subtotal INT NOT NULL,
  target_cast_id UUID, -- 奢った場合のキャストID
  target_cast_name TEXT, -- 奢った場合のキャスト名
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- 元の注文日時
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 指名履歴テーブル
CREATE TABLE IF NOT EXISTS public.checkout_nominations (
  nomination_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  history_id UUID REFERENCES public.checkout_history(history_id) ON DELETE CASCADE NOT NULL,
  cast_id UUID, -- キャストID
  cast_name TEXT NOT NULL, -- キャスト名
  fee INT NOT NULL, -- 指名料
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_checkout_history_store_id ON public.checkout_history(store_id);
CREATE INDEX IF NOT EXISTS idx_checkout_history_checkout_id ON public.checkout_history(checkout_id);
CREATE INDEX IF NOT EXISTS idx_checkout_history_created_at ON public.checkout_history(created_at);
CREATE INDEX IF NOT EXISTS idx_checkout_order_items_history_id ON public.checkout_order_items(history_id);
CREATE INDEX IF NOT EXISTS idx_checkout_nominations_history_id ON public.checkout_nominations(history_id);

-- RLSポリシーの設定
ALTER TABLE public.checkout_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_nominations ENABLE ROW LEVEL SECURITY;

-- 店舗管理者は自分の店舗の会計履歴を閲覧可能
CREATE POLICY "店舗管理者は自分の店舗の会計履歴を閲覧可能" ON public.checkout_history
  FOR SELECT
  USING (
    store_id IN (
      SELECT store_id FROM public.store_users
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 店舗管理者は自分の店舗の会計詳細を閲覧可能
CREATE POLICY "店舗管理者は自分の店舗の会計詳細を閲覧可能" ON public.checkout_order_items
  FOR SELECT
  USING (
    history_id IN (
      SELECT history_id FROM public.checkout_history
      WHERE store_id IN (
        SELECT store_id FROM public.store_users
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- 店舗管理者は自分の店舗の指名履歴を閲覧可能
CREATE POLICY "店舗管理者は自分の店舗の指名履歴を閲覧可能" ON public.checkout_nominations
  FOR SELECT
  USING (
    history_id IN (
      SELECT history_id FROM public.checkout_history
      WHERE store_id IN (
        SELECT store_id FROM public.store_users
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  ); 