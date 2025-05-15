'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// レポートメニュー項目の型定義
interface ReportMenuItem {
  title: string;
  path: string;
  access: string[]; // A: Admin, M: Manager, C: Cast
  description: string;
  color?: string; // 色指定を追加
  icon?: string; // アイコン追加
}

// レポートメニューカテゴリの型定義
interface ReportMenuCategory {
  title: string;
  items: ReportMenuItem[];
  color: string; // カテゴリーごとの色を追加
  bgColor: string; // 背景色を追加
  icon: string; // アイコンを追加
}

// レポートメニューの定義
const reportMenu: ReportMenuCategory[] = [
  {
    title: '売上・会計系',
    color: 'blue',
    bgColor: 'bg-blue-500', 
    icon: '💰',
    items: [
      {
        title: '日次売上サマリ',
        path: '/portal/reports/daily-summary',
        access: ['A', 'M'],
        description: '日付ごとの売上合計、来店組数、客単価、平均滞在時間などを表示'
      },
      {
        title: '時間帯別売上',
        path: '/portal/reports/hourly-sales',
        access: ['A', 'M'],
        description: '30分/1時間ごとの売上額、件数、キャスト指名回数を表示'
      },
      {
        title: 'メニュー別売上',
        path: '/portal/reports/menu-sales',
        access: ['A', 'M'],
        description: '商品ごとの売上個数、金額、構成比を表示'
      }
    ]
  },
  {
    title: 'キャスト評価・歩合系',
    color: 'purple',
    bgColor: 'bg-purple-500',
    icon: '👩',
    items: [
      {
        title: 'キャスト別売上/指名',
        path: '/portal/reports/cast-sales',
        access: ['M', 'C'],
        description: 'キャスト別の指名回数、セット売上、奢りドリンク数を表示'
      },
      {
        title: '奢りドリンク内訳',
        path: '/portal/reports/treated-drinks',
        access: ['A', 'M'],
        description: 'キャスト・商品別の奢り回数と売上を表示'
      }
    ]
  }
];

interface ReportNavigationProps {
  userRole?: string; // ユーザーの権限
}

export default function ReportNavigation({ userRole = 'A' }: ReportNavigationProps) {
  const pathname = usePathname();

  // 指定したパスが現在のパスと一致するかチェック
  const isActive = (path: string) => pathname === path;

  // ユーザーの権限に基づいてアクセス可能なレポートをフィルタリング
  const filterByAccess = (item: ReportMenuItem) => {
    return item.access.includes(userRole);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="text-xl font-semibold mb-4">レポート一覧</h2>
      
      <div className="space-y-6">
        {reportMenu.map((category) => (
          <div key={category.title}>
            <h3 className={`text-lg font-medium mb-2 pb-1 border-b border-gray-200 text-${category.color}-600`}>
              <span className="mr-2">{category.icon}</span>
              {category.title}
            </h3>
            <ul className="space-y-2">
              {category.items.filter(filterByAccess).map((item) => (
                <li key={item.path}>
                  <Link 
                    href={item.path}
                    className={`block p-2 rounded ${
                      isActive(item.path) 
                        ? `bg-${category.color}-50 text-${category.color}-700 font-medium` 
                        : `hover:bg-gray-50 hover:text-${category.color}-600`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{item.title}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {item.access.join(' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
} 