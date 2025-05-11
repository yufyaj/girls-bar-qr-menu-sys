import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'QRオーダー & 会計連携システム',
  description: 'ガールズバー向けQRオーダーシステム',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
