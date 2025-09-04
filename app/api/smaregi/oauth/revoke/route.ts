import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@/lib/supabase';
import { getUserRoleInStore } from '@/lib/auth';
import { revokeSmaregiOAuth } from '@/lib/smaregi-oauth';

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const storeId = cookieStore.get('store-id')?.value;

    if (!storeId) {
      return NextResponse.json(
        { error: '店舗情報が見つかりません' },
        { status: 401 }
      );
    }

    // 認証用クライアント（Cookieベース）
    const authClient = await createServerComponentClient();

    // ユーザー情報を取得
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: '認証されていません' },
        { status: 401 }
      );
    }

    // ユーザーの役割を取得
    const userRole = await getUserRoleInStore(user.id, storeId);

    // 管理者でなければエラー
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    // OAuth認証を解除
    await revokeSmaregiOAuth(storeId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('OAuth認証解除エラー:', error);
    return NextResponse.json(
      { error: '認証解除に失敗しました' },
      { status: 500 }
    );
  }
}
