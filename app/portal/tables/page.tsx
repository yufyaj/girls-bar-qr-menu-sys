import { cookies } from 'next/headers';
import QRCode from 'qrcode';
import TablesClient from './tables-client';

// テーブルの型定義
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
  table_id: string;
  start_at: string;
  charge_started_at: string;
  charge_paused_at: string | null;
}

interface ElapsedTime {
  hours: number;
  minutes: number;
  totalMinutes: number;
}

interface TableWithDetails extends Table {
  qrCode: string;
  session?: Session;
  elapsedTime?: ElapsedTime;
  formattedStartTime?: string;
  isPaused: boolean;
}

// QRコード生成関数
async function generateQRCode(tableId: string): Promise<string> {
  const url = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/menu/${tableId}`;
  return await QRCode.toDataURL(url);
}

export default async function TablesPage() {
  const cookieStore = await cookies();
  const storeId = cookieStore.get('store-id')?.value;

  if (!storeId) {
    return <div>店舗情報が見つかりません</div>;
  }

  // APIからテーブル一覧を取得
  const tablesResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/tables?storeId=${storeId}`, {
    cache: 'no-store'
  });

  let tables: Table[] = [];
  if (tablesResponse.ok) {
    tables = await tablesResponse.json();
  } else {
    console.error('テーブル一覧の取得に失敗しました:', await tablesResponse.text());
  }

  // APIからアクティブなセッション情報を取得
  const sessionsResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/sessions/active?storeId=${storeId}`, {
    cache: 'no-store'
  });

  let sessions: Session[] = [];
  if (sessionsResponse.ok) {
    sessions = await sessionsResponse.json();
  } else {
    const sessionsError = await sessionsResponse.text();
    console.error('セッション情報の取得に失敗しました:', sessionsError);
  }

  // テーブルIDとセッション情報のマッピングを作成
  const sessionMap = new Map();
  if (sessions && sessions.length > 0) {
    sessions.forEach(session => {
      // テーブルIDを文字列に変換して保存（型の不一致を防ぐため）
      const tableIdStr = String(session.table_id);

      // 同じテーブルIDのセッションが既に存在する場合は、最新のものだけを保持
      if (!sessionMap.has(tableIdStr)) {
        sessionMap.set(tableIdStr, session);
      }
    });
  }

  // 各テーブルのQRコードを生成し、セッション情報を追加
  const tablesWithQR: TableWithDetails[] = await Promise.all(
    (tables || []).map(async (table) => {
      const qrCode = await generateQRCode(table.table_id);
      // テーブルIDを文字列に変換して検索（型の不一致を防ぐため）
      const tableIdStr = String(table.table_id);
      const session = sessionMap.get(tableIdStr);

      // 経過時間の計算
      let elapsedTime: ElapsedTime | undefined = undefined;
      let formattedStartTime: string | undefined = undefined;
      let isPaused = false;

      if (session && session.charge_started_at) {
        const startTime = new Date(session.charge_started_at);
        const now = new Date();

        // 一時停止中かどうかを確認
        isPaused = !!session.charge_paused_at;

        // 一時停止中の場合は、一時停止時間までの経過時間を計算
        const endTime = isPaused ? new Date(session.charge_paused_at) : now;

        const elapsedMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        const hours = Math.floor(elapsedMinutes / 60);
        const minutes = elapsedMinutes % 60;

        elapsedTime = {
          hours,
          minutes,
          totalMinutes: elapsedMinutes
        };

        // 着席時間のフォーマット
        formattedStartTime = startTime.toLocaleString('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      }

      return {
        ...table,
        qrCode,
        session,
        elapsedTime,
        formattedStartTime,
        isPaused
      };
    })
  );

  // クライアントコンポーネントに初期データとストアIDを渡す
  return <TablesClient initialTables={tablesWithQR} storeId={storeId} />;
}
