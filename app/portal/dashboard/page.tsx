import { cookies } from 'next/headers';
import DashboardClient from './dashboard-client';

// セッションの型定義
interface SeatType {
  seat_type_id: number;
  display_name: string;
  price_per_unit: number;
  time_unit_minutes?: number;
}

interface Table {
  table_id: string;
  name: string;
  seat_types: SeatType | null;
}

interface Session {
  session_id: string;
  start_at: string;
  charge_started_at: string | null;
  charge_paused_at: string | null;
  tables: Table | null;
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const storeId = cookieStore.get('store-id')?.value;

  if (!storeId) {
    return <div>店舗情報が見つかりません</div>;
  }

  // APIからセッション情報を取得
  // 現在のリクエストのCookieをすべて取得して転送
  const allCookies = cookieStore.getAll();
  const cookieHeader = allCookies
    .map(cookie => `${cookie.name}=${cookie.value}`)
    .join('; ');

  const response = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/dashboard/sessions?storeId=${storeId}`, {
    cache: 'no-store',
    headers: {
      'Cookie': cookieHeader
    }
  });

  let sessions: Session[] = [];
  if (response.ok) {
    sessions = await response.json();
  } else {
    console.error('セッション情報の取得に失敗しました:', await response.text());
  }

  // クライアントコンポーネントにセッションデータとストアIDを渡す
  return <DashboardClient initialSessions={sessions} storeId={storeId} />;
}
