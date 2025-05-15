'use client';

import React, { useEffect, useState } from 'react';
import ReportHeader from '@/app/components/reports/ReportHeader';

interface DrinkSummary {
  product_id: string;
  product_name: string;
  quantity: number;
  total_sales: number;
}

interface CastDrinkSummary {
  cast_id: string;
  cast_name: string;
  total_quantity: number;
  total_sales: number;
  drinks: DrinkSummary[];
}

interface Cast {
  user_id: string;
  display_name: string;
}

export default function TreatedDrinksReport() {
  // 状態管理
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [selectedCast, setSelectedCast] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reportData, setReportData] = useState<CastDrinkSummary[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [expandedCast, setExpandedCast] = useState<string | null>(null);

  // キャスト一覧を取得
  useEffect(() => {
    const fetchCasts = async () => {
      try {
        setIsLoading(true);
        // APIからキャスト情報を取得
        const response = await fetch(`/api/casts`);
        
        if (!response.ok) {
          throw new Error('キャスト情報の取得に失敗しました');
        }
        
        const data = await response.json();
        // APIのレスポンス形式に合わせて変換
        const formattedCasts = data.map((cast: any) => ({
          user_id: cast.user_id,
          display_name: cast.display_name
        }));
        setCasts(formattedCasts || []);
      } catch (error) {
        console.error('キャスト情報取得エラー:', error);
        // エラーがあっても処理は続行
      } finally {
        setIsLoading(false);
      }
    };

    fetchCasts();
  }, []);

  // レポートデータを取得
  const fetchReportData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // URLクエリパラメータを構築
      const params = new URLSearchParams();
      
      if (selectedCast) {
        params.append('cast_id', selectedCast);
      }
      
      if (startDate) {
        params.append('start_date', startDate);
      }
      
      if (endDate) {
        params.append('end_date', endDate);
      }

      // APIからデータを取得
      console.log('リクエストパラメータ:', params.toString());
      const response = await fetch(`/api/reports/treated-drinks?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'レポートデータの取得に失敗しました');
      }

      const data = await response.json();
      console.log('APIレスポンス全体:', JSON.stringify(data, null, 2));
      console.log('奢りドリンク内訳レポートAPI応答データ:', data.data);
      console.log('奢りドリンク内訳レポートAPIサマリ:', data.summary);
      
      // データがない場合のデバッグメッセージ
      if (!data.data || data.data.length === 0) {
        console.log('奢りドリンクデータが存在しません。データベースに奢りドリンクのレコードがあるか確認してください。');
        console.log('checkout_order_items テーブルで target_cast_id が NULL でないレコードが必要です。');
      }
      
      setReportData(data.data || []);
      setSummary(data.summary || null);
    } catch (error) {
      console.error('レポートデータ取得エラー:', error);
      setError(error instanceof Error ? error.message : '予期せぬエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 初期値設定
  useEffect(() => {
    // 今日の日付
    const today = new Date();
    // 1年前の日付
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    // YYYY-MM-DD形式に変換
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    setStartDate(formatDate(oneYearAgo));
    setEndDate(formatDate(today));
  }, []);

  // 初期データロード
  useEffect(() => {
    if (startDate && endDate) {
      fetchReportData();
    }
  }, [startDate, endDate]);

  // 日本円表示用のフォーマッタ
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // キャスト詳細の展開/折りたたみを切り替え
  const toggleCastDetails = (castId: string) => {
    if (expandedCast === castId) {
      setExpandedCast(null);
    } else {
      setExpandedCast(castId);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* ヘッダー */}
      <ReportHeader userRole="A" />
      
      <div className="container mx-auto px-4 pt-0 pb-4 flex-grow">
        <div className="w-full">
          <div className="bg-white rounded-lg shadow p-6 mb-6 mt-4">
            <h2 className="text-xl font-semibold mb-4">検索条件</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">キャスト</label>
                <select
                  className="w-full p-2 border border-gray-300 rounded"
                  value={selectedCast}
                  onChange={(e) => setSelectedCast(e.target.value)}
                >
                  <option value="">すべてのキャスト</option>
                  {casts.map((cast) => (
                    <option key={cast.user_id} value={cast.user_id}>
                      {cast.display_name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
                <input
                  type="date"
                  className="w-full p-2 border border-gray-300 rounded"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
                <input
                  type="date"
                  className="w-full p-2 border border-gray-300 rounded"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex justify-end">
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded">
                  <h3 className="font-medium text-blue-700">合計金額</h3>
                  <p className="text-2xl font-bold">{formatCurrency(summary.total_sales)}</p>
                </div>
                
                <div className="bg-green-50 p-4 rounded">
                  <h3 className="font-medium text-green-700">合計杯数</h3>
                  <p className="text-2xl font-bold">{summary.total_quantity}杯</p>
                </div>
              </div>
            </div>
          )}
          
          {reportData.length > 0 ? (
            <div className="space-y-4">
              {reportData.map((cast) => (
                <div key={cast.cast_id} className="bg-white rounded-lg shadow overflow-hidden">
                  <div 
                    className="px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleCastDetails(cast.cast_id)}
                  >
                    <div>
                      <h3 className="text-lg font-medium">{cast.cast_name}</h3>
                      <p className="text-gray-500">奢りドリンク数: {cast.total_quantity}杯</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-600">{formatCurrency(cast.total_sales)}</p>
                      <div className="flex items-center">
                        <span className="text-sm mr-2">
                          {expandedCast === cast.cast_id ? '閉じる' : '詳細を表示'}
                        </span>
                        <svg 
                          className={`w-5 h-5 transition-transform ${expandedCast === cast.cast_id ? 'transform rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24" 
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {expandedCast === cast.cast_id && (
                    <div className="px-6 py-4 border-t border-gray-200">
                      <h4 className="font-medium text-gray-700 mb-2">ドリンク詳細</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">商品名</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">数量</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">金額</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {cast.drinks.map((drink) => (
                              <tr key={`${cast.cast_id}-${drink.product_id}`} className="hover:bg-gray-50">
                                <td className="px-4 py-2 whitespace-nowrap">{drink.product_name}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-right">{drink.quantity}杯</td>
                                <td className="px-4 py-2 whitespace-nowrap text-right">{formatCurrency(drink.total_sales)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
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