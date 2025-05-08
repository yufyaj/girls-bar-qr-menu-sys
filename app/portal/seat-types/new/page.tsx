
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import SeatTypeForm from '../_components/seat-type-form';

export default async function NewSeatTypePage() {
  const cookieStore = await cookies();
  const storeId = cookieStore.get('store-id')?.value;

  if (!storeId) {
    return <div>店舗情報が見つかりません</div>;
  }

  // 新規作成用のデフォルト値
  const defaultValues = {
    display_name: '',
    price_per_unit: 0, // 時間単位あたりの料金
    time_unit_minutes: 30, // デフォルトは30分
    store_id: storeId
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">新規席種作成</h1>
        <Link
          href="/portal/seat-types"
          className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
        >
          戻る
        </Link>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <SeatTypeForm defaultValues={defaultValues} />
      </div>
    </div>
  );
}
