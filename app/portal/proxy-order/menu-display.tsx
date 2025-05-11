'use client';

import { useState, useEffect } from 'react';
import Cart from './cart';
import CastSelectModal from './cast-select-modal';

interface MenuDisplayProps {
  tableId: string;
  sessionId: string;
  tableName: string;
}

interface MenuItem {
  menu_id: string;
  product_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category_id: string | null;
  category: string | null;
  is_available: boolean;
}

interface Category {
  category_id: string;
  name: string;
  display_order: number;
  allow_treat_cast: boolean;
}

interface Cast {
  user_id: string;
  display_name: string;
}

interface CartItem {
  menu_id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  target_cast_id: string | null;
  from_user_id: string | null;
}

export default function MenuDisplay({ tableId, sessionId, tableName }: MenuDisplayProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  const [showCastModal, setShowCastModal] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<MenuItem | null>(null);
  const [storeId, setStoreId] = useState<string>('');

  // メニューとカテゴリを取得
  useEffect(() => {
    const fetchMenuData = async () => {
      try {
        setLoading(true);
        // メニュー情報を取得
        const menuResponse = await fetch(`/api/tables/${tableId}/menus`);
        if (!menuResponse.ok) {
          throw new Error('メニュー情報の取得に失敗しました');
        }
        const menuData = await menuResponse.json();

        setCategories(menuData.categories || []);
        setMenuItems(menuData.menus || []);

        // 最初のカテゴリを選択
        if (menuData.categories && menuData.categories.length > 0) {
          setSelectedCategory(menuData.categories[0].category_id);
        }

        // テーブル情報を取得して店舗IDを特定
        const tableResponse = await fetch(`/api/tables/${tableId}`);
        if (!tableResponse.ok) {
          throw new Error('テーブル情報の取得に失敗しました');
        }
        const tableData = await tableResponse.json();
        const fetchedStoreId = tableData.store_id;
        setStoreId(fetchedStoreId);

        // キャスト情報を取得（store_idクエリパラメータを指定）
        const castsResponse = await fetch(`/api/casts?store_id=${fetchedStoreId}`);
        if (castsResponse.ok) {
          const castsData = await castsResponse.json();
          setCasts(castsData || []);
        } else {
          console.error('キャスト情報取得エラー:', await castsResponse.text());
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchMenuData();
  }, [tableId]);

  // カートに商品を追加
  const addToCart = (item: MenuItem, treatCast: boolean = false) => {
    if (treatCast) {
      // キャストに奢る場合、キャスト選択モーダルを表示
      setSelectedMenu(item);
      setShowCastModal(true);
    } else {
      // 自分で注文する場合、そのままカートに追加
      const existingItemIndex = cartItems.findIndex(
        cartItem =>
          cartItem.menu_id === item.menu_id &&
          cartItem.target_cast_id === null
      );

      if (existingItemIndex !== -1) {
        // 既存のアイテムの数量を増やす
        const updatedItems = [...cartItems];
        updatedItems[existingItemIndex].quantity += 1;
        setCartItems(updatedItems);
      } else {
        // 新しいアイテムをカートに追加
        setCartItems([
          ...cartItems,
          {
            menu_id: item.menu_id,
            product_id: item.product_id,
            name: item.name,
            price: item.price,
            quantity: 1,
            target_cast_id: null,
            from_user_id: null
          }
        ]);
      }

      // 追加メッセージを表示して1秒後に消す
      setAddedMessage(`${item.name}をカートに追加しました`);
      setTimeout(() => {
        setAddedMessage(null);
      }, 1000);
    }
  };

  // キャスト選択後の処理
  const handleCastSelect = (castId: string, castName: string) => {
    if (selectedMenu) {
      const existingItemIndex = cartItems.findIndex(
        cartItem =>
          cartItem.menu_id === selectedMenu.menu_id &&
          cartItem.target_cast_id === castId
      );

      if (existingItemIndex !== -1) {
        // 既存のアイテムの数量を増やす
        const updatedItems = [...cartItems];
        updatedItems[existingItemIndex].quantity += 1;
        setCartItems(updatedItems);
      } else {
        // 新しいアイテムをカートに追加
        setCartItems([
          ...cartItems,
          {
            menu_id: selectedMenu.menu_id,
            product_id: selectedMenu.product_id,
            name: selectedMenu.name,
            price: selectedMenu.price,
            quantity: 1,
            target_cast_id: castId,
            from_user_id: null
          }
        ]);
      }

      // 追加メッセージを表示して1秒後に消す
      setAddedMessage(`${selectedMenu.name}を${castName}に奢りました`);
      setTimeout(() => {
        setAddedMessage(null);
      }, 1000);
    }
    setShowCastModal(false);
    setSelectedMenu(null);
  };

  // カートをクリア
  const clearCart = () => {
    setCartItems([]);
  };

  // カート内のアイテムの数量を変更
  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      // 数量が0以下の場合はアイテムを削除
      const updatedItems = cartItems.filter((_, i) => i !== index);
      setCartItems(updatedItems);
    } else {
      // 数量を更新
      const updatedItems = [...cartItems];
      updatedItems[index].quantity = newQuantity;
      setCartItems(updatedItems);
    }
  };

  if (loading) {
    return <div className="text-center py-10">メニューを読み込み中...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const filteredItems = selectedCategory
    ? menuItems.filter(item => item.category_id === selectedCategory)
    : menuItems;

  const selectedCategoryData = categories.find(cat => cat.category_id === selectedCategory);
  const allowTreatCast = selectedCategoryData?.allow_treat_cast || false;

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* キャスト選択モーダル */}
      {showCastModal && (
        <CastSelectModal
          isOpen={showCastModal}
          onClose={() => setShowCastModal(false)}
          onSelect={handleCastSelect}
          storeId={storeId}
        />
      )}

      {/* 追加メッセージ */}
      {addedMessage && (
        <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50">
          {addedMessage}
        </div>
      )}

      <div className="md:w-2/3">
        {/* カテゴリ選択 */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category.category_id}
                onClick={() => setSelectedCategory(category.category_id)}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  selectedCategory === category.category_id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>



        {/* メニュー一覧 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => (
            <div key={item.menu_id} className="border rounded-lg overflow-hidden shadow-sm">
              {item.image_url && (
                <div className="h-40 overflow-hidden">
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <h3 className="font-medium">{item.name}</h3>
                {item.description && (
                  <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                )}
                <p className="text-lg font-bold mt-2">¥{item.price.toLocaleString()}</p>

                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => addToCart(item, false)}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
                  >
                    カートに追加
                  </button>

                  {allowTreatCast && casts.length > 0 && (
                    <button
                      onClick={() => addToCart(item, true)}
                      className="w-full bg-pink-600 hover:bg-pink-700 text-white py-2 px-4 rounded-md"
                    >
                      キャストに奢る
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* カート */}
      <div className="md:w-1/3">
        <Cart
          items={cartItems}
          updateQuantity={updateQuantity}
          clearCart={clearCart}
          sessionId={sessionId}
          tableId={tableId}
          tableName={tableName}
          casts={casts}
        />
      </div>
    </div>
  );
}
