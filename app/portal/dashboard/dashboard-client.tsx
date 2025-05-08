'use client';

import { useEffect, useState } from 'react';
import { subscribeToSessions } from '@/lib/supabase-realtime';

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

interface DashboardClientProps {
  initialSessions: Session[];
  storeId: string;
}

export default function DashboardClient({ initialSessions, storeId }: DashboardClientProps) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [now, setNow] = useState(new Date());

  // 現在時刻を1秒ごとに更新
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // リアルタイム更新のセットアップ
  useEffect(() => {
    if (!storeId) return;

    // 最新のセッションデータを取得する関数
    const fetchLatestSessions = async () => {
      try {
        const response = await fetch(`/api/dashboard/sessions?storeId=${storeId}`);
        if (response.ok) {
          const data = await response.json();
          setSessions(data);
        } else {
          console.error('セッションデータ取得エラー:', await response.text());
        }
      } catch (error) {
        console.error('セッションデータ取得エラー:', error);
      }
    };

    // Supabaseリアルタイムサブスクリプションのセットアップ
    const unsubscribe = subscribeToSessions(storeId, (payload) => {
      console.log('セッション更新イベント:', payload);
      fetchLatestSessions();
    });

    // 初回データ取得
    fetchLatestSessions();

    // 定期的なポーリングの設定（30秒ごと）- バックアップとして
    const pollingInterval = setInterval(fetchLatestSessions, 30000);

    // 画面がフォーカスされたときにも更新
    const handleFocus = () => {
      fetchLatestSessions();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      unsubscribe();
      clearInterval(pollingInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [storeId]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">ダッシュボード</h1>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {sessions && sessions.length > 0 ? (
            sessions.map((session) => {
              const startTime = new Date(session.charge_started_at || session.start_at);
              
              // 一時停止中かどうかを確認
              const isPaused = !!session.charge_paused_at;

              // 一時停止中の場合は、一時停止時間までの経過時間を計算
              const endTime = isPaused && session.charge_paused_at ? new Date(session.charge_paused_at) : now;

              const elapsedMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
              const hours = Math.floor(elapsedMinutes / 60);
              const minutes = elapsedMinutes % 60;

              return (
                <li key={session.session_id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-medium text-gray-900">
                        {session.tables?.name || '不明なテーブル'}
                        ({session.tables?.seat_types?.display_name || '不明な席種'})
                      </p>
                      <p className="text-sm text-gray-500">
                        開始: {new Date(session.charge_started_at || session.start_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className={`text-xl font-bold ${isPaused ? 'text-gray-500' : 'text-blue-600'}`}>
                        {hours > 0 ? `${hours}時間${minutes}分` : `${minutes}分`}
                      </div>
                      {isPaused && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">一時停止中</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })
          ) : (
            <li className="px-6 py-4 text-center text-gray-500">
              現在アクティブなセッションはありません
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
