'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Cast {
  id: string;
  user_id: string;
  display_name: string;
  nomination_fee: number;
}

interface CastSelectionProps {
  isOpen: boolean;
  onClose: () => void;
  tableId: string;
  sessionId: string;
  storeId: string;
}

export default function CastSelection({
  isOpen,
  onClose,
  tableId,
  sessionId,
  storeId
}: CastSelectionProps) {
  const [casts, setCasts] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // キャスト一覧を取得
  useEffect(() => {
    if (!isOpen) return;

    const fetchCasts = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/casts?store_id=${storeId}`);

        if (!response.ok) {
          throw new Error('キャスト情報の取得に失敗しました');
        }

        const data = await response.json();
        setCasts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
        console.error('キャスト取得エラー:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCasts();
  }, [isOpen, storeId]);

  // キャスト選択処理
  const handleCastSelect = async (castId: string) => {
    try {
      setIsSubmitting(true);
      setError(null);

      // 指名キャストを記録
      const response = await fetch(`/api/tables/${tableId}/sessions/${sessionId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selected_cast_id: castId,
          is_new_customer: false,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '指名の処理に失敗しました');
      }

      // モーダルを閉じて画面を更新
      onClose();
      router.refresh();
    } catch (err) {
      console.error('キャスト選択エラー:', err);
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">キャストを選択</h2>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-500"
            onClick={onClose}
          >
            <span className="sr-only">閉じる</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center">
            <p className="text-gray-500">読み込み中...</p>
          </div>
        ) : casts.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-gray-500">キャストが登録されていません</p>
            <button
              type="button"
              className="mt-4 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              onClick={onClose}
            >
              閉じる
            </button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4">
            {casts.map((cast) => (
              <button
                key={cast.id}
                className="flex items-center p-3 border rounded-lg hover:bg-gray-50"
                onClick={() => handleCastSelect(cast.user_id)}
                disabled={isSubmitting}
              >
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                  <span className="text-gray-500 text-sm">{cast.display_name.charAt(0)}</span>
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{cast.display_name}</p>
                  {cast.nomination_fee > 0 && (
                    <p className="text-sm text-gray-500">指名料: {cast.nomination_fee.toLocaleString()}円</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
