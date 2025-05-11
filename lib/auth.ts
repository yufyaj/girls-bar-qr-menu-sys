import { createServerSupabaseClient, createServerComponentClient } from './supabase';

export type UserRole = 'admin' | 'cast';

export interface StoreUser {
  id: string;
  store_id: string;
  user_id: string;
  role: UserRole;
}

export interface Store {
  store_id: string;
  store_code: string;
  name: string;
}

// ユーザーが特定の店舗に所属しているか確認
export async function isUserMemberOfStore(userId: string, storeId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();

  console.log('isUserMemberOfStore called with:', { userId, storeId });

  const { data, error } = await supabase
    .from('store_users')
    .select('id')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .single();

  if (error) {
    console.error('Error checking store membership:', error);
    console.error('Error details:', error);

    // 全てのstore_usersを取得して確認
    const { data: allStoreUsers, error: allError } = await supabase
      .from('store_users')
      .select('*');

    if (!allError) {
      console.log('All store_users:', allStoreUsers);
    } else {
      console.error('Error fetching all store_users:', allError);
    }

    return false;
  }

  console.log('Store membership data:', data);
  return !!data;
}

// ユーザーの店舗での役割を取得
export async function getUserRoleInStore(userId: string, storeId: string): Promise<UserRole | null> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('store_users')
    .select('role')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .single();

  if (error || !data) {
    console.error('Error getting user role:', error);
    return null;
  }

  return data.role as UserRole;
}

// 店舗コードから店舗情報を取得
export async function getStoreByCode(storeCode: string): Promise<Store | null> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('store_code', storeCode)
    .single();

  if (error || !data) {
    console.error('Error getting store by code:', error);
    return null;
  }

  return data as Store;
}
