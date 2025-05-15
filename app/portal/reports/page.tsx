'use client';

import React from 'react';
import Link from 'next/link';
import ReportHeader from '@/app/components/reports/ReportHeader';

export default function ReportsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* ヘッダー */}
      <ReportHeader userRole="A" />
      
      <div className="container mx-auto px-3 sm:px-4 pt-0 pb-4 flex-grow">
        <div className="w-full">
          <div className="bg-white rounded-lg shadow p-3 sm:p-6 mt-3 sm:mt-4">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">レポート概要</h2>
            
            <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
              各種レポートを通じて、売上・キャスト・メニュー別の分析が可能です。
              上部のタブから確認したいレポートを選択してください。
            </p>
            
            <div>
              {/* 売上・会計系 */}
              <h3 className="font-medium text-base sm:text-lg mb-2 sm:mb-3 pb-1 border-b border-gray-200 text-blue-600">
                売上・会計系
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div className="border border-blue-200 rounded-lg p-3 sm:p-4 hover:bg-blue-50 transition-colors">
                  <h3 className="font-medium text-base sm:text-lg mb-1 sm:mb-2 text-blue-600">日次売上サマリ</h3>
                  <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">日付ごとの売上合計、来店組数、客単価、平均滞在時間などを表示</p>
                  <Link
                    href="/portal/reports/daily-summary"
                    className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm font-medium flex items-center"
                  >
                    レポートを見る
                    <svg
                      className="ml-1 w-3 h-3 sm:w-4 sm:h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 5l7 7-7 7"
                      ></path>
                    </svg>
                  </Link>
                </div>
                
                <div className="border border-blue-200 rounded-lg p-3 sm:p-4 hover:bg-blue-50 transition-colors">
                  <h3 className="font-medium text-base sm:text-lg mb-1 sm:mb-2 text-blue-600">時間帯別売上</h3>
                  <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">30分/1時間ごとの売上額、件数、キャスト指名回数を表示</p>
                  <Link
                    href="/portal/reports/hourly-sales"
                    className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm font-medium flex items-center"
                  >
                    レポートを見る
                    <svg
                      className="ml-1 w-3 h-3 sm:w-4 sm:h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 5l7 7-7 7"
                      ></path>
                    </svg>
                  </Link>
                </div>
                
                <div className="border border-blue-200 rounded-lg p-3 sm:p-4 hover:bg-blue-50 transition-colors">
                  <h3 className="font-medium text-base sm:text-lg mb-1 sm:mb-2 text-blue-600">メニュー別売上</h3>
                  <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">商品ごとの売上個数、金額、構成比を表示</p>
                  <Link
                    href="/portal/reports/menu-sales"
                    className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm font-medium flex items-center"
                  >
                    レポートを見る
                    <svg
                      className="ml-1 w-3 h-3 sm:w-4 sm:h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 5l7 7-7 7"
                      ></path>
                    </svg>
                  </Link>
                </div>
              </div>
              
              {/* キャスト評価・歩合系 */}
              <h3 className="font-medium text-base sm:text-lg mb-2 sm:mb-3 pb-1 border-b border-gray-200 text-purple-600">
                キャスト評価・歩合系
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div className="border border-purple-200 rounded-lg p-3 sm:p-4 hover:bg-purple-50 transition-colors">
                  <h3 className="font-medium text-base sm:text-lg mb-1 sm:mb-2 text-purple-600">キャスト別売上/指名</h3>
                  <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">キャスト別の指名回数、セット売上、奢りドリンク数を表示</p>
                  <Link
                    href="/portal/reports/cast-sales"
                    className="text-purple-600 hover:text-purple-800 text-xs sm:text-sm font-medium flex items-center"
                  >
                    レポートを見る
                    <svg
                      className="ml-1 w-3 h-3 sm:w-4 sm:h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 5l7 7-7 7"
                      ></path>
                    </svg>
                  </Link>
                </div>
                
                <div className="border border-purple-200 rounded-lg p-3 sm:p-4 hover:bg-purple-50 transition-colors">
                  <h3 className="font-medium text-base sm:text-lg mb-1 sm:mb-2 text-purple-600">奢りドリンク内訳</h3>
                  <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">キャスト・商品別の奢り回数と売上を表示</p>
                  <Link
                    href="/portal/reports/treated-drinks"
                    className="text-purple-600 hover:text-purple-800 text-xs sm:text-sm font-medium flex items-center"
                  >
                    レポートを見る
                    <svg
                      className="ml-1 w-3 h-3 sm:w-4 sm:h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 5l7 7-7 7"
                      ></path>
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 