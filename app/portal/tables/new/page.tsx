import { cookies } from 'next/headers';
import Link from 'next/link';
import TableForm from '../_components/table-form';

export default async function NewTablePage() {
  const cookieStore = await cookies();
  const storeId = cookieStore.get('store-id')?.value;

  if (!storeId) {
    return <div>店舗情報が見つかりません</div>;
  }

  // APIから席種一覧を取得
  const seatTypesResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/seat-types?storeId=${storeId}`, {
    cache: 'no-store'
  });
  
  let seatTypes = [];
  if (seatTypesResponse.ok) {
    seatTypes = await seatTypesResponse.json();
  } else {
    console.error('席種一覧の取得に失敗しました:', await seatTypesResponse.text());
  }

  // 新規作成用のデフォルト値
  const defaultValues = {
    name: '',
    store_id: storeId
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">新規テーブル作成</h1>
        <Link
          href="/portal/tables"
          className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
        >
          戻る
        </Link>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <TableForm defaultValues={defaultValues} seatTypes={seatTypes} />
      </div>
    </div>
  );
}
