'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReportHeader from '@/app/components/reports/ReportHeader';

interface DailySummary {
  date: string;
  total_sales: number;
  total_guests: number;
  visit_count: number;
  average_sales_per_guest: number;
  average_stay_minutes: number;
}

interface SeatType {
  seat_type_id: number;
  display_name: string;
}

export default function DailySummaryReport() {
  const searchParams = useSearchParams();
  
  // 状態管理
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seatTypes, setSeatTypes] = useState<SeatType[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedSeatType, setSelectedSeatType] = useState<string>('');
  const [reportData, setReportData] = useState<DailySummary[]>([]);
  const [summary, setSummary] = useState<any>(null);

  // 席種リストを取得
  useEffect(() => {
    const fetchSeatTypes = async () => {
      try {
        // APIから席種情報を取得
        const response = await fetch(`/api/seat-types`);
        
        if (!response.ok) {
          throw new Error('席種情報の取得に失敗しました');
        }
        
        const data = await response.json();
        setSeatTypes(data.seatTypes || []);
      } catch (error) {
        console.error('席種情報取得エラー:', error);
        // エラーがあっても処理は続行
      }
    };

    fetchSeatTypes();
  }, []);

  // レポートデータを取得
  const fetchReportData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // URLクエリパラメータを構築
      const params = new URLSearchParams();
      
      if (startDate) {
        params.append('start_date', startDate);
      }
      
      if (endDate) {
        params.append('end_date', endDate);
      }
      
      if (selectedSeatType) {
        params.append('seat_type', selectedSeatType);
      }

      // APIからデータを取得
      const response = await fetch(`/api/reports/daily-summary?${params.toString()}`);
      
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
    try {
      // URLクエリパラメータを構築
      const params = new URLSearchParams();
      
      if (startDate) {
        params.append('start_date', startDate);
      }
      
      if (endDate) {
        params.append('end_date', endDate);
      }
      
      if (selectedSeatType) {
        params.append('seat_type', selectedSeatType);
      }

      // CSVエクスポートAPIを呼び出し
      const response = await fetch(`/api/reports/daily-summary/export?${params.toString()}`);
      
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
      let filename = 'daily_summary.csv';
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

  // 初期値設定
  useEffect(() => {
    // 今日の日付
    const today = new Date();
    // 30日前の日付
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    // YYYY-MM-DD形式に変換
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    setStartDate(formatDate(thirtyDaysAgo));
    setEndDate(formatDate(today));
    
    // ページが読み込まれたらレポートを自動取得
    fetchReportData();
  }, []);

  // 日本円表示用のフォーマッタ
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // 時間（分）を表示用にフォーマット
  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}時間${mins}分`;
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* ヘッダー */}
      <ReportHeader userRole="A" />
      
      <div className="container mx-auto px-3 sm:px-4 pt-0 pb-4 flex-grow">
        <div className="w-full">
          <div className="bg-white rounded-lg shadow p-3 sm:p-6 mb-4 sm:mb-6 mt-3 sm:mt-4">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">検索条件</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">席種</label>
                <select
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                  value={selectedSeatType}
                  onChange={(e) => setSelectedSeatType(e.target.value)}
                >
                  <option value="">すべての席種</option>
                  {seatTypes.map((type) => (
                    <option key={type.seat_type_id} value={type.display_name}>
                      {type.display_name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">開始日</label>
                <input
                  type="date"
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">終了日</label>
                <input
                  type="date"
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded text-sm hover:bg-green-700 transition-colors disabled:bg-gray-400"
                onClick={exportToCsv}
                disabled={isLoading || reportData.length === 0}
              >
                CSVエクスポート
              </button>
              <button
                className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
                onClick={fetchReportData}
                disabled={isLoading}
              >
                {isLoading ? '読み込み中...' : 'レポート表示'}
              </button>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-50 text-red-700 p-3 sm:p-4 rounded mb-4 sm:mb-6 text-sm">
              {error}
            </div>
          )}
          
          {summary && (
            <div className="bg-white rounded-lg shadow p-3 sm:p-6 mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">集計サマリ</h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
                <div className="bg-blue-50 p-2 sm:p-4 rounded">
                  <h3 className="font-medium text-blue-700 text-xs sm:text-sm">合計売上</h3>
                  <p className="text-lg sm:text-2xl font-bold">{formatCurrency(summary.total_sales)}</p>
                </div>
                
                <div className="bg-green-50 p-2 sm:p-4 rounded">
                  <h3 className="font-medium text-green-700 text-xs sm:text-sm">来店組数</h3>
                  <p className="text-lg sm:text-2xl font-bold">{summary.total_visits}組</p>
                </div>
                
                <div className="bg-purple-50 p-2 sm:p-4 rounded">
                  <h3 className="font-medium text-purple-700 text-xs sm:text-sm">総来店人数</h3>
                  <p className="text-lg sm:text-2xl font-bold">{summary.total_guests}人</p>
                </div>
                
                <div className="bg-yellow-50 p-2 sm:p-4 rounded">
                  <h3 className="font-medium text-yellow-700 text-xs sm:text-sm">客単価（1人あたり）</h3>
                  <p className="text-lg sm:text-2xl font-bold">{formatCurrency(summary.average_sales_per_guest)}</p>
                </div>
                
                <div className="bg-indigo-50 p-2 sm:p-4 rounded">
                  <h3 className="font-medium text-indigo-700 text-xs sm:text-sm">平均滞在時間</h3>
                  <p className="text-lg sm:text-2xl font-bold">{formatMinutes(summary.average_stay_minutes)}</p>
                </div>
              </div>
            </div>
          )}
          
          {reportData.length > 0 ? (
            <>
              {/* スマホ向けカードビュー */}
              <div className="block sm:hidden space-y-3 mb-4">
                <h3 className="text-base font-medium text-gray-700">取引明細</h3>
                {reportData.map((day) => (
                  <div key={day.date} className="bg-white rounded-lg shadow p-3">
                    <div className="flex justify-between items-center border-b pb-2 mb-2">
                      <h4 className="font-medium">{day.date}</h4>
                      <span className="text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">
                        {formatCurrency(day.total_sales)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-500">来店組数</p>
                        <p className="font-medium">{day.visit_count}組</p>
                      </div>
                      <div>
                        <p className="text-gray-500">来店人数</p>
                        <p className="font-medium">{day.total_guests}人</p>
                      </div>
                      <div>
                        <p className="text-gray-500">客単価</p>
                        <p className="font-medium">{formatCurrency(day.average_sales_per_guest)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">平均滞在</p>
                        <p className="font-medium">{formatMinutes(day.average_stay_minutes)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* PC・タブレット向けテーブルビュー */}
              <div className="hidden sm:block bg-white rounded-lg shadow mb-4">
                <h3 className="text-sm font-medium px-3 py-2 border-b border-gray-200">
                  取引明細
                </h3>
                <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">日付</th>
                        <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">売上合計</th>
                        <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">来店組数</th>
                        <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">来店人数</th>
                        <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">客単価</th>
                        <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">平均滞在</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.map((day) => (
                        <tr key={day.date} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-sm">{day.date}</td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right text-sm">{formatCurrency(day.total_sales)}</td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right text-sm">{day.visit_count}組</td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right text-sm">{day.total_guests}人</td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right text-sm">{formatCurrency(day.average_sales_per_guest)}</td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right text-sm">{formatMinutes(day.average_stay_minutes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : !isLoading && !error ? (
            <div className="bg-gray-50 p-6 sm:p-8 text-center rounded-lg">
              <p className="text-gray-500 text-sm">レポートデータがありません</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
