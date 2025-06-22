'use client';

import React, { useEffect, useState } from 'react';
import ReportHeader from '@/app/components/reports/ReportHeader';

interface HourlySales {
  time_slot: string;
  sales_amount: number;
  transaction_count: number;
  nomination_count: number;
}

export default function HourlySalesReport() {
  // 状態管理
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<string>('');
  const [intervalMinutes, setIntervalMinutes] = useState<string>('60');
  const [startHour, setStartHour] = useState<string>('0');
  const [endHour, setEndHour] = useState<string>('24');
  const [reportData, setReportData] = useState<HourlySales[]>([]);
  const [summary, setSummary] = useState<any>(null);

  // 初期値設定
  useEffect(() => {
    // 今日の日付
    const today = new Date();
    // YYYY-MM-DD形式に変換
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const formattedDate = formatDate(today);
    setDate(formattedDate);
  }, []);

  // レポートデータを取得
  const fetchReportData = async () => {
    if (!date) {
      setError('日付を選択してください');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // URLクエリパラメータを構築
      const params = new URLSearchParams();
      params.append('date', date);
      params.append('interval', intervalMinutes);
      params.append('start_hour', startHour);
      params.append('end_hour', endHour);

      // APIからデータを取得
      const response = await fetch(`/api/reports/hourly-sales?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'レポートデータの取得に失敗しました');
      }

      const data = await response.json();
      setReportData(data.data || []);
      setSummary(data.summary || null);
    } catch (error) {
      console.error('レポートデータ取得エラー:', error);
      setError(error instanceof Error ? error.message : '予期せぬエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  // CSVエクスポート機能
  const exportToCsv = async () => {
    if (!date) {
      setError('日付を選択してください');
      return;
    }

    try {
      // URLクエリパラメータを構築
      const params = new URLSearchParams();
      params.append('date', date);
      params.append('interval', intervalMinutes);
      params.append('start_hour', startHour);
      params.append('end_hour', endHour);

      // CSVエクスポートAPIを呼び出し
      const response = await fetch(`/api/reports/hourly-sales/export?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'CSVエクスポートに失敗しました');
      }

      // ファイルをダウンロード
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // ファイル名を取得（レスポンスヘッダーから）
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'hourly_sales.csv';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('CSVエクスポートエラー:', error);
      setError(error instanceof Error ? error.message : 'CSVエクスポートに失敗しました');
    }
  };

  // 日付が設定されたらレポートを自動取得
  useEffect(() => {
    if (date) {
      fetchReportData();
    }
  }, [date, intervalMinutes, startHour, endHour]);

  // 日本円表示用のフォーマッタ
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* ヘッダー */}
      <ReportHeader userRole="A" />
      
      <div className="container mx-auto px-4 pt-0 pb-4 flex-grow">
        <div className="w-full">
          <div className="bg-white rounded-lg shadow p-6 mb-6 mt-4">
            <h2 className="text-xl font-semibold mb-4">検索条件</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
                <input
                  type="date"
                  className="w-full p-2 border border-gray-300 rounded"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">時間間隔</label>
                <select
                  className="w-full p-2 border border-gray-300 rounded"
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(e.target.value)}
                >
                  <option value="30">30分</option>
                  <option value="60">1時間</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始時間</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded"
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                  >
                    {[...Array(24)].map((_, i) => (
                      <option key={i} value={i}>{i}時</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">終了時間</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded"
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                  >
                    {[...Array(25)].map((_, i) => (
                      <option key={i} value={i}>{i}時</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors disabled:bg-gray-400"
                onClick={exportToCsv}
                disabled={isLoading || reportData.length === 0 || !date}
              >
                CSVエクスポート
              </button>
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                onClick={fetchReportData}
                disabled={isLoading}
              >
                {isLoading ? '読み込み中...' : 'レポート表示'}
              </button>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded mb-6">
              {error}
            </div>
          )}
          
          {summary && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">集計サマリ</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded">
                  <h3 className="font-medium text-blue-700">合計売上</h3>
                  <p className="text-2xl font-bold">{formatCurrency(summary.total_sales)}</p>
                </div>
                
                <div className="bg-green-50 p-4 rounded">
                  <h3 className="font-medium text-green-700">取引数</h3>
                  <p className="text-2xl font-bold">{summary.total_transactions}件</p>
                </div>
                
                <div className="bg-purple-50 p-4 rounded">
                  <h3 className="font-medium text-purple-700">指名回数</h3>
                  <p className="text-2xl font-bold">{summary.total_nominations}回</p>
                </div>
              </div>
            </div>
          )}
          
          {reportData.length > 0 ? (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">時間帯</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">売上</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">取引数</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">指名回数</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.map((slot) => (
                      <tr key={slot.time_slot} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">{slot.time_slot}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">{formatCurrency(slot.sales_amount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">{slot.transaction_count}件</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">{slot.nomination_count}回</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : !isLoading && !error ? (
            <div className="bg-gray-50 p-8 text-center rounded-lg">
              <p className="text-gray-500">レポートデータがありません</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
