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
            {!store.enable_smaregi_integration ? (
              <Link
                href="/portal/menus/new"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                メニューを追加
              </Link>
            ) : null}
          </div>
        </div>
      </div>
      {store.enable_smaregi_integration && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  スマレジ連携が有効になっているため、メニューの追加はできません。メニューを追加するには、スマレジで商品を登録した後、「スマレジと同期」ボタンをクリックしてください。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <MenuList menus={menus || []} />
      </div>
    </div>
  );
}
