'use client';

import { useState, useEffect } from 'react';
import Modal from './modal';
import { useCart } from './cart-context';
import { calculateElapsedMinutes, calculateCharge, calculateChargeWithPause } from '@/lib/charge';

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

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  tableId: string;
  tableName: string;
  storeName: string;
  seatTypeName: string;
  pricePerHalfHour: number;
  chargeStartedAt: string | null;
  chargePausedAt?: string | null;
  timeUnitMinutes?: number;
}

export default function CheckoutModal({
  isOpen,
  onClose,
  sessionId,
  tableId,
  tableName,
  storeName,
  seatTypeName,
  pricePerHalfHour,
  chargeStartedAt,
  chargePausedAt,
  timeUnitMinutes = 30,
}: CheckoutModalProps) {
  const { clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [chargeAmount, setChargeAmount] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<string>('');
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderTotalPrice, setOrderTotalPrice] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(10.0); // デフォルト税率10%
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(true);
  const [nominationFee, setNominationFee] = useState<number>(0);
  const [selectedCastName, setSelectedCastName] = useState<string>('');
  const [nominations, setNominations] = useState<{cast_id: string, display_name: string, nomination_fee: number}[]>([]);

  // 指名料を取得する関数
  const fetchNominationFees = async (storeId: string) => {
    try {
      // 新しい指名情報を取得
      const nominationsResponse = await fetch(`/api/sessions/${sessionId}/nominations`);
      if (nominationsResponse.ok) {
        const nominationsData = await nominationsResponse.json();
        if (nominationsData && nominationsData.length > 0) {
          setNominations(nominationsData);

          // 指名料の合計を計算
          let totalNominationFee = 0;
          for (const nomination of nominationsData) {
            totalNominationFee += nomination.nomination_fee || 0;
          }
          setNominationFee(totalNominationFee);
          console.log('指名料合計:', totalNominationFee, '円');
          return totalNominationFee;
        }
      }

      // 新しい指名情報がない場合は、旧方式の指名情報を確認
      const sessionResponse = await fetch(`/api/tables/${tableId}/sessions/${sessionId}`);
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        if (sessionData.selected_cast_id) {
          const castResponse = await fetch(`/api/casts?store_id=${storeId}`);
          if (castResponse.ok) {
            const castsData = await castResponse.json();
            const selectedCast = castsData.find((cast: any) => cast.user_id === sessionData.selected_cast_id);
            if (selectedCast) {
              setSelectedCastName(selectedCast.display_name || '');
              setNominationFee(selectedCast.nomination_fee || 0);
              console.log('旧方式の指名料:', selectedCast.nomination_fee, '円');
              return selectedCast.nomination_fee || 0;
            }
          }
        }
      }

      return 0;
    } catch (error) {
      console.error('指名料取得エラー:', error);
      return 0;
    }
  };

  // 注文データと最新の料金を取得
  useEffect(() => {
    const fetchData = async () => {
      if (!isOpen) return;

      try {
        // 店舗情報を取得して税率を設定
        const storeResponse = await fetch(`/api/sessions/${sessionId}/store-info`);
        let storeId = '';
        if (storeResponse.ok) {
          const storeData = await storeResponse.json();
          if (storeData.tax_rate !== undefined) {
            setTaxRate(storeData.tax_rate);
          }
          storeId = storeData.store_id || '';
        } else {
          console.error('店舗情報取得エラー:', await storeResponse.text());
        }

        // 指名料を取得
        await fetchNominationFees(storeId);

        // 注文データを取得
        console.log('注文データ取得開始:', { sessionId });
        setIsLoadingOrders(true);
        const response = await fetch(`/api/sessions/${sessionId}/orders`);
        console.log('注文データAPIレスポンス:', { status: response.status, ok: response.ok });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('注文データ取得エラーレスポンス:', errorData);
          throw new Error('注文データの取得に失敗しました');
        }

        const data = await response.json();
        console.log('注文データ取得成功:', { orders: data.orders, totalPrice: data.totalPrice });
        setOrderItems(data.orders);
        setOrderTotalPrice(data.totalPrice);

        // モーダルが開かれたときに最新の料金も取得
        if (chargeStartedAt && sessionId) {
          console.log('モーダルオープン時に最新の料金を取得します');
          await fetchChargeAmount();
        }
      } catch (error) {
        console.error('データ取得エラー:', error);
      } finally {
        setIsLoadingOrders(false);
      }
    };

    if (sessionId && isOpen) {
      fetchData();
    }
  }, [sessionId, isOpen, chargeStartedAt]);

  // 経過時間の表示を更新する関数
  const updateElapsedTimeDisplay = () => {
    if (!chargeStartedAt) return;

    const startTime = new Date(chargeStartedAt);
    const now = new Date();
    const pauseTime = chargePausedAt ? new Date(chargePausedAt) : null;

    // 経過時間を分単位で計算（一時停止を考慮）
    const elapsedMinutes = calculateElapsedMinutes(startTime, now, pauseTime);

    // 経過時間の表示形式を設定
    const hours = Math.floor(elapsedMinutes / 60);
    const minutes = elapsedMinutes % 60;
    const timeString = `${hours}時間${minutes}分${pauseTime ? ' (停止中)' : ''}`;

    setElapsedTime(timeString);
  };

  // クライアント側で料金を計算する関数（APIが失敗した場合のフォールバック）
  const calculateClientSideCharge = () => {
    if (!chargeStartedAt) return 0;

    const startTime = new Date(chargeStartedAt);
    const now = new Date();
    const pauseTime = chargePausedAt ? new Date(chargePausedAt) : null;

    // ライブラリ関数を使用して料金を計算
    const charge = calculateChargeWithPause(
      startTime,
      now,
      pricePerHalfHour,
      timeUnitMinutes,
      pauseTime
    );

    // 計算された料金を設定
    setChargeAmount(charge);

    // デバッグ情報
    console.log('クライアント側で計算した料金:', {
      startTime,
      now,
      elapsedMs: now.getTime() - startTime.getTime(),
      elapsedMinutes: Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60)),
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

  // テーブル料金と指名料の計算
  useEffect(() => {
    if (!chargeStartedAt || !sessionId) return;

    // 初回はサーバーから料金を取得
    fetchChargeAmount();

    // 1分ごとに再計算（経過時間の表示のみ更新、料金はサーバーから取得しない）
    const interval = setInterval(updateElapsedTimeDisplay, 60 * 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeStartedAt, chargePausedAt, pricePerHalfHour, timeUnitMinutes, sessionId]);

  // モーダルが開かれるたびに指名料を再計算
  useEffect(() => {
    if (!isOpen || !sessionId) return;

    const fetchStoreAndNominations = async () => {
      try {
        // 店舗情報を取得
        const storeResponse = await fetch(`/api/sessions/${sessionId}/store-info`);
        if (storeResponse.ok) {
          const storeData = await storeResponse.json();
          const storeId = storeData.store_id || '';
          // 指名料を再取得
          await fetchNominationFees(storeId);
        }
      } catch (error) {
        console.error('指名料再取得エラー:', error);
      }
    };

    fetchStoreAndNominations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sessionId]);

  // 会計処理
  const handleCheckout = async (e?: React.MouseEvent | React.FormEvent) => {
    // イベントがある場合は、デフォルトの動作とバブリングを防止
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (orderItems.length === 0 && chargeAmount === 0) {
      return;
    }

    setIsSubmitting(true);
    setCheckoutError(null);

    try {
      // 会計処理の前に最新の料金と指名料を取得
      console.log('会計前に最新の料金を取得します');
      const latestChargeAmount = await fetchChargeAmount();
      console.log('最新の料金:', latestChargeAmount);

      // 店舗IDを取得して指名料も再取得
      const storeResponse = await fetch(`/api/sessions/${sessionId}/store-info`);
      if (storeResponse.ok) {
        const storeData = await storeResponse.json();
        const storeId = storeData.store_id || '';
        await fetchNominationFees(storeId);
      }

      // 最新の料金を状態に設定（表示を更新）
      setChargeAmount(latestChargeAmount);

      // 会計APIを呼び出し
      const apiUrl = `/api/checkout/${sessionId}`;
      const requestBody = {
        table_id: tableId,
      };



      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });



      if (!response.ok) {
        let errorMessage = '会計処理に失敗しました';
        try {
          const errorData = await response.json();

          errorMessage = errorData.error || errorMessage;
        } catch (jsonError) {
          console.error('会計APIエラーレスポンスのJSONパースに失敗:', jsonError);
        }
        throw new Error(errorMessage);
      }

      // 会計データを取得
      const data = await response.json();
      setCheckoutData(data);

      // APIから返された料金を使用して表示を更新
      setChargeAmount(data.charge_amount || chargeAmount);
      setNominationFee(data.nomination_fee || nominationFee);

      // 指名情報が返された場合は更新
      if (data.nominations && data.nominations.length > 0) {
        setNominations(data.nominations);
      }

      // 会計成功
      setCheckoutSuccess(true);
      clearCart();

      // 会計完了画面に遷移するためのクエリパラメータを準備
      // APIからの金額を使用
      const params = new URLSearchParams({
        complete: 'true',
        total: data.total_amount.toString(), // APIから返された税込み合計金額を使用
        subtotal: data.subtotal_amount.toString(), // APIから返された税抜き合計金額を使用
        tax: data.tax_amount.toString(), // APIから返された消費税額を使用
        taxRate: data.tax_rate.toString(), // APIから返された消費税率を使用
        store: encodeURIComponent(storeName || '不明な店舗'),
        table: encodeURIComponent(tableName || '不明なテーブル')
      });

      // 指名料がある場合はパラメータに追加
      if (data.nomination_fee && data.nomination_fee > 0) {
        params.append('nominationFee', data.nomination_fee.toString());
        if (selectedCastName) {
          params.append('castName', encodeURIComponent(selectedCastName));
        }
      }

      // クライアントサイドでのみ実行
      if (typeof window !== 'undefined') {

      }

      // セッションを削除
      try {
        const deleteResponse = await fetch(`/api/sessions/${sessionId}`, {
          method: 'DELETE',
        });

        if (!deleteResponse.ok) {

        } else {

        }
      } catch (deleteError) {
        console.error('セッション削除エラー:', deleteError);
        // セッション削除に失敗しても処理は続行
      }

      // 2秒後に会計完了画面に遷移（クライアントサイドでのみ実行）
      if (typeof window !== 'undefined') {

        const redirectUrl = `${window.location.pathname}?${params.toString()}`;

        setTimeout(() => {

          window.location.href = redirectUrl;
        }, 2000);
      }
    } catch (error) {
      console.error('会計エラー:', error);
      // エラーメッセージをより詳細に表示
      let errorMessage = '会計処理に失敗しました';
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error('エラー詳細:', error.stack);
      } else {
        console.error('不明なエラー形式:', typeof error, error);
      }
      setCheckoutError(errorMessage);


    } finally {
      setIsSubmitting(false);
    }
  };

  // 税込み合計金額（注文 + テーブル料金 + 指名料）
  const totalAmount = orderTotalPrice + chargeAmount + nominationFee;

  // 内税の消費税額を計算（税込み金額から逆算）
  // 税込み金額 ÷ (1 + 税率/100) = 税抜き金額
  // 税込み金額 - 税抜き金額 = 消費税額
  const subtotalAmount = Math.floor(totalAmount / (1 + taxRate / 100));
  const calculatedTaxAmount = totalAmount - subtotalAmount;

  // useEffectの外でもtaxAmountを更新
  useEffect(() => {
    setTaxAmount(calculatedTaxAmount);
  }, [calculatedTaxAmount]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="お会計"
      maxWidth="max-w-lg"
    >
      {checkoutSuccess ? (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-md mb-4">
          会計処理が完了しました。ありがとうございました。
        </div>
      ) : checkoutError ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
          {checkoutError}
        </div>
      ) : null}

      <div className="mb-6">
        <div className="bg-gray-50 p-4 rounded-md mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-gray-600">席タイプ:</span>
            <span className="font-medium">{seatTypeName}</span>
          </div>
          {pricePerHalfHour > 0 && (
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">料金:</span>
              <span className="font-medium">{pricePerHalfHour.toLocaleString()}円 / {timeUnitMinutes}分</span>
            </div>
          )}
          {chargeStartedAt && pricePerHalfHour > 0 && (
            <>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">経過時間:</span>
                <span className="font-medium">{elapsedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">テーブル料金:</span>
                <span className="font-medium">{chargeAmount.toLocaleString()}円</span>
              </div>
            </>
          )}
        </div>

        <div className="mb-4">
          <h3 className="font-medium mb-2">注文内容</h3>
          {isLoadingOrders ? (
            <p className="text-gray-500">注文データを読み込み中...</p>
          ) : orderItems.length === 0 ? (
            <p className="text-gray-500">注文はありません</p>
          ) : (
            <ul className="divide-y">
              {orderItems.map((item, index) => (
                <li key={index} className="py-2 flex justify-between">
                  <div>
                    <span>{item.name}</span>
                    {item.target_cast_name && (
                      <span className="ml-2 text-sm text-blue-600">
                        ({item.target_cast_name}に奢る)
                      </span>
                    )}
                    <span className="ml-2 text-sm text-gray-500">
                      ×{item.quantity}
                    </span>
                  </div>
                  <span>
                    {item.total.toLocaleString()}円(税込)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
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
        {/* 指名料を合計で表示 */}
        {nominationFee > 0 && (
          <div className="flex justify-between mb-2">
            <span>指名料合計(税込):</span>
            <span>{nominationFee.toLocaleString()}円</span>
          </div>
        )}
        <div className="flex justify-between mb-2">
          <span>小計（内税）:</span>
          <span>{subtotalAmount.toLocaleString()}円</span>
        </div>
        <div className="flex justify-between mb-2">
          <span>内消費税（{taxRate}%）:</span>
          <span>{calculatedTaxAmount.toLocaleString()}円</span>
        </div>
        <div className="flex justify-between font-bold text-lg">
          <span>合計金額(税込):</span>
          <span>{totalAmount.toLocaleString()}円</span>
        </div>
      </div>

      <div className="mt-6">
        <form onSubmit={(e) => {
          e.preventDefault();
          handleCheckout(e);
        }}>
          <button
            type="submit"
            className={`bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 w-full ${
              isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={isSubmitting || (orderItems.length === 0 && chargeAmount === 0)}
          >
            {isSubmitting ? '処理中...' : '会計する'}
          </button>
        </form>


      </div>
    </Modal>
  );
}
