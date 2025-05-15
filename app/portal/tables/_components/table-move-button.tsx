'use client';

import { useState } from 'react';
import { Database } from '@/lib/database.types';

// テーブルの型定義（実際のデータ構造に合わせて調整）
interface Table {
  table_id: string;
  name: string;
  seat_types?: {
    display_name: string;
    price_per_unit: number;
  } | null;
}

interface TableMoveButtonProps {
  tableId: string;
  tableName: string;
  sessionId: string;
  availableTables: Table[];
}

export default function TableMoveButton({
  tableId,
  tableName,
  sessionId,
  availableTables
}: TableMoveButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 料金関連の状態
  const [previousCharge, setPreviousCharge] = useState(0);
  const [fullUnitCharge, setFullUnitCharge] = useState(0);
  const [partialUnitCharge, setPartialUnitCharge] = useState(0);
  const [timeUnitMinutes, setTimeUnitMinutes] = useState(30);
  const [guestCount, setGuestCount] = useState(1);

  // 料金適用のチェックボックス状態
  const [applyFullCharge, setApplyFullCharge] = useState(true);
  const [applyPartialCharge, setApplyPartialCharge] = useState(true);

  // 移動先テーブル候補（現在のテーブルを除外）
  const targetTables = availableTables.filter(table => table.table_id !== tableId);

  // テーブル選択時の処理
  const handleSelectTable = async (targetTableId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      // 移動先テーブルIDを保存
      setSelectedTableId(targetTableId);

      // タイムアウト処理を設定
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒でタイムアウト

      // 料金計算のみを行うリクエスト（実際の移動は行わない）
      const response = await fetch(`/api/sessions/${sessionId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_table_id: targetTableId,
          calculate_only: true, // 料金計算のみ行うフラグ
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId); // タイムアウトをクリア

      const result = await response.json();
      console.log('席移動料金計算応答:', result);

      if (!response.ok) {
        throw new Error(result.error || '席移動料金の計算に失敗しました');
      }

      // 計算された料金を保存
      setPreviousCharge(result.previous_charge || 0);
      setFullUnitCharge(result.full_unit_charge || 0);
      setPartialUnitCharge(result.partial_unit_charge || 0);
      setTimeUnitMinutes(result.time_unit_minutes || 30);
      setGuestCount(result.guest_count || 1);

      // 料金が発生する場合は確認ダイアログを表示
      if (result.previous_charge > 0) {
        setIsConfirmModalOpen(true);
      } else {
        // 料金が発生しない場合は直接移動処理を実行
        await executeTableMove(targetTableId, true, true);
      }
    } catch (err) {
      console.error('席移動料金計算エラー:', err);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('リクエストがタイムアウトしました。ネットワーク接続を確認して再試行してください。');
      } else {
        setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 実際の席移動処理
  const executeTableMove = async (targetTableId: string, applyFullCharge: boolean, applyPartialCharge: boolean) => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      setIsConfirmModalOpen(false);

      // タイムアウト処理を設定
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒でタイムアウト

      const response = await fetch(`/api/sessions/${sessionId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_table_id: targetTableId,
          apply_full_charge: applyFullCharge,     // 完全経過分の料金を適用するかどうかのフラグ
          apply_partial_charge: applyPartialCharge // 未達成分の料金を適用するかどうかのフラグ
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId); // タイムアウトをクリア

      const result = await response.json();
      console.log('席移動API応答:', result);

      if (!response.ok) {
        throw new Error(result.error || '席移動に失敗しました');
      }

      // 適用された料金に基づいてメッセージを表示
      const appliedCharge = result.applied_charge || 0;

      if (appliedCharge > 0) {
        // 適用された料金の内訳を表示
        let chargeDetails = '';
        if (result.full_charge_applied) {
          chargeDetails += `完全経過分 ${fullUnitCharge.toLocaleString()}円`;
        }
        if (result.full_charge_applied && result.partial_charge_applied) {
          chargeDetails += ' と ';
        }
        if (result.partial_charge_applied) {
          chargeDetails += `未達成分 ${partialUnitCharge.toLocaleString()}円`;
        }

        setSuccess(`席移動が完了しました。移動前の料金（${chargeDetails}）は会計時に加算されます。`);
      } else if (previousCharge > 0) {
        setSuccess(`席移動が完了しました。移動前の料金は加算されません。`);
      } else {
        setSuccess('席移動が完了しました');
      }

      // 3秒後にページをリロード
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (err) {
      console.error('席移動エラー:', err);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('リクエストがタイムアウトしました。処理は完了していない可能性があります。ページを更新してください。');
      } else {
        setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="bg-indigo-600 text-white py-1 px-3 rounded-md text-sm hover:bg-indigo-700"
      >
        席移動
      </button>

      {/* 席移動モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">席移動</h3>
            <p className="mb-4 text-sm text-gray-600">
              「{tableName}」から移動先のテーブルを選択してください。
            </p>

            {error && (
              <div className="mb-4 p-2 bg-red-100 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-2 bg-green-100 text-green-700 rounded-md text-sm">
                {success}
              </div>
            )}

            {targetTables.length === 0 ? (
              <p className="text-gray-500 italic">移動先のテーブルがありません</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 mb-4">
                {targetTables.map((table) => (
                  <button
                    key={table.table_id}
                    onClick={() => handleSelectTable(table.table_id)}
                    disabled={isLoading}
                    className="flex justify-between items-center p-3 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="font-medium">{table.name}</span>
                    <span className="text-sm text-gray-500">
                      {table.seat_types?.display_name || '不明な席種'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={isLoading}
                className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 disabled:opacity-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 料金確認モーダル */}
      {isConfirmModalOpen && selectedTableId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">料金確認</h3>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                現在のテーブルでの料金が発生しています。会計時に加算する料金を選択してください。
                {guestCount > 1 && <span className="font-medium ml-1">（{guestCount}人分）</span>}
              </p>

              {fullUnitCharge > 0 && (
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="applyFullCharge"
                    checked={applyFullCharge}
                    onChange={(e) => setApplyFullCharge(e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="applyFullCharge" className="text-sm">
                    完全経過分: <span className="font-bold">{fullUnitCharge.toLocaleString()}円</span>
                    {fullUnitCharge > 0 && (
                      <span className="text-xs text-gray-500 ml-1">
                        （{timeUnitMinutes}分単位で完全に経過した分）
                      </span>
                    )}
                  </label>
                </div>
              )}

              {partialUnitCharge > 0 && (
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="applyPartialCharge"
                    checked={applyPartialCharge}
                    onChange={(e) => setApplyPartialCharge(e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="applyPartialCharge" className="text-sm">
                    未達成分: <span className="font-bold">{partialUnitCharge.toLocaleString()}円</span>
                    {partialUnitCharge > 0 && (
                      <span className="text-xs text-gray-500 ml-1">
                        （{timeUnitMinutes}分に満たない残り時間分）
                      </span>
                    )}
                  </label>
                </div>
              )}

              <div className="mt-3 text-sm font-medium">
                合計: {((applyFullCharge ? fullUnitCharge : 0) + (applyPartialCharge ? partialUnitCharge : 0)).toLocaleString()}円
                {guestCount > 1 && <span className="text-xs text-gray-500 ml-1">（1人あたり {Math.round(((applyFullCharge ? fullUnitCharge : 0) + (applyPartialCharge ? partialUnitCharge : 0)) / guestCount).toLocaleString()}円）</span>}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isLoading}
                className="bg-gray-300 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-400 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={() => executeTableMove(selectedTableId, applyFullCharge, applyPartialCharge)}
                disabled={isLoading || (!applyFullCharge && !applyPartialCharge)}
                className="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                選択した料金を加算する
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
