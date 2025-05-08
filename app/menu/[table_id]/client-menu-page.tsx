'use client';

import { useState } from 'react';
import MenuDisplay from './menu-display';
import CartModal from './cart-modal';
import CheckoutModal from './checkout-modal';

interface ClientMenuPageProps {
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

export default function ClientMenuPage({
  sessionId,
  tableId,
  tableName,
  storeName,
  seatTypeName,
  pricePerHalfHour,
  chargeStartedAt,
  chargePausedAt,
  timeUnitMinutes = 30,
  menus,
  menusByCategory,
  storeId,
  categories,
  isSideMenuOpen = true, // 親コンポーネントから受け取る
  onToggleSideMenu = () => {} // 親コンポーネントから受け取る
}: ClientMenuPageProps & {
  isSideMenuOpen?: boolean;
  onToggleSideMenu?: () => void;
}) {
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // カテゴリーが選択されていない場合は最初のカテゴリーを選択
  const categoryList = Object.keys(menusByCategory);
  const currentCategory = selectedCategory || (categoryList.length > 0 ? categoryList[0] : null);

  return (
    <>

      <div className="flex h-full">
        {/* サイドメニュー（カテゴリ） - 開閉可能 */}
        <div
          className={`${
            isSideMenuOpen ? 'w-1/5 min-w-[120px] max-w-[150px]' : 'w-0 min-w-0'
          } bg-white shadow-md h-screen sticky top-[57px] left-0 overflow-y-auto transition-all duration-300 ease-in-out`}
        >
          <div className="py-4">
            <div className="flex flex-col">
              {categoryList.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`py-4 px-2 text-center text-sm font-medium transition-colors border-l-4 focus:outline-none ${
                    currentCategory === category
                      ? 'border-amber-500 bg-amber-50 text-amber-500'
                      : 'border-transparent text-gray-700 hover:bg-gray-50 active:bg-gray-100 focus:bg-white'
                  } ${!isSideMenuOpen ? 'hidden' : ''}`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className={`w-full ${isSideMenuOpen ? 'pl-0' : 'pl-0'} transition-all duration-300 ease-in-out`}>
          <div className="bg-white p-4 md:p-6">
            <MenuDisplay
              menus={menus}
              menusByCategory={menusByCategory}
              storeId={storeId}
              categories={categories}
              selectedCategory={currentCategory}
              onCategoryChange={setSelectedCategory}
            />
          </div>
        </div>
      </div>

      {/* フローティングボタン */}
      <div className="fixed bottom-6 right-6 flex flex-col space-y-4">
        <button
          onClick={() => setIsCartModalOpen(true)}
          className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 focus:bg-amber-500 focus:outline-none text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
          aria-label="カートを表示"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
          </svg>
        </button>

        <button
          onClick={() => setIsCheckoutModalOpen(true)}
          className="bg-green-600 hover:bg-green-700 active:bg-green-800 focus:bg-green-600 focus:outline-none text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
          aria-label="お会計を表示"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
          </svg>
        </button>
      </div>

      {/* モーダル */}
      <CartModal
        isOpen={isCartModalOpen}
        onClose={() => setIsCartModalOpen(false)}
        sessionId={sessionId}
        tableId={tableId}
      />

      <CheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        sessionId={sessionId}
        tableId={tableId}
        tableName={tableName}
        storeName={storeName}
        seatTypeName={seatTypeName}
        pricePerHalfHour={pricePerHalfHour}
        chargeStartedAt={chargeStartedAt}
        chargePausedAt={chargePausedAt}
        timeUnitMinutes={timeUnitMinutes}
      />
    </>
  );
}
