'use client';

interface HeaderProps {
  storeName: string;
  userEmail: string;
  onToggleSideMenu: () => void;
  isSideMenuOpen: boolean;
}

export default function Header({ 
  storeName, 
  userEmail, 
  onToggleSideMenu,
  isSideMenuOpen
}: HeaderProps) {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-10">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            {/* ハンバーガーメニューアイコン - モバイル用 */}
            <button
              onClick={onToggleSideMenu}
              className="md:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none"
              aria-label="メニューを開閉"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <div className="flex-shrink-0 flex items-center ml-2 md:ml-0">
              <span className="text-lg font-bold">{storeName || '店舗'}</span>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="ml-3 relative">
              <div className="flex items-center">
                <span className="text-sm text-gray-500 mr-2">
                  {userEmail}
                </span>
                <form action="/api/logout" method="POST">
                  <button
                    type="submit"
                    className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500"
                  >
                    ログアウト
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
