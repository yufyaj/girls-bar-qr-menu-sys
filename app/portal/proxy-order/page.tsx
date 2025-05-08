import { cookies } from 'next/headers';
import TableSelector from './table-selector';
import { Suspense } from 'react';

export default async function ProxyOrderPage() {
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



  // APIからアクティブなテーブル情報を取得
  const response = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/proxy-order/active-tables?storeId=${storeId}`, {
    cache: 'no-store',
    headers: {
      'Cookie': cookieHeader
    }
  });

  let activeTables = [];
  if (response.ok) {
    activeTables = await response.json();

  } else {
    console.error('アクティブテーブルの取得に失敗しました:', await response.text());
  }

  // アクティブなテーブルがない場合
  if (!activeTables || activeTables.length === 0) {

    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">代理注文</h1>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  現在、アクティブなテーブルがありません。お客様が着席してチャージが開始されたテーブルが表示されます。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">代理注文</h1>

        <Suspense fallback={<div>テーブル情報を読み込み中...</div>}>
          <TableSelector tables={activeTables} />
        </Suspense>
      </div>
    </div>
  );
}
