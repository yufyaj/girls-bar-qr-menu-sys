import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import SeatTypeForm from '../../_components/seat-type-form';

export default async function EditSeatTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // UUIDとして処理（数値変換は不要）
  const seatTypeId = id;

  const cookieStore = await cookies();
  const storeId = cookieStore.get('store-id')?.value;

  if (!storeId) {
    return <div>店舗情報が見つかりません</div>;
  }

  // APIから席種情報を取得（店舗IDをクエリパラメータとして含める）
  const response = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/seat-types/${seatTypeId}?storeId=${storeId}`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    console.error('席種情報の取得に失敗しました:', await response.text());
    notFound();
  }

  const seatType = await response.json();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">席種編集: {seatType.display_name}</h1>
        <Link
          href="/portal/seat-types"
          className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
        >
          戻る
        </Link>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <SeatTypeForm defaultValues={seatType} />
      </div>
    </div>
  );
}
