'use client';

import { useState, useEffect } from 'react';

interface Cast {
  id: string;
  user_id: string;
  display_name: string;
  nomination_fee: number;
}

interface CastNominationButtonProps {
  tableId: string;
  sessionId: string;
  storeId: string;
}

export default function CastNominationButton({
  tableId,
  sessionId,
  storeId
}: CastNominationButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [loadingCasts, setLoadingCasts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nominations, setNominations] = useState<{cast_id: string, display_name: string, nomination_fee: number}[]>([]);
  const [loadingNominations, setLoadingNominations] = useState(false);

  // キャスト一覧を取得
  useEffect(() => {
    if (!isModalOpen) return;

    const fetchCasts = async () => {
      setLoadingCasts(true);
      try {
        const response = await fetch(`/api/casts?store_id=${storeId}`);
        if (!response.ok) {
          throw new Error('キャスト情報の取得に失敗しました');
        }
        const data = await response.json();
        setCasts(data);
      } catch (err) {
        console.error('キャスト取得エラー:', err);
        setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
      } finally {
        setLoadingCasts(false);
      }
    };

    fetchCasts();
  }, [isModalOpen, storeId]);

  // 指名情報を取得
  useEffect(() => {
    if (!sessionId) return;

    const fetchNominations = async () => {
      setLoadingNominations(true);
      try {
        const response = await fetch(`/api/sessions/${sessionId}/nominations`);
        if (!response.ok) {
          throw new Error('指名情報の取得に失敗しました');
        }
        const data = await response.json();
        setNominations(data);
      } catch (err) {
        console.error('指名情報取得エラー:', err);
      } finally {
        setLoadingNominations(false);
      }
    };

    fetchNominations();
  }, [sessionId, success]);

  // キャスト指名処理
  const handleCastNomination = async (castId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      // 選択されたキャストの情報を取得
      const selectedCast = casts.find(cast => cast.user_id === castId);
      if (!selectedCast) {
        throw new Error('選択されたキャストの情報が見つかりません');
      }

      // 指名情報を登録
      const response = await fetch(`/api/sessions/${sessionId}/nominations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cast_id: castId,
          nomination_fee: selectedCast.nomination_fee
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'キャスト指名の登録に失敗しました');
      }

      setSuccess(`${selectedCast.display_name}さんの指名を登録しました`);
      setIsModalOpen(false);
    } catch (err) {
      console.error('キャスト指名エラー:', err);
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => setIsModalOpen(true)}
        className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors"
      >
        キャスト指名
      </button>

      {/* 指名履歴表示 */}
      {nominations.length > 0 && (
        <div className="mt-2 text-sm">
          <p className="font-semibold">指名履歴:</p>
          <ul className="list-disc pl-5">
            {nominations.map((nomination, index) => (
              <li key={index}>
                {nomination.display_name} ({nomination.nomination_fee.toLocaleString()}円)
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* キャスト選択モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">キャスト指名</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">
                  {success}
                </div>
              )}

              {loadingCasts ? (
                <div className="py-8 text-center">
                  <p className="text-gray-500">読み込み中...</p>
                </div>
              ) : casts.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-gray-500">キャストが登録されていません</p>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4">
                  {casts.map((cast) => (
                    <button
                      key={cast.id}
                      className="flex items-center p-3 border rounded-lg hover:bg-gray-50"
                      onClick={() => handleCastNomination(cast.user_id)}
                      disabled={isLoading}
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
        </div>
      )}
    </div>
  );
}
