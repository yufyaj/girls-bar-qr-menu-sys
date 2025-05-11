'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SeatSelectionProps {
  tableId: string;
  tableName: string;
  sessionId: string;
}

export default function SeatSelection({ tableId, tableName, sessionId }: SeatSelectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState(1);
  const router = useRouter();

  const handleSeatSelection = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 座席選択時間と人数を記録し、自動的に新規客として設定
      const response = await fetch(`/api/tables/${tableId}/sessions/${sessionId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          charge_started_at: new Date().toISOString(),
          guest_count: guestCount,
          is_new_customer: true, // 自動的に新規客として設定
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '座席選択の処理に失敗しました');
      }

      // 画面を更新してメニュー表示に進む
      router.refresh();
    } catch (err) {
      console.error('座席選択エラー:', err);
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <h2 className="text-xl font-bold mb-4">ようこそ</h2>
      <p className="mb-4">
        テーブル「{tableName}」にお座りになりますか？
      </p>

      <div className="mb-6">
        <label htmlFor="guestCount" className="block text-sm font-medium text-gray-700 mb-1">
          人数を選択してください
        </label>
        <select
          id="guestCount"
          value={guestCount}
          onChange={(e) => setGuestCount(Number(e.target.value))}
          className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
            <option key={num} value={num}>
              {num}人
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handleSeatSelection}
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
      >
        {isLoading ? '処理中...' : 'この席に座る'}
      </button>
    </div>
  );
}
