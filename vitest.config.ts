import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  // @ts-ignore - Vitestとプラグインの型定義不一致を無視
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});
