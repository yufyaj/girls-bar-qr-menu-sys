import { cookies } from 'next/headers';
import OrderBoardClient from './order-board-client';

// 注文アイテムの型定義
interface OrderItem {
  order_id: string;
  order_item_id: string;
  status: string;
  created_at: string;
  created_by_role: string;
  proxy: boolean;
  table_name: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  target_cast_id: string | null;
  target_cast_name: string | null;
}

export default async function OrderBoardPage() {
  const cookieStore = await cookies();
  const storeId = cookieStore.get('store-id')?.value;

  if (!storeId) {
    return <div>店舗情報が見つかりません</div>;
  }

  // 現在のリクエストのCookieをすべて取得して転送
  const allCookies = cookieStore.getAll();
  const cookieHeader = allCookies
    .map(cookie => `${cookie.name}=${cookie.value}`)
    .join('; ');

  // APIからアクティブな注文アイテムを取得
  const response = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/orders/active-items`, {
    cache: 'no-store',
    headers: {
      'Cookie': cookieHeader
    }
  });

  let orderItems: OrderItem[] = [];
  if (response.ok) {
    orderItems = await response.json();
  } else {
    console.error('注文情報の取得に失敗しました:', await response.text());
  }

  // クライアントコンポーネントに初期データとストアIDを渡す
  return <OrderBoardClient initialOrderItems={orderItems} storeId={storeId} />;
}
