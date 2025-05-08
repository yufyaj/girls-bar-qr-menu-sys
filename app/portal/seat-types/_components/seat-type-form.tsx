'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database } from '@/lib/database.types';

type SeatType = Database['public']['Tables']['seat_types']['Row'];
// マイグレーション後はcodeカラムが存在しないため、型定義を修正
type SeatTypeInput = {
  display_name: string;
  price_per_unit: number;  // 時間単位あたりの料金
  store_id: string;
  time_unit_minutes: number;
};

// フォームで使用する型（seat_type_idを含む）
interface SeatTypeFormValues extends SeatTypeInput {
  seat_type_id?: string;
}

export default function SeatTypeForm({
  defaultValues
}: {
  defaultValues: Partial<SeatTypeFormValues>;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formValues, setFormValues] = useState<SeatTypeInput>({
    display_name: defaultValues.display_name || '',
    price_per_unit: defaultValues.price_per_unit || 0, // 互換性のため両方チェック
    store_id: defaultValues.store_id || '',
    time_unit_minutes: defaultValues.time_unit_minutes || 30, // デフォルトは30分
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // 更新された値を取得
    let updatedValue;
    if (name === 'price_per_unit' || name === 'time_unit_minutes') {
      updatedValue = parseInt(value, 10) || 0;
    } else {
      updatedValue = value;
    }

    // フォーム値を更新
    setFormValues(prev => ({
      ...prev,
      [name]: updatedValue
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // バリデーション
      if (!formValues.display_name || formValues.price_per_unit < 0 || formValues.time_unit_minutes <= 0) {
        throw new Error('すべての項目を正しく入力してください');
      }

      // APIエンドポイントの決定（店舗IDをクエリパラメータとして含める）
      const endpoint = defaultValues.seat_type_id
        ? `/api/seat-types/${defaultValues.seat_type_id}?storeId=${formValues.store_id}`
        : `/api/seat-types?storeId=${formValues.store_id}`;

      // デバッグ用にフォーム値をコンソールに出力
      console.log('送信するフォーム値:', formValues);

      // APIリクエスト
      const method = defaultValues.seat_type_id ? 'PATCH' : 'POST';
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formValues),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '席種の保存に失敗しました');
      }

      // 成功したら一覧ページにリダイレクト
      router.push('/portal/seat-types');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* コードはサーバー側で自動生成されるため、フィールドなし */}

      <div>
        <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 mb-1">
          表示名
        </label>
        <input
          type="text"
          id="display_name"
          name="display_name"
          value={formValues.display_name}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        />
        <p className="mt-1 text-sm text-gray-500">
          画面に表示される席種の名前（例: カウンター席, テーブル席, VIP席）
        </p>
      </div>

      <div>
        <label htmlFor="time_unit_minutes" className="block text-sm font-medium text-gray-700 mb-1">
          時間単位
        </label>
        <div className="flex items-center">
          <select
            id="time_unit_minutes"
            name="time_unit_minutes"
            value={formValues.time_unit_minutes}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            required
          >
            <option value="10">10分</option>
            <option value="15">15分</option>
            <option value="20">20分</option>
            <option value="30">30分</option>
            <option value="60">60分（1時間）</option>
            <option value="90">90分（1.5時間）</option>
            <option value="120">120分（2時間）</option>
          </select>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          料金計算の基本単位となる時間
        </p>
      </div>

      <div>
        <label htmlFor="price_per_unit" className="block text-sm font-medium text-gray-700 mb-1">
          料金（{formValues.time_unit_minutes}分あたり）
        </label>
        <div className="flex items-center">
          <input
            type="number"
            id="price_per_unit"
            name="price_per_unit"
            value={formValues.price_per_unit}
            onChange={handleChange}
            min="0"
            step="100"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            required
          />
          <span className="ml-2">円</span>
        </div>
      </div>

      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          disabled={isSubmitting}
        >
          キャンセル
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
          disabled={isSubmitting}
        >
          {isSubmitting ? '保存中...' : defaultValues.seat_type_id ? '更新' : '作成'}
        </button>
      </div>
    </form>
  );
}
