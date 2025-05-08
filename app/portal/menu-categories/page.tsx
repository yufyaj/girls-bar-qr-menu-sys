import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import CategoryList from './category-list';

export const metadata = {
  title: 'メニューカテゴリ管理',
};

export default async function MenuCategoriesPage() {
  const cookieStore = await cookies();
  const storeId = cookieStore.get('store-id')?.value;

  if (!storeId) {
    redirect('/login');
  }

  // 現在のリクエストのCookieをすべて取得して転送
  const allCookies = cookieStore.getAll();
  const cookieHeader = allCookies
    .map(cookie => `${cookie.name}=${cookie.value}`)
    .join('; ');

  // 店舗情報を取得
  const storeResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/stores/${storeId}`, {
    cache: 'no-store'
  });

  if (!storeResponse.ok) {
    console.error('店舗情報の取得に失敗しました:', await storeResponse.text());
    throw new Error('店舗情報の取得に失敗しました');
  }

  const store = await storeResponse.json();

  // APIからカテゴリ一覧を取得
  const response = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/menu-categories?storeId=${storeId}`, {
    cache: 'no-store',
    headers: {
      'Cookie': cookieHeader
    }
  });

  if (!response.ok) {
    throw new Error('カテゴリ一覧の取得に失敗しました');
  }

  const categories = await response.json();

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">メニューカテゴリ管理</h1>
        <p className="mt-2 text-sm text-gray-700">
          メニューのカテゴリを管理します。カテゴリはメニュー表示時のグループ分けに使用されます。
        </p>

        {store.enable_smaregi_integration && (
          <div className="mt-4">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    スマレジ連携が有効になっているため、カテゴリの追加はできません。カテゴリを追加するには、スマレジで部門を登録した後、メニュー管理画面で「スマレジと同期」ボタンをクリックしてください。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6">
          <CategoryList
            categories={categories}
            enableSmaregiIntegration={store.enable_smaregi_integration}
          />
        </div>
      </div>
    </div>
  );
}
