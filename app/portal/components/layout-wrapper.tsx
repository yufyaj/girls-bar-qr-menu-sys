'use client';

import { useState, useEffect } from 'react';
import Header from './header';
import SideMenu from './side-menu';

interface NavLink {
  href: string;
  label: string;
  roles: ('admin' | 'cast')[];
}

interface LayoutWrapperProps {
  children: React.ReactNode;
  navLinks: NavLink[];
  userRole: 'admin' | 'cast';
  storeName: string;
  userEmail: string;
}

export default function LayoutWrapper({
  children,
  navLinks,
  userRole,
  storeName,
  userEmail
}: LayoutWrapperProps) {
  // サイドメニューの開閉状態を管理（デフォルトは開いた状態）
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(true);

  // サイドメニューの開閉を切り替える関数
  const toggleSideMenu = () => {
    setIsSideMenuOpen(!isSideMenuOpen);
  };

  // 画面サイズに応じてサイドメニューの状態を調整
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSideMenuOpen(false);
      } else {
        setIsSideMenuOpen(true);
      }
    };

    // 初期化時に一度実行
    handleResize();

    // リサイズイベントのリスナーを追加
    window.addEventListener('resize', handleResize);

    // クリーンアップ
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header
        storeName={storeName}
        userEmail={userEmail}
        onToggleSideMenu={toggleSideMenu}
        isSideMenuOpen={isSideMenuOpen}
      />

      <div className="flex flex-1 relative">
        <SideMenu
          navLinks={navLinks}
          userRole={userRole}
          isSideMenuOpen={isSideMenuOpen}
          onToggleSideMenu={toggleSideMenu}
        />

        <main className="flex-1 transition-all duration-300 ease-in-out py-10">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
