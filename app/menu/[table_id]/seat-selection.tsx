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
  const router = useRouter();

  const handleSeatSelection = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 座席選択時間を記録
      const response = await fetch(`/api/tables/${tableId}/sessions/${sessionId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          charge_started_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '座席選択の処理に失敗しました');
      }

      // 画面を更新して次のステップ（新規/指名選択）に進む
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
      <p className="mb-6">
        テーブル「{tableName}」にお座りになりますか？
      </p>

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
