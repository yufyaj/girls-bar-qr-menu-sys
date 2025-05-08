import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LayoutWrapper from './components/layout-wrapper';

// ナビゲーションリンク
interface NavLink {
  href: string;
  label: string;
  roles: ('admin' | 'cast')[];
}

const navLinks: NavLink[] = [
  { href: '/portal/dashboard', label: 'ダッシュボード', roles: ['admin', 'cast'] },
  { href: '/portal/order-board', label: '注文ボード', roles: ['admin', 'cast'] },
  { href: '/portal/proxy-order', label: '代理注文', roles: ['admin', 'cast'] },
  { href: '/portal/tables', label: 'テーブル管理', roles: ['admin'] },
  { href: '/portal/seat-types', label: '席種設定', roles: ['admin'] },
  { href: '/portal/casts', label: 'キャスト管理', roles: ['admin'] },
  { href: '/portal/menus', label: 'メニュー管理', roles: ['admin'] },
  { href: '/portal/menu-categories', label: 'カテゴリ管理', roles: ['admin'] },
  { href: '/portal/reports', label: 'レポート', roles: ['admin'] },
  { href: '/portal/settings', label: 'スマレジ連携', roles: ['admin'] },
];

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const storeId = cookieStore.get('store-id')?.value;

  if (!storeId) {
    redirect('/');
  }

  // APIからユーザー情報を取得

  // 現在のリクエストのCookieをすべて取得して転送
  const allCookies = cookieStore.getAll();

  // 認証トークンとstore-id（両方の形式）を確実に転送
  const authCookies = allCookies.filter(c => c.name.includes('-auth-token') || c.name === 'sb-refresh-token' || c.name === 'sb-access-token');
  const storeIdCookie = allCookies.find(c => c.name === 'store-id');
  const storeIdLegacyCookie = allCookies.find(c => c.name === 'storeId');

  // 必要なCookieのみを転送
  const essentialCookies = [];

  // 認証関連のCookieを追加
  authCookies.forEach(cookie => {
    essentialCookies.push(`${cookie.name}=${cookie.value}`);
  });

  // 店舗ID関連のCookieを追加（両方の形式）
  if (storeIdCookie) essentialCookies.push(`${storeIdCookie.name}=${storeIdCookie.value}`);
  if (storeIdLegacyCookie) essentialCookies.push(`${storeIdLegacyCookie.name}=${storeIdLegacyCookie.value}`);

  const cookieHeader = essentialCookies.join('; ');



  const userResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/auth/user`, {
    cache: 'no-store',
    headers: {
      'Cookie': cookieHeader
    }
  });

  if (!userResponse.ok) {
    const errorText = await userResponse.text();
    console.error('Portal layout: ユーザー情報の取得に失敗しました', {
      status: userResponse.status,
      statusText: userResponse.statusText,
      error: errorText
    });
    redirect('/');
  }



  const { user } = await userResponse.json();
  const userRole = user.role;



  // 店舗情報をAPIから取得
  const storeResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/stores/${storeId}`, {
    cache: 'no-store'
  });

  if (!storeResponse.ok) {
    console.error('店舗情報の取得に失敗しました:', await storeResponse.text());
    redirect('/');
  }

  const store = await storeResponse.json();

  return (
    <LayoutWrapper
      navLinks={navLinks}
      userRole={userRole}
      storeName={store?.name || '店舗'}
      userEmail={user.email}
    >
      {children}
    </LayoutWrapper>
  );
}
