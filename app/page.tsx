import Link from 'next/link';

// 店舗の型定義
interface Store {
  store_id: string;
  store_code: string;
  name: string;
}

export default async function HomePage() {
  // 店舗一覧をAPIから取得
  const response = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/stores`, {
    cache: 'no-store'
  });

  let stores: Store[] = [];
  if (response.ok) {
    stores = await response.json();
  } else {
    console.error('店舗一覧の取得に失敗しました:', await response.text());
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          QRオーダー & 会計連携システム
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          ガールズバー向けQRオーダーシステム
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            店舗を選択してください
          </h2>

          <div className="space-y-2">
            {stores && stores.length > 0 ? (
              stores.map((store) => (
                <Link
                  key={store.store_id}
                  href={`/login/${store.store_code}`}
                  className="w-full flex justify-between items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <span>{store.name}</span>
                  <span className="text-gray-400">&rarr;</span>
                </Link>
              ))
            ) : (
              <p className="text-center text-gray-500">
                登録されている店舗がありません。
              </p>
            )}
          </div>

          <div className="mt-6">
            <p className="text-center text-xs text-gray-500">
              ※ 店舗スタッフ専用ログインです。来店客は店内のQRコードからアクセスしてください。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
