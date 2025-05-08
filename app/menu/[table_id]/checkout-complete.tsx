'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface CheckoutCompleteProps {
  storeName: string;
  tableName: string;
  totalAmount: number;
}

export default function CheckoutComplete({
  storeName,
  tableName,
  totalAmount
}: CheckoutCompleteProps) {
  const router = useRouter();

  // 30秒後にリロードして初期画面に戻る
  useEffect(() => {
    // クライアントサイドでのみ実行
    if (typeof window !== 'undefined') {


      const timer = setTimeout(() => {

        // クエリパラメータを削除してリロード
        window.location.href = window.location.pathname;
      }, 30000);

      return () => clearTimeout(timer);
    }
  }, [storeName, tableName, totalAmount]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-green-600 mb-6">
          お会計ありがとうございました
        </h1>

        <div className="mb-6">
          <p className="text-gray-700 mb-2">
            {storeName}
          </p>
          <p className="text-gray-700 mb-4">
            テーブル: {tableName}
          </p>
          <p className="text-xl font-semibold">
            合計金額: {totalAmount.toLocaleString()}円
          </p>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <p className="text-gray-500 text-sm mb-4">
            またのご来店をお待ちしております。
          </p>
          <p className="text-gray-400 text-xs">
            この画面は30秒後に自動的に閉じます。
          </p>
        </div>
      </div>
    </div>
  );
}
