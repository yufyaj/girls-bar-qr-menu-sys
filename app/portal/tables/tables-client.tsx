'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { subscribeToSessions, subscribeToTables } from '@/lib/supabase-realtime';
import ChargeControlButton from './_components/charge-control-button';
import TableMoveButton from './_components/table-move-button';
import CastNominationButton from './_components/cast-nomination-button';

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
  qrCode: string;
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
  session?: Session;
  elapsedTime?: ElapsedTime;
  formattedStartTime?: string;
  isPaused: boolean;
}

interface TablesClientProps {
  initialTables: TableWithDetails[];
  storeId: string;
}

export default function TablesClient({ initialTables, storeId }: TablesClientProps) {
  const [tables, setTables] = useState<TableWithDetails[]>(initialTables);
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

    // 最新のテーブルとセッションデータを取得する関数
    const fetchLatestData = async () => {
      try {
        // テーブル一覧を取得
        const tablesResponse = await fetch(`/api/tables?storeId=${storeId}`);
        let updatedTables: Table[] = [];
        if (tablesResponse.ok) {
          updatedTables = await tablesResponse.json();
        } else {
          console.error('テーブル一覧の取得に失敗しました:', await tablesResponse.text());
          return;
        }

        // アクティブなセッション情報を取得
        const sessionsResponse = await fetch(`/api/sessions/active?storeId=${storeId}`);
        let sessions: Session[] = [];
        if (sessionsResponse.ok) {
          sessions = await sessionsResponse.json();
        } else {
          console.error('セッション情報の取得に失敗しました:', await sessionsResponse.text());
          return;
        }

        // テーブルIDとセッション情報のマッピングを作成
        const sessionMap = new Map<string, Session>();
        if (sessions && sessions.length > 0) {
          sessions.forEach(session => {
            const tableIdStr = String(session.table_id);
            if (!sessionMap.has(tableIdStr)) {
              sessionMap.set(tableIdStr, session);
            }
          });
        }

        // 既存のQRコードを保持しつつ、新しいデータで更新
        const updatedTablesWithDetails = updatedTables.map(table => {
          // 既存のテーブル情報を検索
          const existingTable = tables.find(t => t.table_id === table.table_id);
          const qrCode = existingTable?.qrCode || '';

          // セッション情報を取得
          const tableIdStr = String(table.table_id);
          const session = sessionMap.get(tableIdStr);

          // 経過時間の計算
          let elapsedTime = null;
          let formattedStartTime = null;
          let isPaused = false;

          if (session && session.charge_started_at) {
            const startTime = new Date(session.charge_started_at);

            // 一時停止中かどうかを確認
            isPaused = !!session.charge_paused_at;

            // 一時停止中の場合は、一時停止時間までの経過時間を計算
            const endTime = isPaused && session.charge_paused_at ? new Date(session.charge_paused_at) : now;

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
        });

        setTables(updatedTablesWithDetails);
      } catch (error) {
        console.error('データ取得エラー:', error);
      }
    };

    // Supabaseリアルタイムサブスクリプションのセットアップ
    console.log('Supabaseリアルタイムサブスクリプションを設定中...');

    // テーブルテーブルのサブスクリプション
    const unsubscribeTables = subscribeToTables(storeId, (payload) => {
      console.log('テーブルテーブル更新イベント:', payload);
      fetchLatestData();
    });

    // セッションテーブルのサブスクリプション
    const unsubscribeSessions = subscribeToSessions(storeId, (payload) => {
      console.log('セッションテーブル更新イベント:', payload);
      fetchLatestData();
    });

    // 初回データ取得
    fetchLatestData();

    // 定期的なポーリングの設定（30秒ごと）- バックアップとして
    const pollingInterval = setInterval(fetchLatestData, 30000);

    // 画面がフォーカスされたときにも更新
    const handleFocus = () => {
      console.log('画面がフォーカスされました。データを更新します。');
      fetchLatestData();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      unsubscribeTables();
      unsubscribeSessions();
      clearInterval(pollingInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [storeId, tables]);

  // 経過時間を更新
  useEffect(() => {
    // 現在時刻が変わるたびに経過時間を再計算
    const updatedTables = tables.map(table => {
      if (table.session && table.session.charge_started_at) {
        const startTime = new Date(table.session.charge_started_at);

        // 一時停止中かどうかを確認
        const isPaused = !!table.session.charge_paused_at;

        // 一時停止中の場合は、一時停止時間までの経過時間を計算
        const endTime = isPaused && table.session.charge_paused_at ? new Date(table.session.charge_paused_at) : now;

        const elapsedMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        const hours = Math.floor(elapsedMinutes / 60);
        const minutes = elapsedMinutes % 60;

        return {
          ...table,
          elapsedTime: {
            hours,
            minutes,
            totalMinutes: elapsedMinutes
          }
        };
      }
      return table;
    });

    setTables(updatedTables);
  }, [now]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">テーブル管理</h1>
        <Link
          href="/portal/tables/new"
          className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          新規テーブル作成
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tables.map((table) => (
          <div key={table.table_id} className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{table.name}</h2>
                <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                  {table.seat_types?.display_name || ''}
                </span>
              </div>

              <div className="mb-4 flex justify-center">
                <img
                  src={table.qrCode}
                  alt={`QR Code for ${table.name}`}
                  className="w-48 h-48"
                />
              </div>

              <div className="text-center mb-4">
                <p className="text-sm text-gray-500">
                  {table.seat_types?.price_per_unit || 0}円/
                  {table.seat_types?.time_unit_minutes || 30}分
                </p>
              </div>

              {/* 着席情報と経過時間 */}
              <div className="border-t border-gray-200 pt-4 mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">着席状況</h3>
                {table.elapsedTime ? (
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-gray-500">着席時間:</span>
                      <span className="text-xs font-medium">{table.formattedStartTime}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-gray-500">経過時間:</span>
                      <span className={`text-xs font-medium ${table.isPaused ? 'text-orange-600' : 'text-red-600'}`}>
                        {table.elapsedTime.hours}時間{table.elapsedTime.minutes}分
                        {table.isPaused && <span className="ml-1">(停止中)</span>}
                      </span>
                    </div>

                    {/* 課金停止/再開ボタン */}
                    {table.session && (
                      <div className="mt-2">
                        <ChargeControlButton
                          tableId={table.table_id}
                          sessionId={table.session.session_id}
                          isPaused={table.isPaused}
                        />
                      </div>
                    )}

                    {/* 席移動ボタン */}
                    {table.session && (
                      <div className="mt-2">
                        <TableMoveButton
                          tableId={table.table_id}
                          tableName={table.name}
                          sessionId={table.session.session_id}
                          availableTables={tables.map(t => ({
                            table_id: t.table_id,
                            name: t.name,
                            seat_types: t.seat_types
                          }))}
                        />
                      </div>
                    )}

                    {/* キャスト指名ボタン */}
                    {table.session && (
                      <div className="mt-2">
                        <CastNominationButton
                          tableId={table.table_id}
                          sessionId={table.session.session_id}
                          storeId={storeId}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 text-center italic">未着席</p>
                )}
              </div>

              <div className="flex justify-between">
                <a
                  href={table.qrCode}
                  download={`table-${table.name}-qr.png`}
                  className="bg-green-600 text-white py-1 px-3 rounded-md text-sm hover:bg-green-700"
                >
                  QRダウンロード
                </a>
                <Link
                  href={`/portal/tables/${table.table_id}/edit`}
                  className="bg-gray-600 text-white py-1 px-3 rounded-md text-sm hover:bg-gray-700"
                >
                  編集
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {tables.length === 0 && (
        <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
          テーブルがまだ登録されていません。「新規テーブル作成」から追加してください。
        </div>
      )}
    </div>
  );
}
