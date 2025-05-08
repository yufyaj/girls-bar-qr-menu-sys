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

        <div className="mt-6">
          <CategoryList categories={categories} />
        </div>
      </div>
    </div>
  );
}
