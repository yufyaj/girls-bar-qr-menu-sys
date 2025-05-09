'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

// ログインフォームコンポーネント
export default function LoginForm({
  storeCode,
  storeName
}: {
  storeCode: string;
  storeName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;

      if (!email || !password) {
        setError('メールアドレスとパスワードは必須です');
        setIsLoading(false);
        return;
      }

      // クライアント側で直接APIを呼び出す
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          storeCode,
        }),
        // クレデンシャルを含める（Cookieを受け取るため）
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Login error details:', result.error);
        setError(result.error || 'ログインに失敗しました');
        setIsLoading(false);
        return;
      }

      console.log('ログイン成功、Cookieを確認:');
      console.log('document.cookie:', document.cookie);

      // 少し待ってからリダイレクト（Cookieが設定される時間を確保）
      setTimeout(() => {
        console.log('リダイレクト直前のCookie再確認:', document.cookie);
        router.push('/portal/dashboard');
      }, 1000);
    } catch (error) {
      console.error('Login error:', error);
      setError('ログイン処理中にエラーが発生しました');
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-center">{storeName}</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <input type="hidden" name="store_code" value={storeCode} />

        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            メールアドレス
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div className="mb-6">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            パスワード
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full ${isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} text-white py-2 px-4 rounded-md`}
        >
          {isLoading ? 'ログイン中...' : 'ログイン'}
        </button>
      </form>
    </div>
  );
}
