import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient, createServerComponentClient } from '@/lib/supabase';
import { getUserRoleInStore } from '@/lib/auth';

export async function PATCH(request: NextRequest) {
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

    // データベース操作用クライアント
    const supabase = await createServerSupabaseClient();

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

    const data = await request.json();

    // バリデーション
    if (typeof data.enable_smaregi_integration !== 'boolean') {
      return NextResponse.json(
        { error: '無効なデータ形式です' },
        { status: 400 }
      );
    }

    // 消費税率のバリデーション
    if (data.tax_rate !== undefined) {
      const taxRate = parseFloat(data.tax_rate);
      if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
        return NextResponse.json(
          { error: '消費税率は0〜100の範囲で入力してください' },
          { status: 400 }
        );
      }
    }

    // スマレジ連携キーのバリデーション
    if (data.enable_smaregi_integration) {
      // スマレジ連携が有効な場合、クライアントID、シークレット、契約IDが必要
      if (!data.smaregi_client_id || !data.smaregi_client_secret || !data.smaregi_contract_id) {
        return NextResponse.json(
          { error: 'スマレジ連携を有効にする場合は、クライアントID、シークレット、契約IDが必要です' },
          { status: 400 }
        );
      }
    }

    // 更新データの準備
    const updateData: any = {
      enable_smaregi_integration: data.enable_smaregi_integration
    };

    // 消費税率が指定されている場合は更新
    if (data.tax_rate !== undefined) {
      updateData.tax_rate = parseFloat(data.tax_rate);
    }

    // スマレジ連携が有効な場合、キー情報も更新
    if (data.enable_smaregi_integration) {
      updateData.smaregi_client_id = data.smaregi_client_id;
      updateData.smaregi_client_secret = data.smaregi_client_secret;
      updateData.smaregi_contract_id = data.smaregi_contract_id;
    }

    // 店舗設定を更新
    const { error: updateError } = await supabase
      .from('stores')
      .update(updateData)
      .eq('store_id', storeId);

    if (updateError) {
      console.error('店舗設定更新エラー:', updateError);
      return NextResponse.json(
        { error: '店舗設定の更新に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('店舗設定更新エラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
