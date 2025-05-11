import { notFound } from 'next/navigation';
import { ReactNode } from 'react';
import CheckoutComplete from './checkout-complete';
import { CartProvider } from './cart-context';
import SeatSelection from './seat-selection';
import ClientSideCustomerTypeSelection from './client-customer-selection';
import MenuPageWrapper from './menu-page-wrapper';

interface TableData {
  table_id: string;
  name: string;
  store_id: string;
  seat_type: {
    seat_type_id: string; // UUIDなので文字列型
    display_name: string;
    price_per_unit: number; // 時間単位あたりの料金
    time_unit_minutes?: number; // 時間単位（分）
  } | null;
  store: {
    store_id: string;
    name: string;
  } | null;
}

interface MenuData {
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

interface MenuResponse {
  menus: MenuData[];
  menusByCategory: Record<string, MenuData[]>;
  categories: any[];
}

interface SessionData {
  session_id: string;
  table_id: string;
  store_id: string;
  start_at: string;
  charge_started_at: string | null;
  charge_paused_at: string | null;
  selected_cast_id: string | null;
  is_new_customer: boolean | null;
}

export default async function MenuPage({
  params,
  searchParams
}: {
  params: Promise<{ table_id: string }>;
  searchParams: Promise<{
    complete?: string;
    total?: string;
    subtotal?: string;
    tax?: string;
    taxRate?: string;
    store?: string;
    table?: string;
  }>
}) {
  const { table_id } = await params;
  const searchParamsData = await searchParams;

  // 会計完了画面の表示判定
  const isCheckoutComplete = searchParamsData.complete === 'true';



  if (isCheckoutComplete && searchParamsData.total) {
    const totalAmount = parseInt(searchParamsData.total, 10) || 0;
    const subtotalAmount = parseInt(searchParamsData.subtotal || '0', 10) || 0;
    const taxAmount = parseInt(searchParamsData.tax || '0', 10) || 0;
    const taxRate = parseFloat(searchParamsData.taxRate || '10.0') || 10.0;

    // 値が空文字列の場合のフォールバック
    const storeName = searchParamsData.store ? decodeURIComponent(searchParamsData.store) : '不明な店舗';
    const tableName = searchParamsData.table ? decodeURIComponent(searchParamsData.table) : '不明なテーブル';

    return (
      <CheckoutComplete
        storeName={storeName}
        tableName={tableName}
        totalAmount={totalAmount}
        subtotalAmount={subtotalAmount}
        taxAmount={taxAmount}
        taxRate={taxRate}
      />
    );
  }

  // テーブル情報を取得
  const origin = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
  const tableResponse = await fetch(`${origin}/api/tables/${table_id}`, {
    cache: 'no-store'
  });

  if (!tableResponse.ok) {
    if (tableResponse.status === 404) {
      notFound();
    }
    throw new Error(`テーブル情報の取得に失敗しました: ${tableResponse.statusText}`);
  }

  const table: TableData = await tableResponse.json();

  // メニュー情報を取得
  const menuResponse = await fetch(`${origin}/api/tables/${table_id}/menus`, {
    cache: 'no-store'
  });

  if (!menuResponse.ok) {
    throw new Error(`メニュー情報の取得に失敗しました: ${menuResponse.statusText}`);
  }

  const { menus: menuItems, menusByCategory, categories }: MenuResponse = await menuResponse.json();

  // セッション情報を取得または作成
  const sessionResponse = await fetch(`${origin}/api/tables/${table_id}/sessions`, {
    cache: 'no-store'
  });

  if (!sessionResponse.ok) {
    throw new Error(`セッション情報の取得に失敗しました: ${sessionResponse.statusText}`);
  }

  const session: SessionData = await sessionResponse.json();

  return (
    <CartProvider table_id={table_id}>
      <div className="min-h-screen bg-gray-100">

        {!session.charge_started_at ? (
          // ステップ1: 座席選択
          <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <SeatSelection
              tableId={table_id}
              tableName={table.name}
              sessionId={session.session_id}
            />
          </main>
        ) : session.charge_started_at && session.is_new_customer === null && session.selected_cast_id === null ? (
          // ステップ2: 新規/指名選択
          <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <CustomerTypeSelectionWrapper
              tableId={table_id}
              sessionId={session.session_id}
              storeId={table.store_id}
            />
          </main>
        ) : (
          // ステップ3: メニュー表示 - サイドメニュー用に幅を最大に
          <MenuPageWrapper
            sessionId={session.session_id}
            tableId={table_id}
            tableName={table.name}
            storeName={table.store?.name || ''}
            seatTypeName={table.seat_type?.display_name || ''}
            pricePerHalfHour={table.seat_type?.price_per_unit || 0}
            chargeStartedAt={session.charge_started_at}
            chargePausedAt={session.charge_paused_at}
            timeUnitMinutes={table.seat_type?.time_unit_minutes || 30}
            menus={menuItems}
            menusByCategory={menusByCategory}
            storeId={table.store_id}
            categories={categories}
          />
        )}
      </div>
    </CartProvider>
  );
}

// クライアントコンポーネントをラップするためのサーバーコンポーネント
function CustomerTypeSelectionWrapper({ tableId, sessionId, storeId }: { tableId: string, sessionId: string, storeId: string }) {
  return (
    <ClientSideCustomerTypeSelection tableId={tableId} sessionId={sessionId} storeId={storeId} />
  );
}
