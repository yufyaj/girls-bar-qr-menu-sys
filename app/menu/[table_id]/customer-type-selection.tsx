'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CustomerTypeSelectionProps {
  tableId: string;
  sessionId: string;
  storeId: string;
  onShowCastSelection: () => void;
}

export default function CustomerTypeSelection({
  tableId,
  sessionId,
  storeId,
  onShowCastSelection
}: CustomerTypeSelectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleNewCustomer = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 新規客として記録
      const response = await fetch(`/api/tables/${tableId}/sessions/${sessionId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_new_customer: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '処理に失敗しました');
      }

      // 画面を更新してメニュー表示に進む
      router.refresh();
    } catch (err) {
      console.error('新規客選択エラー:', err);
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDesignatedCustomer = () => {
    // キャスト選択モーダルを表示
    onShowCastSelection();
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <h2 className="text-xl font-bold mb-4">ご利用タイプを選択</h2>
      <p className="mb-6">
        ご利用方法をお選びください
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <button
          onClick={handleNewCustomer}
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
        >
          {isLoading ? '処理中...' : '新規（指名なし）'}
        </button>

        <button
          onClick={handleDesignatedCustomer}
          disabled={isLoading}
          className="w-full bg-purple-600 text-white py-3 px-4 rounded-md hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed"
        >
          {isLoading ? '処理中...' : '指名あり'}
        </button>
      </div>
    </div>
  );
}
