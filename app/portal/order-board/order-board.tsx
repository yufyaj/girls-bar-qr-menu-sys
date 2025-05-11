'use client';

import { useState, useEffect, useMemo } from 'react';

// 注文アイテムの型定義
interface OrderItem {
  order_id: string;
  order_item_id: string;
  status: string;
  created_at: string;
  created_by_role: string;
  proxy: boolean;
  table_name: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  target_cast_id: string | null;
  target_cast_name: string | null;
}

// 注文ステータスの定義
const ORDER_STATUSES = [
  { value: 'new', label: '新規', color: 'bg-green-500 text-white', nextStatus: 'ack' },
  { value: 'ack', label: '確認済', color: 'bg-pink-500 text-white', nextStatus: 'prep' },
  { value: 'prep', label: '準備中', color: 'bg-pink-500 text-white', nextStatus: 'served' },
  { value: 'served', label: '提供済', color: 'bg-gray-400 text-white', nextStatus: 'closed' },
  { value: 'closed', label: '完了', color: 'bg-gray-500 text-white', nextStatus: 'closed' },
  { value: 'cancel', label: 'キャンセル', color: 'bg-red-500 text-white', nextStatus: 'cancel' },
];

interface OrderBoardProps {
  initialOrderItems: OrderItem[];
}

export default function OrderBoard({ initialOrderItems }: OrderBoardProps) {
  const [orderItems, setOrderItems] = useState<OrderItem[]>(initialOrderItems);

  // 完了とキャンセル以外の注文アイテムをフィルタリングして古い順に並べる
  const activeOrderItems = useMemo(() => {
    return orderItems
      .filter((item: OrderItem) => item.status !== 'closed' && item.status !== 'cancel')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [orderItems]);

  // 定期的なポーリングとBroadcast Channelの設定
  useEffect(() => {
    // 最新の注文データを取得する関数
    const fetchLatestOrders = async () => {
      try {
        const response = await fetch('/api/orders/active-items');
        if (response.ok) {
          const data = await response.json();
          setOrderItems(data);
        } else {
          console.error('注文データ取得エラー:', await response.text());
        }
      } catch (error) {
        console.error('注文データ取得エラー:', error);
      }
    };

    // Broadcast Channelの設定
    const broadcastChannel = new BroadcastChannel('broadcast:orders');
    broadcastChannel.onmessage = function(event) {
      // 注文関連のイベントが発生したら最新データを取得
      if (
        event.data.type === 'order:update' ||
        event.data.type === 'order:new' ||
        event.data.type === 'order_item:update' ||
        event.data.type === 'order_item:delete'
      ) {
        fetchLatestOrders();
      }
    };

    // 初回データ取得
    fetchLatestOrders();

    // 定期的なポーリングの設定（3秒ごと）
    const pollingInterval = setInterval(fetchLatestOrders, 3000);

    // 画面がフォーカスされたときにも更新
    const handleFocus = () => {
      fetchLatestOrders();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      broadcastChannel.close();
      clearInterval(pollingInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);



  // 注文アイテムのステータスを更新する関数
  const updateOrderItemStatus = async (orderItemId: string, newStatus: string) => {
    try {
      // 先にローカルの状態を更新して即時反映
      setOrderItems(prevItems =>
        prevItems.map(orderItem =>
          orderItem.order_item_id === orderItemId
            ? { ...orderItem, status: newStatus }
            : orderItem
        )
      );

      const formData = new FormData();
      formData.append('status', newStatus);

      const response = await fetch(`/api/order-items/${orderItemId}/status`, {
        method: 'PATCH',
        body: formData
      });

      if (response.ok) {
        // 最新データは自動的にポーリングで取得されるため、ここでは取得しない
      } else {
        const errorData = await response.json();
        console.error('注文アイテムのステータス更新に失敗しました', errorData);

        // 更新に失敗した場合は最新データを取得
        const updatedResponse = await fetch('/api/orders/active-items');
        if (updatedResponse.ok) {
          const data = await updatedResponse.json();
          setOrderItems(data);
        }
      }
    } catch (error) {
      console.error('注文アイテムステータス更新エラー:', error);

      // エラーが発生した場合も最新データを取得
      console.log('エラー発生後のデータを取得中...');
      const updatedResponse = await fetch('/api/orders/active-items');
      if (updatedResponse.ok) {
        const data = await updatedResponse.json();
        setOrderItems(data);
      }
    }
  };

  // 次のステータスに進める関数
  const advanceOrderStatus = (item: OrderItem) => {
    const currentStatus = ORDER_STATUSES.find(s => s.value === item.status);
    if (currentStatus && currentStatus.nextStatus) {
      // 注文アイテム単位でステータスを更新
      updateOrderItemStatus(item.order_item_id, currentStatus.nextStatus);
    }
  };

  // 注文アイテムを削除する関数
  const deleteOrderItem = async (item: OrderItem, e: React.MouseEvent) => {
    e.stopPropagation(); // イベントの伝播を停止

    // 確認ダイアログを表示
    if (!confirm(`${item.product_name}をキャンセルしますか？`)) {
      return;
    }

    // 先にローカルの状態を更新して即時反映
    setOrderItems(prevItems =>
      prevItems.filter(orderItem => orderItem.order_item_id !== item.order_item_id)
    );

    // APIを呼び出してバックエンドを更新
    try {
      // 注文アイテム削除APIを使用
      const response = await fetch(`/api/order-items/${item.order_item_id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // 最新データは自動的にポーリングで取得されるため、ここでは取得しない
      } else {
        const errorData = await response.json();
        console.error('注文アイテムのキャンセルに失敗しました', errorData);

        // キャンセルに失敗した場合は最新データを取得
        const updatedResponse = await fetch('/api/orders/active-items');
        if (updatedResponse.ok) {
          const data = await updatedResponse.json();
          setOrderItems(data);
        }
      }
    } catch (error) {
      console.error('注文アイテムキャンセルエラー:', error);

      // エラーが発生した場合も最新データを取得
      const updatedResponse = await fetch('/api/orders/active-items');
      if (updatedResponse.ok) {
        const data = await updatedResponse.json();
        setOrderItems(data);
      }
    }
  };

  // 経過時間を計算する関数
  const getElapsedTime = (createdAt: string) => {
    const orderTime = new Date(createdAt).getTime();
    const now = new Date().getTime();
    const diffMinutes = Math.floor((now - orderTime) / (1000 * 60));
    return `${diffMinutes}分経過`;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">注文ボード</h1>

      <div className="bg-gray-50 p-4 rounded-md">
        <h2 className="font-bold mb-4 px-2 py-1 border-b border-gray-200">
          アクティブな注文 ({activeOrderItems.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {activeOrderItems.map((item) => {
            const statusInfo = ORDER_STATUSES.find(s => s.value === item.status);
            return (
              <div
                key={item.order_item_id}
                className="rounded-md shadow-sm overflow-hidden"
                onClick={() => advanceOrderStatus(item)}
              >
                {/* ヘッダー部分 */}
                <div className={`flex justify-between items-center p-2 ${statusInfo?.color}`}>
                  <div className="flex items-center">
                    <span className="font-bold">{item.table_name}</span>
                    <span className="ml-2 text-xs">({item.order_item_id.substring(0, 4)})</span>
                  </div>
                  <span className="text-xs">{statusInfo?.label}</span>
                </div>

                {/* 商品情報部分 */}
                <div className="p-3 bg-white">
                  <div className="font-medium">{item.product_name}</div>

                  {/* 数量と経過時間 */}
                  <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center">
                      <span className="text-sm">×{item.quantity}</span>
                      <span className="ml-3 text-xs text-gray-500">{getElapsedTime(item.created_at)}</span>
                    </div>

                    {/* キャンセルボタン */}
                    <button
                      className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                      onClick={(e) => deleteOrderItem(item, e)}
                    >
                      ×
                    </button>
                  </div>

                  {/* キャスト情報 */}
                  {item.target_cast_name && (
                    <div className="text-sm text-blue-600 mt-1">
                      {item.target_cast_name}へ
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {activeOrderItems.length === 0 && (
            <div className="col-span-full text-center text-gray-500 text-sm py-8">
              アクティブな注文はありません
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold mb-2">リアルタイム更新</h2>
        <p className="text-sm text-gray-600">
          このページは自動的に更新されます。注文ステータスの変更は即時に反映されます。
        </p>
      </div>
    </div>
  );
}
