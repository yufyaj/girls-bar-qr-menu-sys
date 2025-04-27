# ガールズバー QRオーダー & 会計連携システム

ガールズバー向けのQRコードを使用したオーダーシステムと、スマレジAPIを活用した会計連携システムです。

## 主要機能

- 来店客が卓上QRからスマホでメニューを閲覧・注文
- キャストが操作するタブレット向けインターフェース
- 管理者向けダッシュボード
- 30分単位のチャージ計算
- スマレジ連携による会計処理
- スタッフドリンク指定機能
- 席移動履歴管理

## 技術スタック

- **フロントエンド**: Next.js 15 (App Router, RSC)
- **バックエンド**: Next.js Route Handlers (BFF)
- **データベース**: Supabase (PostgreSQL 15)
- **認証**: Supabase Auth (JWT)
- **外部API**: スマレジ REST API
- **デプロイ**: Vercel (Next App + Cron)

## 開発環境セットアップ

```bash
# リポジトリのクローン
git clone https://github.com/yourusername/girls-bar-qr-menu-sys.git
cd girls-bar-qr-menu-sys

# 依存関係のインストール
pnpm install

# 開発サーバーの起動
pnpm dev

# Supabaseローカル環境の起動
supabase start
```

## プロジェクト構成

```
apps/
└─ web/ (Next.js)
   ├─ app/
   │   ├─ api/              # Route Handlers
   │   │   └─ cron/
   │   ├─ events/route.ts
   │   ├─ components/
   │   ├─ features/
   │   └─ lib/              # supabase-server.ts / smaregi.ts / auth.ts
   └─ public/
supabase/
└─ migrations/
tests/ (vitest, supertest, playwright, k6)
```

## ライセンス

[MIT License](LICENSE)