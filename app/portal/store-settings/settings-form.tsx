'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface SettingsFormProps {
  storeId: string;
  enableSmaregiIntegration: boolean;
  smaregiClientId?: string;
  smaregiClientSecret?: string;
  smaregiContractId?: string;
  taxRate?: number;
  openTime?: string;
  closeTime?: string;
}

interface OAuthStatus {
  isAuthenticated: boolean;
  expiresAt?: string;
  scope?: string;
}

export default function SettingsForm({
  storeId,
  enableSmaregiIntegration,
  smaregiClientId = '',
  smaregiClientSecret = '',
  smaregiContractId = '',
  taxRate = 10.0,
  openTime = '18:00',
  closeTime = '02:00',
}: SettingsFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [oauthStatus, setOAuthStatus] = useState<OAuthStatus>({ isAuthenticated: false });
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);

  const [settings, setSettings] = useState({
    enableSmaregiIntegration,
    smaregiClientId,
    smaregiClientSecret,
    smaregiContractId,
    taxRate,
    openTime,
    closeTime,
  });

  // OAuth認証状態を取得
  const fetchOAuthStatus = async () => {
    try {
      const response = await fetch('/api/smaregi/oauth/status');
      if (response.ok) {
        const status = await response.json();
        setOAuthStatus(status);
      }
    } catch (error) {
      console.error('OAuth認証状態取得エラー:', error);
    }
  };

  // OAuth認証を開始
  const handleOAuthLogin = async () => {
    setIsOAuthLoading(true);
    try {
      window.location.href = '/api/smaregi/oauth/authorize';
    } catch (error) {
      console.error('OAuth認証開始エラー:', error);
      setError('OAuth認証の開始に失敗しました');
      setIsOAuthLoading(false);
    }
  };

  // OAuth認証を解除
  const handleOAuthRevoke = async () => {
    if (!confirm('スマレジとの連携を解除しますか？')) {
      return;
    }

    setIsOAuthLoading(true);
    try {
      const response = await fetch('/api/smaregi/oauth/revoke', {
        method: 'DELETE',
      });

      if (response.ok) {
        setOAuthStatus({ isAuthenticated: false });
        setSuccess('スマレジとの連携を解除しました');
      } else {
        const errorData = await response.json();
        setError(errorData.error || '連携解除に失敗しました');
      }
    } catch (error) {
      console.error('OAuth認証解除エラー:', error);
      setError('連携解除に失敗しました');
    } finally {
      setIsOAuthLoading(false);
    }
  };

  // 初回読み込み時とURLパラメータ変更時の処理
  useEffect(() => {
    // OAuth認証状態を取得
    if (enableSmaregiIntegration) {
      fetchOAuthStatus();
    }

    // URLパラメータからOAuth結果を確認
    const oauthSuccess = searchParams.get('oauth_success');
    const oauthError = searchParams.get('oauth_error');

    if (oauthSuccess) {
      setSuccess('スマレジとの連携が完了しました');
      fetchOAuthStatus();
      // URLパラメータをクリア
      router.replace('/portal/store-settings');
    } else if (oauthError) {
      setError(decodeURIComponent(oauthError));
      // URLパラメータをクリア
      router.replace('/portal/store-settings');
    }
  }, [enableSmaregiIntegration, searchParams, router]);

  const handleToggle = () => {
    setSettings({
      ...settings,
      enableSmaregiIntegration: !settings.enableSmaregiIntegration,
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // 数値フィールドの場合は数値に変換
    if (name === 'taxRate') {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        setSettings({
          ...settings,
          [name]: numValue,
        });
      }
    } else {
      setSettings({
        ...settings,
        [name]: value,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // スマレジ連携が有効な場合、クライアントID、シークレット、契約IDが必要
      if (settings.enableSmaregiIntegration &&
          (!settings.smaregiClientId || !settings.smaregiClientSecret || !settings.smaregiContractId)) {
        setError('スマレジ連携を有効にする場合は、クライアントID、シークレット、契約IDが必要です');
        setIsLoading(false);
        return;
      }

      // 消費税率のバリデーション
      if (settings.taxRate < 0 || settings.taxRate > 100) {
        setError('消費税率は0〜100の範囲で入力してください');
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/stores/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enable_smaregi_integration: settings.enableSmaregiIntegration,
          smaregi_client_id: settings.smaregiClientId,
          smaregi_client_secret: settings.smaregiClientSecret,
          smaregi_contract_id: settings.smaregiContractId,
          tax_rate: settings.taxRate,
          open_time: settings.openTime,
          close_time: settings.closeTime,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '設定の更新に失敗しました');
      }

      setSuccess('設定が正常に更新されました');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">エラー</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">{success}</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-medium text-gray-900">基本設定</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="taxRate" className="block text-sm font-medium text-gray-700">
              消費税率 (%)
            </label>
            <div className="mt-1 relative rounded-md shadow-sm w-32">
              <input
                type="number"
                name="taxRate"
                id="taxRate"
                min="0"
                max="100"
                step="0.1"
                value={settings.taxRate}
                onChange={handleInputChange}
                className="focus:ring-blue-500 focus:border-blue-500 block w-full pr-8 sm:text-sm border-gray-300 rounded-md"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">%</span>
              </div>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              会計時に適用される消費税率を設定します。
            </p>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-gray-200 mt-6">
        <h2 className="text-lg font-medium text-gray-900">営業時間設定</h2>
        <p className="mt-1 text-sm text-gray-500">
          店舗の営業時間を設定します。深夜営業の場合は翌日の時間を設定してください（例：18:00〜02:00）。
        </p>
        <div className="mt-4 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <label htmlFor="openTime" className="block text-sm font-medium text-gray-700">
              開店時間
            </label>
            <div className="mt-1">
              <input
                type="time"
                name="openTime"
                id="openTime"
                value={settings.openTime}
                onChange={handleInputChange}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="closeTime" className="block text-sm font-medium text-gray-700">
              閉店時間
            </label>
            <div className="mt-1">
              <input
                type="time"
                name="closeTime"
                id="closeTime"
                value={settings.closeTime}
                onChange={handleInputChange}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-gray-200 mt-6">
        <h2 className="text-lg font-medium text-gray-900">スマレジ連携設定</h2>
        <div className="mt-4 space-y-4">
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="enableSmaregiIntegration"
                name="enableSmaregiIntegration"
                type="checkbox"
                checked={settings.enableSmaregiIntegration}
                onChange={handleToggle}
                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="enableSmaregiIntegration" className="font-medium text-gray-700">
                スマレジ連携
              </label>
              <p className="text-gray-500">
                スマレジとの連携機能を有効にします。無効にすると、スマレジへの会計データ送信が行われなくなります。
              </p>
            </div>
          </div>

          {settings.enableSmaregiIntegration && (
            <div className="mt-6 pl-7">
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label htmlFor="smaregiClientId" className="block text-sm font-medium text-gray-700">
                    クライアントID
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="smaregiClientId"
                      id="smaregiClientId"
                      value={settings.smaregiClientId}
                      onChange={handleInputChange}
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="スマレジから提供されたクライアントID"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="smaregiClientSecret" className="block text-sm font-medium text-gray-700">
                    クライアントシークレット
                  </label>
                  <div className="mt-1">
                    <input
                      type="password"
                      name="smaregiClientSecret"
                      id="smaregiClientSecret"
                      value={settings.smaregiClientSecret}
                      onChange={handleInputChange}
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="スマレジから提供されたシークレット"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="smaregiContractId" className="block text-sm font-medium text-gray-700">
                    契約ID
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="smaregiContractId"
                      id="smaregiContractId"
                      value={settings.smaregiContractId}
                      onChange={handleInputChange}
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="スマレジの契約ID"
                    />
                  </div>
                </div>
              </div>

              {/* OAuth認証セクション */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">OAuth認証</h3>
                <p className="mt-1 text-sm text-gray-500">
                  スマレジとの安全な連携のため、OAuth認証を行ってください。
                </p>
                
                <div className="mt-4">
                  {oauthStatus.isAuthenticated ? (
                    <div className="bg-green-50 border border-green-200 rounded-md p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-green-800">認証済み</h3>
                          <div className="mt-2 text-sm text-green-700">
                            <p>スマレジとの連携が有効です。</p>
                            {oauthStatus.expiresAt && (
                              <p className="mt-1">
                                有効期限: {new Date(oauthStatus.expiresAt).toLocaleString('ja-JP')}
                              </p>
                            )}
                            {oauthStatus.scope && (
                              <p className="mt-1">
                                スコープ: {oauthStatus.scope}
                              </p>
                            )}
                          </div>
                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={handleOAuthRevoke}
                              disabled={isOAuthLoading}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                            >
                              {isOAuthLoading ? '処理中...' : '連携を解除'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-yellow-800">未認証</h3>
                          <div className="mt-2 text-sm text-yellow-700">
                            <p>スマレジとの連携を行うには、OAuth認証が必要です。</p>
                            <p className="mt-1">上記のクライアント情報を保存してから認証を行ってください。</p>
                          </div>
                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={handleOAuthLogin}
                              disabled={isOAuthLoading || !settings.smaregiClientId || !settings.smaregiClientSecret || !settings.smaregiContractId}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isOAuthLoading ? '認証中...' : 'スマレジと連携する'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-5">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => router.back()}
            className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            {isLoading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </form>
  );
}
