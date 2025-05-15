'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';

interface Category {
  category_id: string;
  name: string;
  display_order: number;
}

interface MenuFormProps {
  storeId: string;
  menuId?: string;
  initialData?: {
    product_id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    category: string | null;
    category_id: string | null;
    is_available: boolean;
  };
  isEdit?: boolean;
}

export default function MenuForm({
  storeId,
  menuId,
  initialData,
  isEdit = false,
}: MenuFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 画像ファイルを保持するための状態
  const [selectedImage, setSelectedImage] = useState<{
    file: File | null;
    previewUrl: string | null;
    resizedBlob: Blob | null;
    fileName: string | null;
  }>({
    file: null,
    previewUrl: null,
    resizedBlob: null,
    fileName: null
  });

  const [formData, setFormData] = useState({
    product_id: initialData?.product_id || '',
    name: initialData?.name || '',
    description: initialData?.description || '',
    price: initialData?.price || 0,
    image_url: initialData?.image_url || '',
    category_id: initialData?.category_id || '',
    is_available: initialData?.is_available !== false, // デフォルトはtrue
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData({
        ...formData,
        [name]: checked,
      });
    } else if (type === 'number') {
      setFormData({
        ...formData,
        [name]: parseInt(value, 10) || 0,
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  // 画像をリサイズする関数
  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      // 画像をロード
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);

      img.onload = () => {
        // 元の画像サイズを取得
        const originalWidth = img.width;
        const originalHeight = img.height;

        // リサイズ後のサイズを計算
        let newWidth = originalWidth;
        let newHeight = originalHeight;

        // 画像が指定サイズより大きい場合はリサイズ
        if (originalWidth > maxWidth || originalHeight > maxHeight) {
          const aspectRatio = originalWidth / originalHeight;

          if (aspectRatio > 1) {
            // 横長の画像
            newWidth = maxWidth;
            newHeight = maxWidth / aspectRatio;

            // 高さが最大値を超える場合は高さを基準にする
            if (newHeight > maxHeight) {
              newHeight = maxHeight;
              newWidth = maxHeight * aspectRatio;
            }
          } else {
            // 縦長の画像
            newHeight = maxHeight;
            newWidth = maxHeight * aspectRatio;

            // 幅が最大値を超える場合は幅を基準にする
            if (newWidth > maxWidth) {
              newWidth = maxWidth;
              newHeight = maxWidth / aspectRatio;
            }
          }
        }

        // Canvasを使用して画像をリサイズ
        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context not available'));
          return;
        }

        // 画像を描画
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        // Blobに変換
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // 使用済みのオブジェクトURLを解放
              URL.revokeObjectURL(img.src);
              resolve(blob);
            } else {
              reject(new Error('Failed to convert canvas to blob'));
            }
          },
          file.type, // 元の画像と同じ形式を維持
          0.9 // 品質（JPEG/WebPの場合）
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Failed to load image'));
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイルタイプの検証
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('許可されていないファイル形式です。JPEG、PNG、WebP、GIF形式のみ許可されています。');
      return;
    }

    // ファイルサイズの検証（5MB以下）
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setUploadError('ファイルサイズが大きすぎます。5MB以下のファイルを選択してください。');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // 画像をリサイズ（最大幅800px、最大高さ800px）
      const resizedBlob = await resizeImage(file, 800, 800);

      // UUIDベースのファイル名を生成
      const fileExtension = file.name.split('.').pop() || '';
      const uuid = uuidv4();
      const resizedFileName = `${uuid}.${fileExtension}`;

      // プレビュー用のURL生成
      const previewUrl = URL.createObjectURL(resizedBlob);

      // 選択した画像情報を保存
      setSelectedImage({
        file,
        previewUrl,
        resizedBlob,
        fileName: resizedFileName
      });

      // 既存の画像URLをクリア（新しい画像を選択した場合）
      if (formData.image_url) {
        setFormData(prev => ({
          ...prev,
          image_url: '',
        }));
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '画像の処理に失敗しました');
    } finally {
      setIsUploading(false);
    }
  };

  // カテゴリ一覧を取得
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const response = await fetch(`/api/menu-categories?storeId=${storeId}`);
        if (!response.ok) {
          throw new Error('カテゴリの取得に失敗しました');
        }
        const data = await response.json();
        setCategories(data);
      } catch (err) {
        console.error('カテゴリ取得エラー:', err);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchCategories();
  }, [storeId]);

  // コンポーネントのアンマウント時にプレビューURLを解放
  useEffect(() => {
    return () => {
      if (selectedImage.previewUrl) {
        URL.revokeObjectURL(selectedImage.previewUrl);
      }
    };
  }, [selectedImage.previewUrl]);

  // 画像をアップロードする関数
  const uploadImage = async (): Promise<string | null> => {
    if (!selectedImage.resizedBlob || !selectedImage.fileName) {
      return null; // 画像が選択されていない場合はnullを返す
    }

    try {
      // リサイズした画像をFileオブジェクトに変換
      const resizedFile = new File(
        [selectedImage.resizedBlob],
        selectedImage.fileName,
        { type: selectedImage.file?.type || 'image/jpeg' }
      );

      // FormDataを作成してアップロード
      const formData = new FormData();
      formData.append('file', resizedFile);

      const response = await fetch('/api/upload/menu-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '画像のアップロードに失敗しました');
      }

      const data = await response.json();
      return data.url;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : '画像のアップロードに失敗しました');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 新しい画像が選択されている場合はアップロード
      let imageUrl = formData.image_url;
      if (selectedImage.resizedBlob) {
        setIsUploading(true);
        const uploadedImageUrl = await uploadImage();
        imageUrl = uploadedImageUrl || ''; // nullの場合は空文字列を使用
        setIsUploading(false);
      }

      // 更新するデータを準備
      const updatedData = {
        ...formData,
        image_url: imageUrl || formData.image_url,
        store_id: storeId,
      };

      if (isEdit && menuId) {
        // メニュー情報の更新
        const response = await fetch(`/api/menus/${menuId}?storeId=${storeId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedData),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'メニュー情報の更新に失敗しました');
        }

        setSuccess('メニュー情報を更新しました');
      } else {
        // 新規メニューの追加
        const response = await fetch(`/api/menus?storeId=${storeId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedData),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'メニューの追加に失敗しました');
        }

        setSuccess('メニューを追加しました');
        // フォームをリセット（新規追加の場合のみ）
        if (!isEdit) {
          setFormData({
            product_id: '',
            name: '',
            description: '',
            price: 0,
            image_url: '',
            category_id: '',
            is_available: true,
          });

          // 画像選択状態もリセット
          setSelectedImage({
            file: null,
            previewUrl: null,
            resizedBlob: null,
            fileName: null
          });
        }
      }

      // 成功メッセージを表示した後、一覧画面に戻る
      setTimeout(() => {
        router.push('/portal/menus');
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!menuId || !confirm('このメニューを削除しますか？')) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/menus/${menuId}?storeId=${storeId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'メニューの削除に失敗しました');
      }

      setSuccess('メニューを削除しました');

      // 成功メッセージを表示した後、一覧画面に戻る
      setTimeout(() => {
        router.push('/portal/menus');
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
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

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="product_id" className="block text-sm font-medium text-gray-700">
              商品ID
            </label>
            <div className="mt-1">
              <input
                type="text"
                name="product_id"
                id="product_id"
                value={formData.product_id}
                onChange={handleChange}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                required
                disabled={isEdit} // 編集時はIDを変更できないように
              />
            </div>
            {isEdit && (
              <p className="mt-1 text-xs text-gray-500">
                商品IDは編集できません
              </p>
            )}
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              商品名
            </label>
            <div className="mt-1">
              <input
                type="text"
                name="name"
                id="name"
                value={formData.name}
                onChange={handleChange}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                required
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              商品説明
            </label>
            <div className="mt-1">
              <textarea
                name="description"
                id="description"
                rows={3}
                value={formData.description || ''}
                onChange={handleChange}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700">
              価格（円）
            </label>
            <div className="mt-1">
              <input
                type="number"
                name="price"
                id="price"
                min="0"
                value={formData.price}
                onChange={handleChange}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="category_id" className="block text-sm font-medium text-gray-700">
              カテゴリー
            </label>
            <div className="mt-1">
              <select
                name="category_id"
                id="category_id"
                value={formData.category_id || ''}
                onChange={handleChange}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
              >
                <option value="">カテゴリーを選択</option>
                {categories.map((category) => (
                  <option key={category.category_id} value={category.category_id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              <a href="/portal/menu-categories" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                カテゴリーを管理する
              </a>
            </div>
          </div>

          <div>
            <label htmlFor="image_upload" className="block text-sm font-medium text-gray-700">
              画像アップロード
            </label>
            <div className="mt-1 flex items-center space-x-2">
              <input
                type="file"
                id="image_upload"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={isUploading}
              >
                {isUploading ? '画像アップロード中...' : '画像を選択'}
              </button>
              {uploadError && (
                <p className="text-sm text-red-600">{uploadError}</p>
              )}
            </div>
            {/* 画像URLは非表示のフィールドとして保持 */}
            <input
              type="hidden"
              name="image_url"
              id="image_url"
              value={formData.image_url || ''}
            />
          </div>

          <div>
            {selectedImage.previewUrl ? (
              <div className="mt-2">
                <p className="block text-sm font-medium text-gray-700 mb-2">画像プレビュー（未保存）</p>
                <div className="w-32 h-32 relative">
                  <Image
                    src={selectedImage.previewUrl}
                    alt="商品画像プレビュー"
                    fill
                    sizes="128px"
                    className="object-cover rounded"
                    unoptimized
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // プレビューURLを解放
                    if (selectedImage.previewUrl) {
                      URL.revokeObjectURL(selectedImage.previewUrl);
                    }
                    // 画像選択状態をリセット
                    setSelectedImage({
                      file: null,
                      previewUrl: null,
                      resizedBlob: null,
                      fileName: null
                    });
                  }}
                  className="mt-2 text-xs text-red-600 hover:text-red-800"
                >
                  画像を削除
                </button>
              </div>
            ) : formData.image_url ? (
              <div className="mt-2">
                <p className="block text-sm font-medium text-gray-700 mb-2">画像プレビュー（保存済み）</p>
                <div className="w-32 h-32 relative">
                  <Image
                    src={formData.image_url}
                    alt="商品画像プレビュー"
                    fill
                    sizes="128px"
                    className="object-cover rounded"
                    unoptimized
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                  className="mt-2 text-xs text-red-600 hover:text-red-800"
                >
                  画像を削除
                </button>
              </div>
            ) : (
              <div className="mt-2">
                <p className="block text-sm font-medium text-gray-700 mb-2">画像プレビュー</p>
                <div className="w-32 h-32 bg-gray-200 rounded flex items-center justify-center">
                  <span className="text-gray-400 text-sm">画像なし</span>
                </div>
              </div>
            )}
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="is_available"
                  name="is_available"
                  type="checkbox"
                  checked={formData.is_available}
                  onChange={handleChange}
                  className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="is_available" className="ml-2 block text-sm text-gray-700">
                  提供可能
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <div>
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
              {isLoading ? '処理中...' : isEdit ? '更新' : '追加'}
            </button>
          </div>

          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isLoading}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-red-300"
            >
              削除
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
