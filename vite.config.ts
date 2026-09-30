import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'  // 需要安装 @types/node

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    hmr: { overlay: true }
  }
})