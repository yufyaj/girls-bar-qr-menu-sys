'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// レポートカテゴリーの型定義
interface ReportCategory {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  items: {
    title: string;
    path: string;
    access: string[];
    description: string;
  }[];
}

// レポートカテゴリー定義
const reportCategories: ReportCategory[] = [
  {
    id: 'sales',
    title: '売上・会計系',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    color: 'bg-blue-500',
    items: [
      {
        title: '日次売上',
        path: '/portal/reports/daily-summary',
        access: ['A', 'M'],
        description: '日付ごとの売上合計、来店組数、客単価、平均滞在時間などを表示'
      },
      {
        title: '時間帯別',
        path: '/portal/reports/hourly-sales',
        access: ['A', 'M'],
        description: '30分/1時間ごとの売上額、件数、キャスト指名回数を表示'
      },
      {
        title: 'メニュー別',
        path: '/portal/reports/menu-sales',
        access: ['A', 'M'],
        description: '商品ごとの売上個数、金額、構成比を表示'
      }
    ]
  },
  {
    id: 'cast',
    title: 'キャスト評価',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
    color: 'bg-purple-500',
    items: [
      {
        title: 'キャスト別売上',
        path: '/portal/reports/cast-sales',
        access: ['A', 'M', 'C'],
        description: 'キャスト別の指名回数、セット売上、奢りドリンク数を表示'
      },
      {
        title: '奢りドリンク',
        path: '/portal/reports/treated-drinks',
        access: ['A', 'M'],
        description: 'キャスト・商品別の奢り回数と売上を表示'
      }
    ]
  }
];

// メニュー項目のアイコンマッピング
const menuIcons: { [key: string]: React.ReactNode } = {
  'daily-summary': (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  ),
  'hourly-sales': (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  'menu-sales': (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  ),
  'cast-sales': (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  ),
  'treated-drinks': (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21a48.25 48.25 0 0 1-8.135-.687c-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  )
};

// カテゴリーIDに応じた背景色と文字色のマッピング
const categoryColorMap: { [key: string]: { bgLight: string, textColor: string } } = {
  'sales': { bgLight: 'bg-blue-100', textColor: 'text-blue-700' },
  'cast': { bgLight: 'bg-purple-100', textColor: 'text-purple-700' }
};

// パス文字列からメニュー識別子を抽出する関数
function getMenuIdentifier(path: string): string {
  const segments = path.split('/');
  return segments[segments.length - 1];
}

interface ReportHeaderProps {
  userRole?: string; // ユーザーの権限: A=Admin, M=Manager, C=Cast
}

export default function ReportHeader({ userRole = 'A' }: ReportHeaderProps) {
  const pathname = usePathname();

  // 指定したパスが現在のパスと一致するかチェック
  const isActive = (path: string) => pathname === path;

  // ユーザーの権限に基づいてアクセス可能なレポートをフィルタリング
  const filterByAccess = (category: ReportCategory) => {
    return category.items.some(item => item.access.includes(userRole));
  };

  // アクセス可能なカテゴリーのみ表示
  const accessibleCategories = reportCategories.filter(filterByAccess);

  // 現在のページが該当するカテゴリを特定
  const currentCategory = accessibleCategories.find(category => 
    category.items.some(item => isActive(item.path))
  );

  // トップページのリダイレクト処理
  if (pathname === '/portal/reports') {
    // nextjsのリダイレクトはサーバーサイドなので、クライアントサイドでリダイレクト
    if (typeof window !== 'undefined') {
      window.location.href = '/portal/reports/daily-summary';
    }
    return null; // リダイレクト中は何も表示しない
  }

  // すべてのメニュー項目をフラット化して取得
  const allMenuItems = accessibleCategories.flatMap(category => 
    category.items
      .filter(item => item.access.includes(userRole))
      .map(item => ({
        ...item,
        categoryId: category.id,
        icon: category.icon
      }))
  );

  return (
    <div className="w-full z-10 border-b border-gray-200">
      {/* メニュー - レスポンシブ対応（小画面では2列または1列）*/}
      <div className="bg-white p-2 sm:p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
          {allMenuItems.map((item) => {
            const categoryId = item.categoryId;
            const { bgLight, textColor } = categoryColorMap[categoryId] || { bgLight: 'bg-gray-100', textColor: 'text-gray-700' };
            const menuId = getMenuIdentifier(item.path);
            const menuIcon = menuIcons[menuId] || item.icon;
            
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex flex-col rounded-lg transition-all duration-200 p-2 sm:p-3 h-24 sm:h-28 ${
                  isActive(item.path)
                    ? `${bgLight} ${textColor} shadow-md border-2 border-gray-300`
                    : `${bgLight} hover:opacity-90 hover:shadow`
                }`}
              >
                <div className="flex flex-col items-center justify-center h-full">
                  <div className={`${textColor}`}>
                    {menuIcon}
                  </div>
                  <div className={`font-medium text-center ${textColor} text-xs sm:text-sm mt-1`}>{item.title}</div>
                  <div className="text-xs text-gray-600 text-center line-clamp-1 sm:line-clamp-2 hidden sm:block mt-1 overflow-hidden">{item.description}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
} 