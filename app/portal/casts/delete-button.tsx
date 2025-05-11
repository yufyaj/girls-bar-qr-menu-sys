'use client';

import { useState } from 'react';

interface DeleteButtonProps {
  castId: string;
}

export default function DeleteButton({ castId }: DeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    // 削除確認ダイアログ
    if (!confirm('このキャストを削除しますか？')) {
      return;
    }

    try {
      setIsDeleting(true);
      // 削除処理
      const response = await fetch(`/api/casts/${castId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'キャストの削除に失敗しました');
        return;
      }
      
      alert('キャストを削除しました');
      window.location.reload();
    } catch (error) {
      console.error('キャスト削除エラー:', error);
      alert('キャストの削除に失敗しました');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      type="button"
      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200"
      onClick={handleDelete}
      disabled={isDeleting}
    >
      {isDeleting ? '削除中...' : '削除'}
    </button>
  );
}
