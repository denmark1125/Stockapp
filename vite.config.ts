
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // 讓 Vite 在建置時保留 process.env 存取能力，支援 Vercel 環境變數注入
    'process.env': 'process.env'
  },
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  resolve: {
    alias: {
      '@': path.resolve('.'),
    }
  },
  build: {
    // 確保建置時不會因為瑣碎警告而中斷
    chunkSizeWarningLimit: 1000,
  }
});
