import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react({
    jsxRuntime: 'automatic'
  })],
  build: {
    outDir: 'dist/public', // ✅ matches your Express static path
    emptyOutDir: true
  },
  publicDir: 'client/public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@shared/schema': path.resolve(__dirname, './shared/schema.ts'),
    },
  },
  server: {
    port: 3002,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      }
    },
  },
  optimizeDeps: {
    include: ['socket.io-client'],
  },
  define: {
    global: 'globalThis',
  },
});
