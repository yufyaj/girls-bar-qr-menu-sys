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
        eventsPerSecond: 10,
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
  
  // チャンネルを作成
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: options.event || '*',
        schema: 'public',
        table: table,
        filter: options.filter || undefined,
      },
      (payload) => {
        options.callback(payload);
      }
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
      callback,
    },
    storeId
  );
};
