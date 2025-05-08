import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import MenuForm from '../../menu-form';

export default async function EditMenuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  const userResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/auth/user`, {
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

  // APIからメニュー情報を取得
  const response = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/menus/${id}?storeId=${storeId}`, {
    cache: 'no-store',
    headers: {
      'Cookie': cookieHeader
    }
  });

  if (!response.ok) {
    console.error('メニュー情報の取得に失敗しました:', await response.text());
    notFound();
  }

  const menu = await response.json();

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">メニューを編集</h1>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <MenuForm
              storeId={storeId}
              menuId={menu.menu_id}
              initialData={{
                product_id: menu.product_id,
                name: menu.name,
                description: menu.description,
                price: menu.price,
                image_url: menu.image_url,
                category: menu.category,
                category_id: menu.category_id,
                is_available: menu.is_available,
              }}
              isEdit={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
