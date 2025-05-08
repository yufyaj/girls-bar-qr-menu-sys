'use client';

import { useState, useEffect } from 'react';

interface Cast {
  id: string;
  user_id: string;
  display_name: string;
}

interface CastSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (castId: string, castName: string) => void;
  storeId: string;
}

export default function CastSelectModal({ isOpen, onClose, onSelect, storeId }: CastSelectModalProps) {
  const [casts, setCasts] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        {loading ? (
          <div className="py-8 text-center">
            <p className="text-gray-500">読み込み中...</p>
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-red-500">{error}</p>
            <button
              type="button"
              className="mt-4 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              onClick={onClose}
            >
              閉じる
            </button>
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
                onClick={() => onSelect(cast.user_id, cast.display_name)}
              >
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                  <span className="text-gray-500 text-sm">{cast.display_name.charAt(0)}</span>
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{cast.display_name}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
