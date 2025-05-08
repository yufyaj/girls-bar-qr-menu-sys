'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Database } from '@/lib/database.types';

type Table = Database['public']['Tables']['tables']['Row'];
type SeatType = Database['public']['Tables']['seat_types']['Row'];

// テーブルフォームで使用する入力値の型
type TableInput = {
  name: string;
  seat_type_id: string;
  store_id: string;
};

// フォームで使用する型（table_idを含む）
interface TableFormValues extends Partial<TableInput> {
  table_id?: string;
  seat_type?: {
    seat_type_id: string;
    display_name: string;
    price_per_unit: number;
  };
}

interface TableFormProps {
  defaultValues: TableFormValues;
  seatTypes?: SeatType[];
}

export default function TableForm({ defaultValues, seatTypes = [] }: TableFormProps) {
  const router = useRouter();
  // seat_type_idの初期値を取得（seat_typeオブジェクトから取得するか、直接指定された値を使用）
  const initialSeatTypeId = defaultValues.seat_type?.seat_type_id || defaultValues.seat_type_id || '';

  const [formValues, setFormValues] = useState<TableInput>({
    name: defaultValues.name || '',
    seat_type_id: initialSeatTypeId,
    store_id: defaultValues.store_id || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSeatTypes, setAvailableSeatTypes] = useState<SeatType[]>(seatTypes);

  // 席種一覧を取得
  const fetchSeatTypes = async () => {
    try {
      const response = await fetch(`/api/seat-types?storeId=${formValues.store_id}`);
      if (!response.ok) {
        throw new Error('席種一覧の取得に失敗しました');
      }
      const data = await response.json();
      setAvailableSeatTypes(data);
    } catch (error) {
      console.error('席種一覧取得エラー:', error);
      setError('席種一覧の取得に失敗しました');
    }
  };

  // コンポーネントマウント時に席種一覧を取得
  useEffect(() => {
    if (seatTypes.length === 0) {
      fetchSeatTypes();
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // バリデーション
      if (!formValues.name || !formValues.seat_type_id) {
        throw new Error('すべての項目を入力してください');
      }

      // APIエンドポイントの決定（店舗IDをクエリパラメータとして含める）
      const endpoint = defaultValues.table_id
        ? `/api/tables/${defaultValues.table_id}?storeId=${formValues.store_id}`
        : `/api/tables?storeId=${formValues.store_id}`;

      // APIリクエスト
      const response = await fetch(endpoint, {
        method: defaultValues.table_id ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formValues),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'テーブルの保存に失敗しました');
      }

      // 成功時の処理
      router.push('/portal/tables');
      router.refresh();
    } catch (error) {
      console.error('テーブル保存エラー:', error);
      setError(error instanceof Error ? error.message : '予期せぬエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            テーブル名
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formValues.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            required
          />
        </div>

        <div>
          <label htmlFor="seat_type_id" className="block text-sm font-medium text-gray-700 mb-1">
            席種
          </label>
          <select
            id="seat_type_id"
            name="seat_type_id"
            value={formValues.seat_type_id}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            required
          >
            <option value="">席種を選択してください</option>
            {availableSeatTypes.map((seatType) => (
              <option key={seatType.seat_type_id} value={seatType.seat_type_id}>
                {seatType.display_name} ({seatType.price_per_unit}円/{seatType.time_unit_minutes || 30}分)
              </option>
            ))}
          </select>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
          >
            {isLoading ? '保存中...' : defaultValues.table_id ? '更新する' : '作成する'}
          </button>
        </div>
      </div>
    </form>
  );
}
