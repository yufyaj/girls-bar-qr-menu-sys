import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import MenuList from './menu-list';
import SmaregiSyncButton from './smaregi-sync-button';

export default async function MenusPage() {
  const cookieStore = await cookies();
  const storeId = cookieStore.get('store-id')?.value;

  if (!storeId) {
    return <div>店舗情報が見つかりません</div>;
  }

  // 現在のリクエストのCookieをすべて取得して転送
  const allCookies = cookieStore.getAll();
  const cookieHeader = allCookies
    .map(cookie => `${cookie.name}=${cookie.value}`)
    .join('; ');



  // APIからユーザー情報を取得
  const userResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/auth/user?storeId=${storeId}`, {
    cache: 'no-store',
    headers: {
      'Cookie': cookieHeader
    }
  });

  if (!userResponse.ok) {
    redirect('/');
  }

  const { user } = await userResponse.json();

  // 管理者でなければダッシュボードにリダイレクト
  if (user.role !== 'admin') {
    redirect('/portal/dashboard');
  }

  // 店舗情報を取得
  const storeResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/stores/${storeId}`, {
    cache: 'no-store'
  });

  if (!storeResponse.ok) {
    console.error('店舗情報の取得に失敗しました:', await storeResponse.text());
    return <div>店舗情報が見つかりません</div>;
  }

  const store = await storeResponse.json();

  // メニュー一覧をAPIから取得
  const menusResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/menus?storeId=${storeId}`, {
    cache: 'no-store',
    headers: {
      'Cookie': cookieHeader
    }
  });

  let menus = [];
  if (menusResponse.ok) {
    menus = await menusResponse.json();
  } else {
    console.error('メニュー一覧の取得に失敗しました:', await menusResponse.text());
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">メニュー管理</h1>
          <div className="flex space-x-4">
            {store.enable_smaregi_integration && (
              <SmaregiSyncButton
                storeId={storeId}
                enableSmaregiIntegration={store.enable_smaregi_integration}
              />
            )}
            <Link
              href="/portal/menus/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              メニューを追加
            </Link>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <MenuList menus={menus || []} />
      </div>
    </div>
  );
}
