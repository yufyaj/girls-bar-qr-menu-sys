'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Category {
  category_id: string;
  name: string;
  display_order: number;
  smaregi_category_id?: string;
  allow_treat_cast: boolean;
}

interface CategoryListProps {
  categories: Category[];
  enableSmaregiIntegration: boolean;
}

export default function CategoryList({ categories: initialCategories, enableSmaregiIntegration }: CategoryListProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // カテゴリ作成
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/menu-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newCategoryName.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'カテゴリの作成に失敗しました');
      }

      const newCategory = await response.json();
      setCategories([...categories, newCategory]);
      setNewCategoryName('');
      setSuccess('カテゴリを作成しました');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'カテゴリの作成に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // カテゴリ更新
  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name.trim()) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/menu-categories/${editingCategory.category_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingCategory.name.trim(),
          display_order: editingCategory.display_order,
          allow_treat_cast: editingCategory.allow_treat_cast,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'カテゴリの更新に失敗しました');
      }

      const updatedCategory = await response.json();
      setCategories(
        categories.map((cat) =>
          cat.category_id === updatedCategory.category_id ? updatedCategory : cat
        )
      );
      setEditingCategory(null);
      setSuccess('カテゴリを更新しました');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'カテゴリの更新に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // カテゴリ削除
  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('このカテゴリを削除してもよろしいですか？')) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/menu-categories/${categoryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'カテゴリの削除に失敗しました');
      }

      // 削除後に最新のカテゴリ一覧を取得
      const refreshResponse = await fetch('/api/menu-categories');
      if (refreshResponse.ok) {
        const updatedCategories = await refreshResponse.json();
        // 最新のカテゴリ一覧で状態を更新
        setCategories(updatedCategories);
      } else {
        // APIからの取得に失敗した場合は、クライアント側で削除だけ反映
        setCategories(categories.filter((cat) => cat.category_id !== categoryId));
      }

      setSuccess('カテゴリを削除しました');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'カテゴリの削除に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 表示順の変更
  const handleMoveCategory = async (categoryId: string, direction: 'up' | 'down') => {
    const currentIndex = categories.findIndex((cat) => cat.category_id === categoryId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= categories.length) return;

    const newCategories = [...categories];
    const currentCategory = { ...newCategories[currentIndex] };
    const targetCategory = { ...newCategories[newIndex] };

    // 表示順を入れ替え
    const tempOrder = currentCategory.display_order;
    currentCategory.display_order = targetCategory.display_order;
    targetCategory.display_order = tempOrder;

    newCategories[currentIndex] = currentCategory;
    newCategories[newIndex] = targetCategory;

    setIsLoading(true);
    setError(null);

    try {
      // 現在のカテゴリの表示順を更新
      const response1 = await fetch(`/api/menu-categories/${currentCategory.category_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: currentCategory.name,
          display_order: currentCategory.display_order,
          allow_treat_cast: currentCategory.allow_treat_cast,
        }),
      });

      if (!response1.ok) {
        const data = await response1.json();
        throw new Error(data.error || 'カテゴリの更新に失敗しました');
      }

      // 入れ替え先のカテゴリの表示順を更新
      const response2 = await fetch(`/api/menu-categories/${targetCategory.category_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: targetCategory.name,
          display_order: targetCategory.display_order,
          allow_treat_cast: targetCategory.allow_treat_cast,
        }),
      });

      if (!response2.ok) {
        const data = await response2.json();
        throw new Error(data.error || 'カテゴリの更新に失敗しました');
      }

      // 表示順でソート
      setCategories([...newCategories].sort((a, b) => a.display_order - b.display_order));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'カテゴリの更新に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">カテゴリ一覧</h2>

        {error && (
          <div className="mb-4 p-4 text-sm text-red-700 bg-red-100 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 text-sm text-green-700 bg-green-100 rounded-lg">
            {success}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  表示順
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  カテゴリ名
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  スマレジID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  キャストに奢れる
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    カテゴリがありません
                  </td>
                </tr>
              ) : (
                categories.map((category, index) => (
                  <tr key={category.category_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center space-x-2">
                        <span>{category.display_order}</span>
                        <div className="flex flex-col">
                          <button
                            onClick={() => handleMoveCategory(category.category_id, 'up')}
                            disabled={index === 0 || isLoading}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => handleMoveCategory(category.category_id, 'down')}
                            disabled={index === categories.length - 1 || isLoading}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {editingCategory?.category_id === category.category_id ? (
                        <input
                          type="text"
                          value={editingCategory.name}
                          onChange={(e) =>
                            setEditingCategory({ ...editingCategory, name: e.target.value })
                          }
                          className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      ) : (
                        category.name
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {category.smaregi_category_id || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingCategory?.category_id === category.category_id ? (
                        <input
                          type="checkbox"
                          checked={editingCategory.allow_treat_cast}
                          onChange={(e) =>
                            setEditingCategory({ ...editingCategory, allow_treat_cast: e.target.checked })
                          }
                          className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                        />
                      ) : (
                        <span className={category.allow_treat_cast ? "text-green-600" : "text-red-600"}>
                          {category.allow_treat_cast ? "可能" : "不可"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {editingCategory?.category_id === category.category_id ? (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={handleUpdateCategory}
                            disabled={isLoading}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingCategory(null)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => setEditingCategory(category)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category.category_id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            削除
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!enableSmaregiIntegration && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">新規カテゴリ作成</h2>
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                カテゴリ名
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  required
                />
              </div>
            </div>
            <div>
              <button
                type="submit"
                disabled={isLoading || !newCategoryName.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? '作成中...' : '作成'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
