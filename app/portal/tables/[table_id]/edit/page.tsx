import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import TableForm from '../../_components/table-form';

export default async function EditTablePage({ params }: { params: Promise<{ table_id: string }> }) {
  const { table_id } = await params;

  const cookieStore = await cookies();
  const storeId = cookieStore.get('store-id')?.value;

  if (!storeId) {
    return <div>店舗情報が見つかりません</div>;
  }

  // APIからテーブル情報を取得（店舗IDをクエリパラメータとして含める）
  const response = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/tables/${table_id}?storeId=${storeId}`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    console.error('テーブル情報の取得に失敗しました:', await response.text());
    notFound();
  }

  const table = await response.json();

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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">テーブル編集: {table.name}</h1>
        <Link
          href="/portal/tables"
          className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
        >
          戻る
        </Link>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <TableForm defaultValues={table} seatTypes={seatTypes} />
      </div>
    </div>
  );
}
