import { createServerSupabaseClient } from '../lib/supabase';
import * as dotenv from 'dotenv';

// .env.localファイルから環境変数を読み込む
dotenv.config({ path: '.env.local' });

async function main() {
  // 監査ログトリガーを一時的に無効化
  const disableAuditTriggers = async (supabase: any) => {
    console.log('Temporarily disabling audit triggers...');
    await supabase.rpc('disable_audit_triggers');
  };

  // 監査ログトリガーを再度有効化
  const enableAuditTriggers = async (supabase: any) => {
    console.log('Re-enabling audit triggers...');
    await supabase.rpc('enable_audit_triggers');
  };
  console.log('Starting seed process...');

  const supabase = await createServerSupabaseClient();

  try {
    // 監査ログトリガーを一時的に無効化
    try {
      await disableAuditTriggers(supabase);
    } catch (error) {
      console.warn('Failed to disable audit triggers. This might be expected if they are not set up yet:', error);
    }
    // 店舗の作成
    console.log('Creating store...');
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .insert({ store_code: 'GB001', name: 'GirlsBar One' })
      .select()
      .single();

    if (storeError) {
      throw storeError;
    }

    console.log('Store created:', store);

    // 管理者ユーザーの作成
    console.log('Creating admin user...');
    const { data: user, error: userError } = await supabase.auth.admin.createUser({
      email: 'test@test.com',
      password: 'testtest',
      email_confirm: true,
    });

    if (userError) {
      throw userError;
    }

    console.log('Admin user created:', user);

    // 店舗ユーザー関連付けの作成
    console.log('Creating store user association...');
    const { data: storeUser, error: storeUserError } = await supabase
      .from('store_users')
      .insert({
        store_id: store.store_id,
        user_id: user.user.id,
        role: 'admin'
      })
      .select()
      .single();

    if (storeUserError) {
      throw storeUserError;
    }

    console.log('Store user association created:', storeUser);

    // 席種の作成
    console.log('Creating seat types...');
    const seatTypes = [
      { code: 'COUNTER', display_name: 'カウンター席', price_per_unit: 1500 },
      { code: 'TABLE', display_name: 'テーブル席', price_per_unit: 2000 },
      { code: 'VIP', display_name: 'VIP席', price_per_unit: 3000 }
    ];

    const { data: createdSeatTypes, error: seatTypeError } = await supabase
      .from('seat_types')
      .insert(seatTypes)
      .select();

    if (seatTypeError) {
      throw seatTypeError;
    }

    console.log('Seat types created:', createdSeatTypes);

    // テーブルの作成
    console.log('Creating tables...');
    const tables = [
      { store_id: store.store_id, name: 'C1', seat_type_id: createdSeatTypes[0].seat_type_id },
      { store_id: store.store_id, name: 'C2', seat_type_id: createdSeatTypes[0].seat_type_id },
      { store_id: store.store_id, name: 'T1', seat_type_id: createdSeatTypes[1].seat_type_id },
      { store_id: store.store_id, name: 'V1', seat_type_id: createdSeatTypes[2].seat_type_id }
    ];

    const { data: createdTables, error: tableError } = await supabase
      .from('tables')
      .insert(tables)
      .select();

    if (tableError) {
      throw tableError;
    }

    console.log('Tables created:', createdTables);

    console.log('Seed completed successfully!');

  } catch (error) {
    console.error('Error during seed process:', error);
    process.exit(1);
  } finally {
    // 監査ログトリガーを再度有効化
    try {
      await enableAuditTriggers(supabase);
    } catch (error) {
      console.warn('Failed to re-enable audit triggers:', error);
    }
  }
}

main();
