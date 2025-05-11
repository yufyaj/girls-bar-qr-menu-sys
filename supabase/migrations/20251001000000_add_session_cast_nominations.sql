-- session_cast_nominationsテーブルの作成
CREATE TABLE IF NOT EXISTS public.session_cast_nominations (
  nomination_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions ON DELETE CASCADE NOT NULL,
  cast_id UUID REFERENCES auth.users(id) NOT NULL,
  nomination_fee INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_session_cast_nominations_session_id ON public.session_cast_nominations(session_id);
CREATE INDEX IF NOT EXISTS idx_session_cast_nominations_cast_id ON public.session_cast_nominations(cast_id);

-- RLSの有効化
ALTER TABLE public.session_cast_nominations ENABLE ROW LEVEL SECURITY;

-- RLSポリシーの作成
-- 匿名ユーザーも閲覧可能
CREATE POLICY "指名情報は誰でも閲覧可能" ON public.session_cast_nominations
  FOR SELECT USING (true);

-- 自分が所属する店舗の指名情報のみ編集可能
CREATE POLICY "自分が所属する店舗の指名情報のみ編集可能" ON public.session_cast_nominations
  FOR ALL USING (
    session_id IN (
      SELECT session_id FROM public.sessions WHERE store_id IN (
        SELECT store_id FROM public.store_users WHERE user_id = auth.uid()
      )
    )
  );

-- checkoutsテーブルのnomination_feeカラムの説明を更新するコメント
COMMENT ON COLUMN public.checkouts.nomination_fee IS 'この列は後方互換性のために残されています。新しい実装ではsession_cast_nominationsテーブルから指名料を計算します。';
