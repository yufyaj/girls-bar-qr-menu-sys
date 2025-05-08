'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavLink {
  href: string;
  label: string;
  roles: ('admin' | 'cast')[];
}

interface SideMenuProps {
  navLinks: NavLink[];
  userRole: 'admin' | 'cast';
  isSideMenuOpen: boolean;
  onToggleSideMenu: () => void;
}

export default function SideMenu({ 
  navLinks, 
  userRole, 
  isSideMenuOpen, 
  onToggleSideMenu 
}: SideMenuProps) {
  const pathname = usePathname();

  return (
    <>
      {/* モバイル用オーバーレイ */}
      {isSideMenuOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 md:hidden" 
          onClick={onToggleSideMenu}
        />
      )}

      {/* サイドメニュー */}
      <div 
        className={`
          fixed md:sticky top-0 left-0 h-screen bg-white shadow-md z-30
          transition-all duration-300 ease-in-out
          ${isSideMenuOpen ? 'w-64' : 'w-0 md:w-16'} 
          overflow-hidden
        `}
      >
        <div className="h-full flex flex-col">
          {/* メニューヘッダー */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className={`font-bold text-lg ${!isSideMenuOpen && 'md:hidden'}`}>管理メニュー</h2>
              <button
                onClick={onToggleSideMenu}
                className="p-2 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none"
                aria-label="メニューを開閉"
              >
                {isSideMenuOpen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* メニューリンク */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1">
              {navLinks
                .filter(link => link.roles.includes(userRole))
                .map(link => {
                  const isActive = pathname === link.href;
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className={`
                          flex items-center px-4 py-3 text-sm font-medium transition-colors
                          ${isActive 
                            ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                            : 'text-gray-700 hover:bg-gray-50 border-l-4 border-transparent'}
                        `}
                      >
                        <span className={!isSideMenuOpen ? 'md:hidden' : ''}>{link.label}</span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}
