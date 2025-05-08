'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface Category {
  category_id: string;
  name: string;
  display_order: number;
}

interface Menu {
  menu_id: string;
  product_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  category_id: string | null;
  is_available: boolean;
}

interface MenuListProps {
  menus: Menu[];
}

export default function MenuList({ menus }: MenuListProps) {
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [availableFilter, setAvailableFilter] = useState<boolean | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // カテゴリ一覧を取得
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoadingCategories(true);
      try {
        // URLからクエリパラメータを取得
        const urlParams = new URLSearchParams(window.location.search);
        const storeId = urlParams.get('storeId') || localStorage.getItem('store-id');

        const response = await fetch(`/api/menu-categories?storeId=${storeId}`);
        if (!response.ok) {
          throw new Error('カテゴリの取得に失敗しました');
        }
        const data = await response.json();
        setCategories(data);
      } catch (err) {
        console.error('カテゴリ取得エラー:', err);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  // フィルタリングされたメニューを取得
  const filteredMenus = menus.filter(menu => {
    // 名前またはIDで検索
    const nameMatch = menu.name.toLowerCase().includes(filter.toLowerCase()) ||
                     menu.product_id.toLowerCase().includes(filter.toLowerCase());

    // カテゴリーでフィルタリング
    const categoryMatch = categoryFilter === null || menu.category_id === categoryFilter;

    // 提供可否でフィルタリング
    const availableMatch = availableFilter === null || menu.is_available === availableFilter;

    return nameMatch && categoryMatch && availableMatch;
  });

  // メニューが存在しない場合
  if (menus.length === 0) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6 text-center">
          <p className="text-gray-500">メニューが登録されていません。</p>
          <p className="text-gray-500 mt-2">「メニューを追加」ボタンから新しいメニューを追加するか、スマレジ連携が有効な場合は「スマレジ同期」ボタンを使用してください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="col-span-1 sm:col-span-2">
            <label htmlFor="filter" className="block text-sm font-medium text-gray-700">
              検索
            </label>
            <input
              type="text"
              name="filter"
              id="filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="メニュー名またはID"
              className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">
              カテゴリー
            </label>
            <select
              id="category"
              name="category"
              value={categoryFilter || ''}
              onChange={(e) => setCategoryFilter(e.target.value || null)}
              className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="">すべて</option>
              {categories.map((category) => (
                <option key={category.category_id} value={category.category_id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex space-x-4">
            <div>
              <label htmlFor="available" className="block text-sm font-medium text-gray-700">
                提供状態
              </label>
              <select
                id="available"
                name="available"
                value={availableFilter === null ? '' : availableFilter ? 'true' : 'false'}
                onChange={(e) => {
                  if (e.target.value === '') {
                    setAvailableFilter(null);
                  } else {
                    setAvailableFilter(e.target.value === 'true');
                  }
                }}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">すべて</option>
                <option value="true">提供可</option>
                <option value="false">提供不可</option>
              </select>
            </div>


          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm text-gray-500 mb-2">
            {filteredMenus.length} 件のメニューが見つかりました
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMenus.map((menu) => (
              <div
                key={menu.menu_id}
                className={`border rounded-lg overflow-hidden shadow-sm ${
                  !menu.is_available ? 'bg-gray-50' : 'bg-white'
                }`}
              >
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 truncate">
                        {menu.name}
                      </h3>
                      <p className="text-sm text-gray-500">ID: {menu.product_id}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-lg font-medium text-gray-900">
                        {menu.price.toLocaleString()}円
                      </span>
                      <div className="flex space-x-1 mt-1">
                        {!menu.is_available && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            提供停止
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center">
                    {menu.image_url ? (
                      <div className="w-16 h-16 relative mr-3 flex-shrink-0">
                        <Image
                          src={menu.image_url}
                          alt={menu.name}
                          fill
                          sizes="64px"
                          className="object-cover rounded"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded mr-3 flex items-center justify-center flex-shrink-0">
                        <span className="text-gray-400 text-xs">画像なし</span>
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {menu.description || '説明なし'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        カテゴリー: {categories.find(c => c.category_id === menu.category_id)?.name || '未分類'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Link
                      href={`/portal/menus/${menu.menu_id}/edit`}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                    >
                      編集
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
