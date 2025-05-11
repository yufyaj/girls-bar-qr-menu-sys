import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MenuForm from '../menu-form';

export default async function NewMenuPage() {
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

  // 店舗情報をAPIから取得
  const storeResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/stores/${storeId}`, {
    cache: 'no-store'
  });

  if (!storeResponse.ok) {
    console.error('店舗情報の取得に失敗しました:', await storeResponse.text());
    return <div>店舗情報が見つかりません</div>;
  }

  const store = await storeResponse.json();

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">メニューを追加</h1>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <MenuForm storeId={storeId} />
          </div>
        </div>
      </div>
    </div>
  );
}
