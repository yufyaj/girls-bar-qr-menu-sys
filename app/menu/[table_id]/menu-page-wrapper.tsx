'use client';

import { useState } from 'react';
import ClientMenuPage from './client-menu-page';
import HeaderWithMenuButton from './header-with-menu-button';

interface MenuPageWrapperProps {
  sessionId: string;
  tableId: string;
  tableName: string;
  storeName: string;
  seatTypeName: string;
  pricePerHalfHour: number;
  chargeStartedAt: string | null;
  chargePausedAt?: string | null;
  timeUnitMinutes?: number;
  menus: any[];
  menusByCategory: Record<string, any[]>;
  storeId: string;
  categories: any[];
}

export default function MenuPageWrapper(props: MenuPageWrapperProps) {
  // サイドメニューの開閉状態を管理（デフォルトは開いた状態）
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(true);

  // サイドメニューの開閉を切り替える関数
  const toggleSideMenu = () => {
    setIsSideMenuOpen(!isSideMenuOpen);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <HeaderWithMenuButton
        storeName={props.storeName}
        tableName={props.tableName}
        seatTypeName={props.seatTypeName}
        pricePerUnit={props.pricePerHalfHour}
        timeUnitMinutes={props.timeUnitMinutes}
        onToggleSideMenu={toggleSideMenu}
      />

      <main className="w-full px-0 py-0 md:py-6 md:px-0">
        <ClientMenuPage
          {...props}
          isSideMenuOpen={isSideMenuOpen}
          onToggleSideMenu={toggleSideMenu}
        />
      </main>

      <footer className="bg-white shadow-inner py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            © 2025 {props.storeName} - QRオーダーシステム
          </p>
        </div>
      </footer>
    </div>
  );
}
