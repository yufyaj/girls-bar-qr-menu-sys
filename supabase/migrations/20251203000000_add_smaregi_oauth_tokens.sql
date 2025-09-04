-- スマレジOAuth認証トークン管理テーブル
CREATE TABLE smaregi_oauth_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type VARCHAR(50) DEFAULT 'Bearer',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(store_id)
);

-- インデックス作成
CREATE INDEX idx_smaregi_oauth_tokens_store_id ON smaregi_oauth_tokens(store_id);
CREATE INDEX idx_smaregi_oauth_tokens_expires_at ON smaregi_oauth_tokens(expires_at);

-- RLSポリシー設定
ALTER TABLE smaregi_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- 店舗管理者のみアクセス可能
CREATE POLICY "Store admins can manage oauth tokens" ON smaregi_oauth_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM store_users 
      WHERE store_users.store_id = smaregi_oauth_tokens.store_id 
      AND store_users.user_id = auth.uid() 
      AND store_users.role = 'admin'
    )
  );

-- 更新時のタイムスタンプ自動更新トリガー
CREATE OR REPLACE FUNCTION update_smaregi_oauth_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_smaregi_oauth_tokens_updated_at
  BEFORE UPDATE ON smaregi_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_smaregi_oauth_tokens_updated_at();
