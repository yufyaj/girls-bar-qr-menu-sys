import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient, createServerComponentClient } from '@/lib/supabase';
import { getUserRoleInStore } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
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

    // FormDataからファイルを取得
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'ファイルが見つかりません' },
        { status: 400 }
      );
    }

    // ファイルタイプの検証
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '許可されていないファイル形式です。JPEG、PNG、WebP、GIF形式のみ許可されています。' },
        { status: 400 }
      );
    }

    // ファイルサイズの検証（5MB以下）
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'ファイルサイズが大きすぎます。5MB以下のファイルを選択してください。' },
        { status: 400 }
      );
    }

    // ファイル名の生成（UUIDを使用して一意性を保証）
    const fileExtension = file.name.split('.').pop();
    const uuid = uuidv4();
    const fileName = `${storeId}/${uuid}.${fileExtension}`;

    // ファイルをArrayBufferに変換
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // バケットの存在確認
    const { data: buckets } = await supabase
      .storage
      .listBuckets();

    const bucketExists = buckets?.some(bucket => bucket.name === 'menu-images');

    // バケットが存在しない場合は作成
    if (!bucketExists) {
      console.log('バケットが存在しないため作成します: menu-images');
      const { error: createBucketError } = await supabase
        .storage
        .createBucket('menu-images', {
          public: true,
          fileSizeLimit: 5 * 1024 * 1024, // 5MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        });

      if (createBucketError) {
        console.error('バケット作成エラー:', createBucketError);
        return NextResponse.json(
          { error: `バケットの作成に失敗しました: ${createBucketError.message}` },
          { status: 500 }
        );
      }

      // 注意: RLSポリシーはサービスロールでも自動設定できないため、
      // Supabaseダッシュボードから手動で設定する必要があります
      console.log('バケットを作成しました。RLSポリシーはダッシュボードから設定してください。');
    }

    // Supabaseストレージにアップロード
    const { data, error } = await supabase
      .storage
      .from('menu-images')
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: true
      });

    if (error) {
      console.error('画像アップロードエラー:', error);
      return NextResponse.json(
        { error: `画像のアップロードに失敗しました: ${error.message}` },
        { status: 500 }
      );
    }

    // 公開URLを取得
    const { data: { publicUrl } } = supabase
      .storage
      .from('menu-images')
      .getPublicUrl(fileName);

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error('画像アップロードエラー:', error);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
