/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'pos-cache.smaregi.dev', // スマレジの画像ドメイン
      'pos-cache.smaregi.jp',  // 本番環境用のスマレジ画像ドメイン
      'ooiajrjymsrmnxukmavb.supabase.co' // Supabaseストレージドメイン
    ],
  },
}

module.exports = nextConfig
