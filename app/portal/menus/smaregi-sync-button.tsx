'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SmaregiSyncButtonProps {
  storeId: string;
  enableSmaregiIntegration: boolean;
}

export default function SmaregiSyncButton({
  storeId,
  enableSmaregiIntegration,
}: SmaregiSyncButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSync = async () => {
    if (!enableSmaregiIntegration) {
      setError('スマレジ連携が無効になっています。設定画面から有効にしてください。');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/smaregi-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          store_id: storeId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'スマレジ同期に失敗しました');
      }

      const data = await response.json();
      const updateMessage = `${data.count || 0}件のメニューを更新`;
      const deleteMessage = data.deletedCount ? `${data.deletedCount}件のメニューを削除` : '';

      // 削除メッセージがある場合は、更新メッセージと組み合わせる
      const resultMessage = deleteMessage
        ? `${updateMessage}し、${deleteMessage}しました。`
        : `${updateMessage}しました。`;

      setSuccess(`スマレジ同期が完了しました。${resultMessage}`);

      // 画面を更新
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'スマレジ同期に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleSync}
        disabled={isLoading || !enableSmaregiIntegration}
        className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
          enableSmaregiIntegration
            ? 'bg-green-600 hover:bg-green-700'
            : 'bg-gray-400 cursor-not-allowed'
        }`}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            同期中...
          </>
        ) : (
          'スマレジ同期'
        )}
      </button>

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-2 text-sm text-green-600">
          {success}
        </div>
      )}
    </div>
  );
}
