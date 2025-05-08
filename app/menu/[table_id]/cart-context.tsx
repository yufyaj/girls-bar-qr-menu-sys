'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

// カート内の商品アイテムの型定義
export interface CartItem {
  menu_id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  target_cast_id?: string | null;
  target_cast_name?: string;
}

// カートコンテキストの型定義
interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (menu_id: string, target_cast_id?: string | null) => void;
  updateQuantity: (menu_id: string, quantity: number, target_cast_id?: string | null) => void;
  updateTargetCast: (menu_id: string, cast_id: string, cast_name: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

// カートコンテキストの作成
const CartContext = createContext<CartContextType | undefined>(undefined);

// カートプロバイダーコンポーネント
export function CartProvider({ children, table_id }: { children: ReactNode, table_id: string }) {
  // カート内の商品アイテムの状態
  const [items, setItems] = useState<CartItem[]>([]);

  // ローカルストレージからカート情報を読み込む
  useEffect(() => {
    // クライアントサイドでのみ実行
    if (typeof window !== 'undefined') {
      const storedCart = localStorage.getItem(`cart_${table_id}`);
      if (storedCart) {
        try {
          const parsedCart = JSON.parse(storedCart);
          setItems(parsedCart);
        } catch (error) {
          console.error('カート情報の読み込みに失敗しました:', error);
        }
      }
    }
  }, [table_id]);

  // カート情報をローカルストレージに保存
  useEffect(() => {
    // クライアントサイドでのみ実行
    if (typeof window !== 'undefined' && items.length > 0) {
      localStorage.setItem(`cart_${table_id}`, JSON.stringify(items));
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem(`cart_${table_id}`);
    }
  }, [items, table_id]);

  // カートに商品を追加する関数
  const addItem = (item: Omit<CartItem, 'quantity'>, quantity = 1) => {
    setItems(prevItems => {
      // 既に同じ商品がカートにあるか確認
      // メニューIDとターゲットキャストIDの両方で一致するアイテムを検索
      const existingItemIndex = prevItems.findIndex(i => {
        // メニューIDが一致するか確認
        if (i.menu_id !== item.menu_id) return false;

        // ターゲットキャストIDの比較
        // 両方ともnullの場合
        if (i.target_cast_id === null && item.target_cast_id === null) return true;

        // 両方とも文字列で同じ値の場合
        if (typeof i.target_cast_id === 'string' && typeof item.target_cast_id === 'string') {
          return i.target_cast_id === item.target_cast_id;
        }

        // それ以外の場合は一致しない
        return false;
      });

      if (existingItemIndex >= 0) {
        // 既存の商品の数量を増やす
        const currentQuantity = prevItems[existingItemIndex].quantity;

        // 新しい配列を作成
        const updatedItems = [...prevItems];

        // 指定された数量を追加
        updatedItems[existingItemIndex] = {
          ...prevItems[existingItemIndex],
          quantity: currentQuantity + quantity
        };

        return updatedItems;
      } else {
        // 新しい商品をカートに追加
        return [...prevItems, { ...item, quantity }];
      }
    });
  };

  // カートから商品を削除する関数
  const removeItem = (menu_id: string, target_cast_id?: string | null) => {
    setItems(prevItems => prevItems.filter(item => {
      // menu_idが一致しない場合は残す
      if (item.menu_id !== menu_id) return true;

      // target_cast_idが文字列の場合は、それも一致する場合のみ削除
      if (typeof target_cast_id === 'string') {
        return item.target_cast_id !== target_cast_id;
      }

      // target_cast_idがnullの場合は、item.target_cast_idがnullの商品のみ削除
      if (target_cast_id === null) {
        return item.target_cast_id !== null;
      }

      // target_cast_idがundefinedの場合は、すべてのitem.target_cast_idを削除（古い動作との互換性のため）
      return false;
    }));
  };

  // 商品の数量を更新する関数
  const updateQuantity = (menu_id: string, quantity: number, target_cast_id?: string | null) => {
    if (quantity <= 0) {
      removeItem(menu_id, target_cast_id);
      return;
    }

    setItems(prevItems =>
      prevItems.map(item => {
        // menu_idが一致するか確認
        if (item.menu_id !== menu_id) return item;

        // ターゲットキャストIDの比較
        // 両方ともnullの場合
        if (item.target_cast_id === null && target_cast_id === null) {
          return { ...item, quantity };
        }

        // 両方とも文字列で同じ値の場合
        if (typeof item.target_cast_id === 'string' && typeof target_cast_id === 'string') {
          if (item.target_cast_id === target_cast_id) {
            return { ...item, quantity };
          }
        }

        // target_cast_idがundefinedの場合は、item.target_cast_idがnullのアイテムを更新（古い動作との互換性のため）
        if (target_cast_id === undefined && item.target_cast_id === null) {
          return { ...item, quantity };
        }

        return item;
      })
    );
  };



  // カートをクリアする関数
  const clearCart = () => {
    setItems([]);
  };

  // カート内の商品の合計数
  const totalItems = items.reduce((total, item) => total + item.quantity, 0);

  // カート内の商品の合計金額
  const totalPrice = items.reduce((total, item) => total + (item.price * item.quantity), 0);

  // スタッフドリンクのターゲットキャストを更新する関数
  const updateTargetCast = (menu_id: string, cast_id: string, cast_name: string) => {
    setItems(prevItems =>
      prevItems.map(item =>
        item.menu_id === menu_id
          ? { ...item, target_cast_id: cast_id, target_cast_name: cast_name }
          : item
      )
    );
  };

  // コンテキストの値
  const value = {
    items,
    addItem,
    removeItem,
    updateQuantity,
    updateTargetCast,
    clearCart,
    totalItems,
    totalPrice
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

// カートコンテキストを使用するためのフック
export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
