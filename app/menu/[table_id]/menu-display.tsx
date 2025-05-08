'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useCart } from './cart-context';
import CastSelectModal from './cast-select-modal';

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
  allow_treat_cast: boolean;
}

interface MenusByCategory {
  [category: string]: Menu[];
}

interface Category {
  category_id: string;
  name: string;
  display_order: number;
  allow_treat_cast: boolean;
}

interface MenuDisplayProps {
  menus: Menu[];
  menusByCategory: MenusByCategory;
  storeId: string;
  categories?: Category[];
  selectedCategory: string | null;
  onCategoryChange?: (category: string) => void;
}

export default function MenuDisplay({
  menus,
  menusByCategory,
  storeId,
  categories: categoryData,
  selectedCategory,
  onCategoryChange
}: MenuDisplayProps) {
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [showCastModal, setShowCastModal] = useState(false);
  const { addItem } = useCart();

  // 表示するメニュー
  const displayMenus = selectedCategory ? menusByCategory[selectedCategory] : [];

  // トースト通知を表示する関数
  const showToast = (message: string) => {
    setToast({ visible: true, message });

    // 1秒後に非表示にする
    setTimeout(() => {
      setToast({ visible: false, message: '' });
    }, 1000);
  };

  // カートに商品を追加する関数
  const handleAddToCart = (menu: Menu, treatCast: boolean = false) => {
    if (treatCast) {
      // キャストに奢る場合、キャスト選択モーダルを表示
      setSelectedMenu(menu);
      setShowCastModal(true);
    } else {
      // 自分で注文する場合、そのままカートに追加（target_cast_idを明示的にnullに設定）
      addItem({
        menu_id: menu.menu_id,
        product_id: menu.product_id,
        name: menu.name,
        price: menu.price,
        target_cast_id: null
      }, 1); // 数量は常に1
      showToast(`${menu.name}をカートに追加しました`);
    }
  };

  // キャスト選択後の処理
  const handleCastSelect = (castId: string, castName: string) => {
    if (selectedMenu) {
      addItem({
        menu_id: selectedMenu.menu_id,
        product_id: selectedMenu.product_id,
        name: selectedMenu.name,
        price: selectedMenu.price,
        target_cast_id: castId,
        target_cast_name: castName
      }, 1); // 数量は常に1
      showToast(`${selectedMenu.name}を${castName}に奢りました`);
    }
    setShowCastModal(false);
    setSelectedMenu(null);
  };

  if (menus.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        メニューデータはまだ登録されていません。
        <br />
        管理者がスマレジから同期する必要があります。
      </div>
    );
  }

  return (
    <div className="relative">
      {/* トースト通知 */}
      {toast.visible && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-md shadow-md z-50 animate-fade-in-out">
          {toast.message}
        </div>
      )}

      {/* キャスト選択モーダル */}
      {showCastModal && (
        <CastSelectModal
          isOpen={showCastModal}
          onClose={() => setShowCastModal(false)}
          onSelect={handleCastSelect}
          storeId={storeId}
        />
      )}

      {/* メニュー一覧 */}
      <div className="divide-y divide-gray-100">
        {displayMenus.map((menu) => (
          <div
            key={menu.menu_id}
            className="py-3 flex items-center"
          >
            {/* 商品画像 */}
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
            ) : null}

            {/* 商品情報 */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-medium text-gray-900 truncate">
                {menu.name}
              </h3>

              {menu.description ? (
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                  {menu.description}
                </p>
              ) : null}

              <p className="text-base font-bold mt-1 text-gray-900">
                ¥{menu.price.toLocaleString()}
              </p>
            </div>

            {/* 注文ボタン */}
            <div className="flex items-center ml-3">
              <button
                type="button"
                className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 focus:bg-amber-500 text-white py-1 px-3 rounded-md text-sm focus:outline-none"
                onClick={() => handleAddToCart(menu, false)}
              >
                注文
              </button>

              {menu.allow_treat_cast && (
                <button
                  type="button"
                  className="bg-pink-500 hover:bg-pink-600 active:bg-pink-700 focus:bg-pink-500 text-white py-1 px-3 rounded-md text-sm ml-1 focus:outline-none"
                  onClick={() => handleAddToCart(menu, true)}
                >
                  奢る
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
