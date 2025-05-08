'use client';

import { useState } from 'react';
import { useCart, CartItem } from './cart-context';

interface CartDisplayProps {
  sessionId: string;
  tableId: string;
}

export default function CartDisplay({ sessionId, tableId }: CartDisplayProps) {
  const { items, removeItem, updateQuantity, clearCart, totalItems, totalPrice } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // 注文を送信する関数
  const submitOrder = async () => {
    if (items.length === 0) return;

    setIsSubmitting(true);
    setOrderError(null);

    try {
      // 注文データを準備
      const orderData = {
        session_id: sessionId,
        table_id: tableId,
        items: items.map(item => ({
          menu_id: item.menu_id,
          product_id: item.product_id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          target_cast_id: item.target_cast_id
        }))
      };

      // 注文APIを呼び出し
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '注文の送信に失敗しました');
      }

      // 注文成功
      setOrderSuccess(true);

      // カートをクリア
      clearCart();

      // 2秒後に成功メッセージをリセット
      setTimeout(() => {
        setOrderSuccess(false);
      }, 2000);

    } catch (err) {
      setOrderError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
      console.error('注文エラー:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 数量変更ボタン
  const QuantityControl = ({ item }: { item: CartItem }) => (
    <div className="flex items-center">
      <button
        type="button"
        className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center"
        onClick={() => updateQuantity(item.menu_id, item.quantity - 1)}
      >
        <span>-</span>
      </button>
      <span className="mx-2">{item.quantity}</span>
      <button
        type="button"
        className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center"
        onClick={() => updateQuantity(item.menu_id, item.quantity + 1)}
      >
        <span>+</span>
      </button>
    </div>
  );

  if (orderSuccess) {
    return (
      <div className="text-center py-8">
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <p>注文が完了しました！</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        カートは空です。メニューから商品を追加してください。
      </div>
    );
  }

  return (
    <div>
      {orderError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{orderError}</p>
        </div>
      )}

      <div className="divide-y">
        {items.map((item) => (
          <div key={item.menu_id} className="py-4 flex justify-between items-center">
            <div className="flex-1">
              <h3 className="text-lg font-medium">{item.name}</h3>
              <p className="text-sm text-gray-500">
                {item.price.toLocaleString()}円 × {item.quantity}
              </p>
              {item.target_cast_name && (
                <p className="text-sm text-blue-600">
                  {item.target_cast_name}に奢る
                </p>
              )}

            </div>

            <div className="flex items-center space-x-4">
              <QuantityControl item={item} />

              <button
                type="button"
                className="text-red-500"
                onClick={() => removeItem(item.menu_id)}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t pt-4">
        <div className="flex justify-between mb-2">
          <span>小計 ({totalItems}点)</span>
          <span>{totalPrice.toLocaleString()}円</span>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            className={`bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 w-full ${
              isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={submitOrder}
            disabled={isSubmitting}
          >
            {isSubmitting ? '処理中...' : '注文する'}
          </button>
          <p className="mt-2 text-sm text-gray-500">
            注文後、右側の会計画面から会計処理ができます
          </p>
        </div>
      </div>
    </div>
  );
}
