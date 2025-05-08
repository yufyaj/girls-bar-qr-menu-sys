'use client';

import { useState } from 'react';

interface CartItem {
  menu_id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  target_cast_id: string | null;
  from_user_id: string | null;
}

interface Cast {
  user_id: string;
  display_name: string;
}

interface CartProps {
  items: CartItem[];
  updateQuantity: (index: number, quantity: number) => void;
  clearCart: () => void;
  sessionId: string;
  tableId: string;
  tableName: string;
  casts: Cast[];
}

export default function Cart({
  items,
  updateQuantity,
  clearCart,
  sessionId,
  tableId,
  tableName,
  casts
}: CartProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // 合計金額を計算
  const totalPrice = items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  // 注文を送信
  const submitOrder = async () => {
    if (items.length === 0) return;

    try {
      setIsSubmitting(true);
      setOrderError(null);

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
        })),
        proxy: true,
        created_by_role: 'staff'
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
      clearCart();

      // 2秒後に成功メッセージをクリア
      setTimeout(() => {
        setOrderSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('注文エラー:', error);
      setOrderError(error instanceof Error ? error.message : '注文処理に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // キャスト名を取得
  const getCastName = (castId: string | null) => {
    if (!castId) return null;
    const cast = casts.find(c => c.user_id === castId);
    return cast ? cast.display_name : '不明なキャスト';
  };

  return (
    <div className="bg-gray-50 p-4 rounded-lg border sticky top-4">
      <h2 className="text-lg font-medium text-gray-900 mb-4">
        カート - {tableName}
      </h2>

      {items.length === 0 ? (
        <p className="text-gray-500 text-center py-4">カートは空です</p>
      ) : (
        <>
          <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
            {items.map((item, index) => (
              <div key={`${item.menu_id}-${item.target_cast_id}-${index}`} className="flex justify-between border-b pb-2">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-gray-500">¥{item.price.toLocaleString()} × {item.quantity}</p>
                  {item.target_cast_id && (
                    <p className="text-xs text-purple-600">
                      {getCastName(item.target_cast_id)}に奢る
                    </p>
                  )}
                </div>
                <div className="flex items-center">
                  <button
                    onClick={() => updateQuantity(index, item.quantity - 1)}
                    className="text-gray-500 hover:text-gray-700 px-2"
                  >
                    -
                  </button>
                  <span className="mx-1">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(index, item.quantity + 1)}
                    className="text-gray-500 hover:text-gray-700 px-2"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-3">
            <div className="flex justify-between font-bold text-lg mb-4">
              <span>合計</span>
              <span>¥{totalPrice.toLocaleString()}</span>
            </div>

            <div className="space-y-2">
              <button
                onClick={submitOrder}
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-blue-300"
              >
                {isSubmitting ? '処理中...' : '代理注文を確定'}
              </button>
              <button
                onClick={clearCart}
                className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300"
              >
                カートをクリア
              </button>
            </div>
          </div>
        </>
      )}

      {orderSuccess && (
        <div className="mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          注文が正常に送信されました
        </div>
      )}

      {orderError && (
        <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {orderError}
        </div>
      )}
    </div>
  );
}
