'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface CheckoutCompleteProps {
  storeName: string;
  tableName: string;
  totalAmount: number;
  subtotalAmount?: number;
  taxAmount?: number;
  taxRate?: number;
}

export default function CheckoutComplete({
  storeName,
  tableName,
  totalAmount,
  subtotalAmount = 0,
  taxAmount = 0,
  taxRate = 10.0
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

          <div className="mt-4 text-left">
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">小計（内税）:</span>
              <span className="text-gray-600">{subtotalAmount.toLocaleString()}円</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">内消費税（{taxRate}%）:</span>
              <span className="text-gray-600">{taxAmount.toLocaleString()}円</span>
            </div>
            <div className="flex justify-between text-xl font-semibold mt-2">
              <span>合計金額:</span>
              <span>{totalAmount.toLocaleString()}円</span>
            </div>
          </div>
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
