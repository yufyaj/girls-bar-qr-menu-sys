import { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

// ミドルウェアを適用するパスを指定
export const config = {
  matcher: ['/portal/:path*'],
};
