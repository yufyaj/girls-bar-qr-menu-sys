'use client';

import { useState } from 'react';

interface HeaderWithMenuButtonProps {
  storeName: string;
  tableName: string;
  seatTypeName: string;
  pricePerUnit: number;
  timeUnitMinutes?: number;
  onToggleSideMenu: () => void;
}

export default function HeaderWithMenuButton({
  storeName,
  tableName,
  seatTypeName,
  pricePerUnit,
  timeUnitMinutes = 30,
  onToggleSideMenu
}: HeaderWithMenuButtonProps) {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-10">
      <div className="max-w-full px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            {/* ハンバーガーメニューアイコン */}
            <button
              onClick={onToggleSideMenu}
              className="bg-white hover:bg-gray-100 active:bg-gray-200 focus:bg-white focus:outline-none text-gray-700 p-2 rounded-md border border-gray-200"
              aria-label="メニューを開閉"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
            </button>

            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {storeName}
              </h1>
              <p className="text-sm text-gray-500">
                テーブル: {tableName} ({seatTypeName})
              </p>
            </div>
          </div>

          <div className="text-right">
            {pricePerUnit > 0 && (
              <p className="text-sm text-gray-500">
                料金: {pricePerUnit}円/{timeUnitMinutes}分
              </p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
