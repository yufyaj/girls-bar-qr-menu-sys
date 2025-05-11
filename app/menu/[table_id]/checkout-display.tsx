'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from './cart-context';
import { calculateElapsedMinutes, calculateCharge } from '@/lib/charge';

interface OrderItem {
  order_id: string;
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  target_cast_id: string | null;
  target_cast_name: string | null;
}

interface CheckoutDisplayProps {
  sessionId: string;
  tableId: string;
  tableName: string;
  storeName: string;
  seatTypeName: string;
  pricePerHalfHour: number;
  chargeStartedAt: string | null;
  timeUnitMinutes?: number;
}

export default function CheckoutDisplay({
  sessionId,
  tableId,
  tableName,
  storeName,
  seatTypeName,
  pricePerHalfHour,
  chargeStartedAt,
  timeUnitMinutes = 30,
}: CheckoutDisplayProps) {
  const router = useRouter();
  const { clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [chargeAmount, setChargeAmount] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<string>('');
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderTotalPrice, setOrderTotalPrice] = useState<number>(0);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(true);



  // 注文データと最新の料金を取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 注文データを取得
        setIsLoadingOrders(true);
        const response = await fetch(`/api/sessions/${sessionId}/orders`);

        if (!response.ok) {
          throw new Error('注文データの取得に失敗しました');
        }

        const data = await response.json();
        setOrderItems(data.orders);
        setOrderTotalPrice(data.totalPrice);

        // 初期表示時に最新の料金も取得
        if (chargeStartedAt && sessionId) {
          console.log('初期表示時に最新の料金を取得します');
          await fetchChargeAmount();
        }
      } catch (error) {
        console.error('データ取得エラー:', error);
      } finally {
        setIsLoadingOrders(false);
      }
    };

    if (sessionId) {
      fetchData();
    }
  }, [sessionId, chargeStartedAt]);

  // 経過時間の表示を更新する関数
  const updateElapsedTimeDisplay = () => {
    if (!chargeStartedAt) return;

    const startTime = new Date(chargeStartedAt);
    const now = new Date();

    // 経過時間を分単位で計算
    const elapsedMinutes = calculateElapsedMinutes(startTime, now);

    // 経過時間の表示形式を設定
    const hours = Math.floor(elapsedMinutes / 60);
    const minutes = elapsedMinutes % 60;
    const timeString = `${hours}時間${minutes}分`;

    setElapsedTime(timeString);
  };

  // クライアント側で料金を計算する関数（APIが失敗した場合のフォールバック）
  const calculateClientSideCharge = () => {
    if (!chargeStartedAt) return 0;

    const startTime = new Date(chargeStartedAt);
    const now = new Date();

    // 経過時間を分単位で計算
    const elapsedMinutes = calculateElapsedMinutes(startTime, now);

    // ライブラリ関数を使用して料金を計算
    const charge = calculateCharge(elapsedMinutes, pricePerHalfHour, timeUnitMinutes);

    // 計算された料金を設定
    setChargeAmount(charge);

    // デバッグ情報
    console.log('クライアント側で計算した料金:', {
      startTime,
      now,
      elapsedMs: now.getTime() - startTime.getTime(),
      elapsedMinutes,
      pricePerHalfHour,
      timeUnitMinutes,
      charge
    });

    return charge;
  };

  // サーバーから正確な料金を取得する関数
  const fetchChargeAmount = async () => {
    if (!chargeStartedAt || !sessionId) return 0;

    try {
      const response = await fetch(`/api/sessions/${sessionId}/calculate-charge`);

      if (!response.ok) {
        console.error('テーブル料金取得エラー:', response.status);
        // APIが失敗した場合はクライアント側で計算
        return calculateClientSideCharge();
      }

      const data = await response.json();
      console.log('テーブル料金取得成功:', data);

      // 席移動料金を含む合計料金を設定
      setChargeAmount(data.charge_amount || 0);

      // 経過時間の表示形式を設定（クライアント側で計算）
      updateElapsedTimeDisplay();

      return data.charge_amount || 0;
    } catch (error) {
      console.error('テーブル料金取得例外:', error);
      // エラーが発生した場合はクライアント側で計算
      return calculateClientSideCharge();
    }
  };

  // チャージ開始時間から経過時間を計算
  useEffect(() => {
    if (!chargeStartedAt || !sessionId) return;

    // 初回はサーバーから料金を取得
    fetchChargeAmount();

    // 1分ごとに再計算（経過時間の表示のみ更新、料金はサーバーから取得しない）
    const interval = setInterval(updateElapsedTimeDisplay, 60 * 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeStartedAt, pricePerHalfHour, timeUnitMinutes, sessionId]);

  // 会計処理を実行する関数
  const handleCheckout = async () => {
    if (orderItems.length === 0 && chargeAmount === 0) return;

    setIsSubmitting(true);
    setCheckoutError(null);

    try {
      // 会計処理の前に最新の料金を取得
      console.log('会計前に最新の料金を取得します');
      const latestChargeAmount = await fetchChargeAmount();
      console.log('最新の料金:', latestChargeAmount);

      // 最新の料金を状態に設定（表示を更新）
      setChargeAmount(latestChargeAmount);

      // 会計APIを呼び出し
      const response = await fetch(`/api/checkout/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table_id: tableId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '会計処理に失敗しました');
      }

      // 会計データを取得
      const data = await response.json();
      setCheckoutData(data);

      // 会計成功
      setCheckoutSuccess(true);
      clearCart();



      // 会計完了画面に遷移するためのクエリパラメータを準備
      // APIから返された合計金額を使用
      const params = new URLSearchParams({
        complete: 'true',
        total: data.total_amount.toString(), // APIから返された合計金額を使用
        store: storeName || '不明な店舗',
        table: tableName || '不明なテーブル'
      });

      // セッションを削除
      try {
        await fetch(`/api/sessions/${sessionId}`, {
          method: 'DELETE',
        });
      } catch (deleteError) {
        console.error('セッション削除エラー:', deleteError);
        // セッション削除に失敗しても処理は続行
      }

      // 2秒後に会計完了画面に遷移
      setTimeout(() => {
        window.location.href = `${window.location.pathname}?${params.toString()}`;
      }, 2000);
    } catch (error) {
      console.error('会計エラー:', error);
      setCheckoutError(error instanceof Error ? error.message : '会計処理に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 合計金額（注文 + テーブル料金）
  const totalAmount = orderTotalPrice + chargeAmount;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">会計</h2>

      {checkoutSuccess ? (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-md mb-4">
          会計処理が完了しました。ありがとうございました。
        </div>
      ) : checkoutError ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
          {checkoutError}
        </div>
      ) : null}

      {pricePerHalfHour > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold mb-2">テーブル料金</h3>
          <div className="bg-gray-50 p-4 rounded-md">
            <div className="flex justify-between mb-2">
              <span>席種:</span>
              <span>{seatTypeName}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span>料金:</span>
              <span>{pricePerHalfHour}円/{timeUnitMinutes}分</span>
            </div>
            {chargeStartedAt && (
              <>
                <div className="flex justify-between mb-2">
                  <span>経過時間:</span>
                  <span>{elapsedTime}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>テーブル料金:</span>
                  <span>{chargeAmount.toLocaleString()}円</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mb-6">
        <h3 className="font-semibold mb-2">注文明細</h3>
        {isLoadingOrders ? (
          <p className="text-gray-500">注文データを読み込み中...</p>
        ) : orderItems.length > 0 ? (
          <div className="border-t border-gray-200">
            {orderItems.map((item, index) => (
              <div key={index} className="py-2 border-b border-gray-200 flex justify-between">
                <div>
                  <span className="font-medium">{item.name}</span>
                  {item.target_cast_name && (
                    <span className="ml-2 text-sm text-gray-500">
                      ({item.target_cast_name}へ)
                    </span>
                  )}
                  <span className="ml-2 text-sm text-gray-500">
                    ×{item.quantity}
                  </span>
                </div>
                <span>{item.total.toLocaleString()}円(税込)</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 italic">注文はありません</p>
        )}
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div className="flex justify-between mb-2">
          <span>注文合計(税込):</span>
          <span>{orderTotalPrice.toLocaleString()}円</span>
        </div>
        {pricePerHalfHour > 0 && (
          <div className="flex justify-between mb-2">
            <span>テーブル料金(税込):</span>
            <span>{chargeAmount.toLocaleString()}円</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg">
          <span>合計金額(税込):</span>
          <span>{totalAmount.toLocaleString()}円</span>
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          className={`bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 w-full ${
            isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onClick={handleCheckout}
          disabled={isSubmitting || (orderItems.length === 0 && chargeAmount === 0)}
        >
          {isSubmitting ? '処理中...' : '会計する'}
        </button>
      </div>
    </div>
  );
}
