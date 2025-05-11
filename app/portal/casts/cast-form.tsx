'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CastFormProps {
  storeId: string;
  castId?: string;
  email?: string;
  displayName?: string;
  nominationFee?: number;
  isEdit?: boolean;
}

export default function CastForm({
  storeId,
  castId,
  email = '',
  displayName = '',
  nominationFee = 0,
  isEdit = false,
}: CastFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: email,
    displayName: displayName,
    password: '',
    nominationFee: nominationFee,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // 指名料の場合は数値に変換
    if (name === 'nominationFee') {
      const numValue = value === '' ? 0 : parseInt(value, 10);
      setFormData({
        ...formData,
        [name]: isNaN(numValue) ? 0 : numValue,
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isEdit) {
        // キャスト情報の更新
        const response = await fetch(`/api/casts/${castId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            display_name: formData.displayName,
            password: formData.password || undefined, // パスワードが空の場合は送信しない
            nomination_fee: formData.nominationFee,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'キャスト情報の更新に失敗しました');
        }

        setSuccess('キャスト情報を更新しました');
      } else {
        // 新規キャストの追加
        const response = await fetch('/api/casts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            display_name: formData.displayName,
            password: formData.password,
            store_id: storeId,
            nomination_fee: formData.nominationFee,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'キャストの追加に失敗しました');
        }

        setSuccess('キャストを追加しました');
        // フォームをリセット
        setFormData({
          email: '',
          displayName: '',
          password: '',
          nominationFee: 0,
        });
      }

      // 成功メッセージを表示した後、一覧画面に戻る
      setTimeout(() => {
        router.push('/portal/casts');
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!castId || !confirm('このキャストを削除しますか？')) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/casts/${castId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'キャストの削除に失敗しました');
      }

      setSuccess('キャストを削除しました');

      // 成功メッセージを表示した後、一覧画面に戻る
      setTimeout(() => {
        router.push('/portal/casts');
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
            名前
          </label>
          <div className="mt-1">
            <input
              type="text"
              name="displayName"
              id="displayName"
              value={formData.displayName}
              onChange={handleChange}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
              required
              placeholder="キャストの名前"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            メールアドレス
          </label>
          <div className="mt-1">
            <input
              type="email"
              name="email"
              id="email"
              value={formData.email}
              onChange={handleChange}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            パスワード {isEdit && '(変更する場合のみ入力)'}
          </label>
          <div className="mt-1">
            <input
              type="password"
              name="password"
              id="password"
              value={formData.password}
              onChange={handleChange}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
              required={!isEdit}
              minLength={8}
            />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            パスワードは8文字以上で設定してください
          </p>
        </div>

        <div>
          <label htmlFor="nominationFee" className="block text-sm font-medium text-gray-700">
            指名料（円）
          </label>
          <div className="mt-1">
            <input
              type="number"
              name="nominationFee"
              id="nominationFee"
              value={formData.nominationFee}
              onChange={handleChange}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
              min="0"
              step="100"
            />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            このキャストの指名料を設定してください
          </p>
        </div>

        <div className="flex justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.back()}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {isLoading ? '処理中...' : isEdit ? '更新' : '追加'}
            </button>
          </div>

          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isLoading}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-red-300"
            >
              削除
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
