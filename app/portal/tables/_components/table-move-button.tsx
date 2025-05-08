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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 移動先テーブル候補（現在のテーブルを除外）
  const targetTables = availableTables.filter(table => table.table_id !== tableId);

  const handleMoveTable = async (targetTableId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/sessions/${sessionId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_table_id: targetTableId,
        }),
      });

      const result = await response.json();
      console.log('席移動API応答:', result);

      if (!response.ok) {
        throw new Error(result.error || '席移動に失敗しました');
      }

      const previousCharge = result.previous_charge || 0;

      // 移動前の料金がある場合は、その情報も表示
      if (previousCharge > 0) {
        setSuccess(`席移動が完了しました。移動前の料金 ${previousCharge.toLocaleString()}円 は会計時に加算されます。`);
      } else {
        setSuccess('席移動が完了しました');
      }

      // 3秒後にページをリロード
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (err) {
      console.error('席移動エラー:', err);
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
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
                    onClick={() => handleMoveTable(table.table_id)}
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
    </>
  );
}
