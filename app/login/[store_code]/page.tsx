import { getStoreByCode } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LoginForm from './login-form';

// ログインアクション
async function loginAction(formData: FormData) {
  'use server';

  try {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const storeCode = formData.get('store_code') as string;

    if (!email || !password || !storeCode) {
      return { error: 'メールアドレス、パスワード、店舗コードは必須です' };
    }

    // APIを使用してログイン処理を実行
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        storeCode,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Login error details:', result.error);
      return { error: result.error || 'ログインに失敗しました' };
    }

    console.log('Login successful');

    // ダッシュボードにリダイレクト
    return { success: true as const, redirectTo: '/portal/dashboard' };
  } catch (error) {
    console.error('Login error:', error);
    return { error: 'ログイン処理中にエラーが発生しました' };
  }
}

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
          loginAction={loginAction}
        />
      </div>
    </div>
  );
}
