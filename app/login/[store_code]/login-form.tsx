'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

// ログインアクションの型定義
type LoginActionResult = 
  | { error: string }
  | { success: true; redirectTo: string };

// ログインフォームコンポーネント
export default function LoginForm({ 
  storeCode, 
  storeName,
  loginAction
}: { 
  storeCode: string; 
  storeName: string;
  loginAction: (formData: FormData) => Promise<LoginActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (formData: FormData) => {
    const result = await loginAction(formData);
    
    if ('error' in result) {
      setError(result.error);
    } else if (result.success && result.redirectTo) {
      router.push(result.redirectTo);
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
      
      <form action={handleSubmit}>
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
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          ログイン
        </button>
      </form>
    </div>
  );
}
