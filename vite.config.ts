
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 關鍵：告訴 Vite 允許讀取 NEXT_PUBLIC_ 開頭的環境變數，配合 Vercel/Next.js 標準
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  resolve: {
    alias: {
      // Fix: Use path.resolve('.') to resolve the current working directory without type errors on the 'process' object.
      '@': path.resolve('.'),
    }
  },
});
