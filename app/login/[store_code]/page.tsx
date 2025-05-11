import { getStoreByCode } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LoginForm from './login-form';

// ページコンポーネント
export default async function LoginPage({ params }: { params: Promise<{ store_code: string }> }) {
  const { store_code } = await params;

  // 店舗コードから店舗情報を取得
  const store = await getStoreByCode(store_code);

  // 店舗が見つからない場合はホームページにリダイレクト
  if (!store) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {store.name}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          スタッフログイン
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <LoginForm
          storeCode={store_code}
          storeName={store.name}
        />
      </div>
    </div>
  );
}
