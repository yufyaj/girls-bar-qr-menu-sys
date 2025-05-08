import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient, createServerComponentClient } from '@/lib/supabase';
import { getUserRoleInStore } from '@/lib/auth';
import { DELETE } from '@/app/api/menu-categories/[category_id]/route';

// モック
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: vi.fn(),
  createServerComponentClient: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getUserRoleInStore: vi.fn(),
}));

describe('カテゴリ削除API', () => {
  const mockCookieStore = {
    get: vi.fn(),
  };

  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };

  const mockAuthClient = {
    auth: {
      getUser: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // cookiesのモック
    (cookies as any).mockReturnValue(mockCookieStore);
    mockCookieStore.get.mockReturnValue({ value: 'store-123' });
    
    // Supabaseクライアントのモック
    (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);
    (createServerComponentClient as any).mockResolvedValue(mockAuthClient);
    
    // 認証情報のモック
    mockAuthClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });
    
    // ユーザーロールのモック
    (getUserRoleInStore as any).mockResolvedValue('admin');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('カテゴリを削除し、表示順を更新する', async () => {
    // カテゴリ情報のモック
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        category_id: 'category-123',
        store_id: 'store-123',
        name: 'テストカテゴリ',
        display_order: 2,
      },
    });
    
    // メニュー数のモック（0件）
    mockSupabase.select.mockReturnValueOnce({
      count: 0,
      error: null,
    });
    
    // 削除のモック
    mockSupabase.delete.mockReturnValueOnce({
      error: null,
    });
    
    // 表示順更新のモック
    mockSupabase.update.mockReturnValueOnce({
      error: null,
    });

    // リクエストの作成
    const request = new NextRequest('http://localhost/api/menu-categories/category-123', {
      method: 'DELETE',
    });
    
    // パラメータの作成
    const params = Promise.resolve({ category_id: 'category-123' });
    
    // APIの実行
    const response = await DELETE(request, { params });
    const responseData = await response.json();
    
    // レスポンスの検証
    expect(response.status).toBe(200);
    expect(responseData).toEqual({ success: true });
    
    // カテゴリ情報の取得が呼ばれたことを確認
    expect(mockSupabase.from).toHaveBeenCalledWith('menu_categories');
    expect(mockSupabase.select).toHaveBeenCalledWith('*');
    expect(mockSupabase.eq).toHaveBeenCalledWith('category_id', 'category-123');
    
    // メニュー数の確認が呼ばれたことを確認
    expect(mockSupabase.from).toHaveBeenCalledWith('menus');
    
    // カテゴリの削除が呼ばれたことを確認
    expect(mockSupabase.from).toHaveBeenCalledWith('menu_categories');
    expect(mockSupabase.delete).toHaveBeenCalled();
    expect(mockSupabase.eq).toHaveBeenCalledWith('category_id', 'category-123');
    
    // 表示順の更新が呼ばれたことを確認
    expect(mockSupabase.from).toHaveBeenCalledWith('menu_categories');
    expect(mockSupabase.update).toHaveBeenCalled();
    expect(mockSupabase.eq).toHaveBeenCalledWith('store_id', 'store-123');
    expect(mockSupabase.gt).toHaveBeenCalledWith('display_order', 2);
  });

  it('メニューが存在する場合はカテゴリを削除できない', async () => {
    // カテゴリ情報のモック
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        category_id: 'category-123',
        store_id: 'store-123',
        name: 'テストカテゴリ',
        display_order: 2,
      },
    });
    
    // メニュー数のモック（1件以上）
    mockSupabase.select.mockReturnValueOnce({
      count: 1,
      error: null,
    });

    // リクエストの作成
    const request = new NextRequest('http://localhost/api/menu-categories/category-123', {
      method: 'DELETE',
    });
    
    // パラメータの作成
    const params = Promise.resolve({ category_id: 'category-123' });
    
    // APIの実行
    const response = await DELETE(request, { params });
    const responseData = await response.json();
    
    // レスポンスの検証
    expect(response.status).toBe(400);
    expect(responseData).toEqual({ error: 'このカテゴリに属するメニューが存在するため削除できません' });
    
    // 削除が呼ばれていないことを確認
    expect(mockSupabase.delete).not.toHaveBeenCalled();
    
    // 表示順の更新が呼ばれていないことを確認
    expect(mockSupabase.update).not.toHaveBeenCalled();
  });
});
