import { createClient } from '@supabase/supabase-js';

// 共通の設定
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// クライアント側で使用するSupabaseクライアント（リアルタイム機能用）
export const createRealtimeClient = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase URL or Anon Key is missing');
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: {
      params: {
        eventsPerSecond: 5,
      },
    },
  });
};

// リアルタイムチャンネルの種類
export enum RealtimeChannel {
  ORDERS = 'orders',
  SESSIONS = 'sessions',
  TABLES = 'tables',
}

// リアルタイムイベントの種類
export enum RealtimeEvent {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

// リアルタイムサブスクリプションのオプション
export interface SubscriptionOptions {
  event?: RealtimeEvent | '*';
  filter?: string;
  table: string;
  callback: (payload: any) => void;
}

// リアルタイムサブスクリプションを作成する関数
export const subscribeToTable = (
  table: string,
  options: SubscriptionOptions,
  storeId?: string
) => {
  const supabase = createRealtimeClient();
  
  // チャンネル名を生成（ストアIDがある場合は含める）
  const channelName = storeId 
    ? `realtime:${storeId}:${table}` 
    : `realtime:${table}`;
  
  // オプションにテーブル名を設定
  const subscriptionOptions = {
    ...options,
    table
  };
  
  // チャンネルを作成
  const channel = supabase
    .channel(channelName)
    .on(
      // @ts-ignore - Supabase clientのバージョン不一致による型エラーを無視
      'postgres_changes',
      {
        event: subscriptionOptions.event || '*',
        schema: 'public',
        table,
        filter: subscriptionOptions.filter || undefined
      },
      (payload: any) => subscriptionOptions.callback(payload)
    )
    .subscribe();
  
  // チャンネルの解除関数を返す
  return () => {
    supabase.removeChannel(channel);
  };
};

// 注文テーブルのサブスクリプション
export const subscribeToOrders = (
  storeId: string,
  callback: (payload: any) => void
) => {
  return subscribeToTable(
    'orders',
    {
      event: '*',
      filter: `store_id=eq.${storeId}`,
      callback,
      table: 'orders'
    },
    storeId
  );
};

// 注文アイテムテーブルのサブスクリプション
export const subscribeToOrderItems = (
  storeId: string,
  callback: (payload: any) => void
) => {
  return subscribeToTable(
    'order_items',
    {
      event: '*',
      callback,
      table: 'order_items'
    },
    storeId
  );
};

// セッションテーブルのサブスクリプション
export const subscribeToSessions = (
  storeId: string,
  callback: (payload: any) => void
) => {
  return subscribeToTable(
    'sessions',
    {
      event: '*',
      filter: `store_id=eq.${storeId}`,
      callback,
      table: 'sessions'
    },
    storeId
  );
};

// テーブルテーブルのサブスクリプション
export const subscribeToTables = (
  storeId: string,
  callback: (payload: any) => void
) => {
  return subscribeToTable(
    'tables',
    {
      event: '*',
      filter: `store_id=eq.${storeId}`,
      table: 'tables',
      callback: (payload: any) => {
        // デバウンス処理を追加して短時間に複数のイベントが発生した場合に対応
        if (typeof window !== 'undefined') {
          if (window._tableUpdateTimeout) {
            clearTimeout(window._tableUpdateTimeout);
          }
          window._tableUpdateTimeout = setTimeout(() => {
            callback(payload);
          }, 300); // 300msのデバウンス
        } else {
          // サーバーサイドの場合はそのまま実行
          callback(payload);
        }
      },
    },
    storeId
  );
};

// TypeScriptの型定義拡張（window._tableUpdateTimeoutのため）
declare global {
  interface Window {
    _tableUpdateTimeout: NodeJS.Timeout | undefined;
  }
}

// 初期化
if (typeof window !== 'undefined') {
  window._tableUpdateTimeout = undefined;
}
