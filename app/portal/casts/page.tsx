import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import DeleteButton from './delete-button';
import { createServerSupabaseClient } from '@/lib/supabase';

// キャストユーザーの型定義
interface StoreUser {
  id: string;
  user_id: string;
  display_name?: string;
  email?: string;
}

export default async function CastsPage() {
  const cookieStore = await cookies();
  const storeId = cookieStore.get('store-id')?.value;

  if (!storeId) {
    return <div>店舗情報が見つかりません</div>;
  }

  // 現在のリクエストのCookieをすべて取得して転送
  const allCookies = cookieStore.getAll();
  const cookieHeader = allCookies
    .map(cookie => `${cookie.name}=${cookie.value}`)
    .join('; ');



  // APIからユーザー情報を取得
  const userResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/auth/user?storeId=${storeId}`, {
    cache: 'no-store',
    headers: {
      'Cookie': cookieHeader
    }
  });

  if (!userResponse.ok) {
    redirect('/');
  }

  const { user } = await userResponse.json();

  // 管理者でなければダッシュボードにリダイレクト
  if (user.role !== 'admin') {
    redirect('/portal/dashboard');
  }

  // 店舗情報をAPIから取得
  const storeResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/stores/${storeId}`, {
    cache: 'no-store'
  });

  if (!storeResponse.ok) {
    console.error('店舗情報の取得に失敗しました:', await storeResponse.text());
    return <div>店舗情報が見つかりません</div>;
  }

  const store = await storeResponse.json();

  // キャスト管理が無効の場合はダッシュボードにリダイレクト
  if (!store.enable_cast_management) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  キャスト管理機能は現在無効になっています。
                  <Link href="/portal/settings" className="font-medium underline text-yellow-700 hover:text-yellow-600">
                    設定画面
                  </Link>
                  から有効にしてください。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // キャスト一覧をAPIから取得
  const castsResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/casts?storeId=${storeId}`, {
    cache: 'no-store'
  });

  let storeUsers: StoreUser[] = [];
  let storeUsersError = null;
  if (castsResponse.ok) {
    storeUsers = await castsResponse.json();
  } else {
    storeUsersError = await castsResponse.text();
    console.error('キャスト一覧の取得に失敗しました:', storeUsersError);
  }

  // キャスト情報が取得できた場合、各キャストのメールアドレスを取得
  if (storeUsers && storeUsers.length > 0) {
    // ユーザーIDの配列を作成
    const userIds = storeUsers.map((user: StoreUser) => user.user_id);

    // Supabaseクライアントを作成
    const supabase = await createServerSupabaseClient();

    // auth.usersテーブルから対応するメールアドレスを取得
    // Supabaseでは、authスキーマのテーブルにアクセスする場合は特別な方法が必要
    const { data: authUsers, error: authUsersError } = await supabase.auth.admin.listUsers();

    // 全ユーザーから必要なユーザーだけをフィルタリング
    // Supabaseの型定義に合わせる
    const filteredAuthUsers = authUsers?.users.filter((user) => {
      return userIds.includes(user.id);
    });



    // メールアドレス情報をキャスト情報に追加
    if (filteredAuthUsers && filteredAuthUsers.length > 0) {
      // ユーザーIDをキーとしたメールアドレスのマップを作成
      interface EmailMap {
        [key: string]: string;
      }

      const emailMap: EmailMap = {};

      // 手動でマップを作成
      filteredAuthUsers.forEach((user) => {
        if (user.id && user.email) {
          emailMap[user.id] = user.email;
        }
      });

      // キャスト情報にメールアドレスを追加
      storeUsers.forEach((user: StoreUser) => {
        if (user.user_id && emailMap[user.user_id]) {
          user.email = emailMap[user.user_id];
        } else {
          user.email = '';
        }
      });
    }
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">キャスト管理</h1>
          <Link
            href="/portal/casts/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            キャストを追加
          </Link>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {storeUsers && storeUsers.length > 0 ? (
              storeUsers.map((storeUser: StoreUser) => (
                <li key={storeUser.id}>
                  <div className="px-4 py-4 flex items-center justify-between sm:px-6">
                    <div>
                      <p className="text-sm font-medium text-blue-600 truncate">{storeUser.display_name || '名前なし'}</p>
                      <p className="mt-1 text-sm text-gray-500">{storeUser.email || ''}</p>
                    </div>
                    <div className="flex space-x-2">
                      <Link
                        href={`/portal/casts/${storeUser.id}/edit`}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                      >
                        編集
                      </Link>
                      <DeleteButton castId={storeUser.id} />
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li className="px-4 py-6 text-center text-gray-500">
                キャストが登録されていません
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
