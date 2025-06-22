import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SettingsForm from './settings-form';

export default async function StoreSettingsPage() {
  const cookieStore = await cookies();
  const storeId = cookieStore.get('store-id')?.value;

  if (!storeId) {
    redirect('/login');
  }

  // 店舗情報を取得
  const storeResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/stores/${storeId}`, {
    cache: 'no-store'
  });

  if (!storeResponse.ok) {
    console.error('店舗情報の取得に失敗しました:', await storeResponse.text());
    return <div>店舗情報の取得に失敗しました</div>;
  }

  const store = await storeResponse.json();

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">店舗設定</h1>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <SettingsForm
              storeId={store.store_id}
              enableSmaregiIntegration={store.enable_smaregi_integration}
              smaregiClientId={store.smaregi_client_id || ''}
              smaregiClientSecret={store.smaregi_client_secret || ''}
              smaregiContractId={store.smaregi_contract_id || ''}
              taxRate={store.tax_rate || 10.0}
              openTime={store.open_time || '18:00'}
              closeTime={store.close_time || '02:00'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
