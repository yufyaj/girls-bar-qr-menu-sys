import Link from 'next/link';
import { cookies } from 'next/headers';

// 席種の型定義
interface SeatType {
  seat_type_id: string; // UUIDなので文字列型
  display_name: string;
  price_per_unit: number; // 時間単位あたりの料金
  time_unit_minutes: number;
  store_id: string;
  created_at: string;
}

export default async function SeatTypesPage() {
  const cookieStore = await cookies();
  const storeId = cookieStore.get('store-id')?.value;

  if (!storeId) {
    return <div>店舗情報が見つかりません</div>;
  }

  // APIから席種一覧を取得
  const response = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/seat-types?storeId=${storeId}`, {
    cache: 'no-store'
  });

  let seatTypes: SeatType[] = [];
  if (response.ok) {
    seatTypes = await response.json();
  } else {
    console.error('席種一覧の取得に失敗しました:', await response.text());
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">席種設定</h1>
        <Link
          href="/portal/seat-types/new"
          className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          新規席種作成
        </Link>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {seatTypes && seatTypes.length > 0 ? (
            seatTypes.map((seatType) => (
              <li key={seatType.seat_type_id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-medium text-gray-900">
                      {seatType.display_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">
                      {seatType.price_per_unit}円/{seatType.time_unit_minutes || 30}分
                    </p>
                    <Link
                      href={`/portal/seat-types/${seatType.seat_type_id}/edit`}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      編集
                    </Link>
                  </div>
                </div>
              </li>
            ))
          ) : (
            <li className="px-6 py-4 text-center text-gray-500">
              席種がまだ登録されていません。「新規席種作成」から追加してください。
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
