
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 讓 Vite 將 process.env 注入到全域變數，解決 tsc 編譯及執行時期的 process 未定義問題
  define: {
    'process.env': {}
  },
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  resolve: {
    alias: {
      '@': path.resolve('.'),
    }
  },
});
