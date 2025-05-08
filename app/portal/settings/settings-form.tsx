'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SettingsFormProps {
  storeId: string;
  enableCastManagement: boolean;
  enableSmaregiIntegration: boolean;
  smaregiClientId?: string;
  smaregiClientSecret?: string;
  smaregiContractId?: string;
}

export default function SettingsForm({
  storeId,
  enableCastManagement,
  enableSmaregiIntegration,
  smaregiClientId = '',
  smaregiClientSecret = '',
  smaregiContractId = '',
}: SettingsFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [settings, setSettings] = useState({
    enableCastManagement,
    enableSmaregiIntegration,
    smaregiClientId,
    smaregiClientSecret,
    smaregiContractId,
  });

  const handleToggle = (field: 'enableCastManagement' | 'enableSmaregiIntegration') => {
    setSettings({
      ...settings,
      [field]: !settings[field],
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings({
      ...settings,
      [name]: value,
    });
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

      const response = await fetch('/api/stores/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enable_cast_management: settings.enableCastManagement,
          enable_smaregi_integration: settings.enableSmaregiIntegration,
          smaregi_client_id: settings.smaregiClientId,
          smaregi_client_secret: settings.smaregiClientSecret,
          smaregi_contract_id: settings.smaregiContractId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '設定の更新に失敗しました');
      }

      setSuccess('店舗設定を更新しました');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '設定の更新に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900">スマレジ連携設定</h3>
          <p className="mt-1 text-sm text-gray-500">
            スマレジとの連携機能の有効/無効を設定します。
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="enableSmaregiIntegration"
                name="enableSmaregiIntegration"
                type="checkbox"
                checked={settings.enableSmaregiIntegration}
                onChange={() => handleToggle('enableSmaregiIntegration')}
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
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900">スマレジ連携設定</h3>
              <p className="mt-1 text-sm text-gray-500">
                スマレジAPIへの接続に必要な認証情報を入力してください。
              </p>

              <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
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
                      placeholder="スマレジ・デベロッパーズの契約ID"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pt-5">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {isLoading ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
