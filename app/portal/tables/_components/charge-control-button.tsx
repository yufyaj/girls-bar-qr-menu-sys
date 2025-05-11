'use client';

import { useState } from 'react';

interface ChargeControlButtonProps {
  tableId: string;
  sessionId: string;
  isPaused: boolean;
}

export default function ChargeControlButton({ tableId, sessionId, isPaused }: ChargeControlButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPauseState, setCurrentPauseState] = useState(isPaused);

  const handleToggleCharge = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 課金停止または再開のAPIを呼び出す
      const endpoint = currentPauseState
        ? `/api/tables/${tableId}/sessions/${sessionId}/resume`
        : `/api/tables/${tableId}/sessions/${sessionId}/pause`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '処理に失敗しました');
      }

      // 状態を更新
      setCurrentPauseState(!currentPauseState);

      // ページをリロードして最新の状態を反映
      window.location.reload();
    } catch (err) {
      console.error('課金制御エラー:', err);
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleToggleCharge}
        disabled={isLoading}
        className={`w-full py-1 px-3 rounded-md text-sm ${
          currentPauseState
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-yellow-500 hover:bg-yellow-600 text-white'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isLoading ? '処理中...' : currentPauseState ? '課金再開' : '課金一時停止'}
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
