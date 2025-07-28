import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  root: 'client',
  build: {
    outDir: '../server/dist/public',
    emptyOutDir: true,
    rollupOptions: {
      external: ['fs', 'path', 'crypto']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      events: 'rollup-plugin-node-polyfills/polyfills/events',
      stream: 'rollup-plugin-node-polyfills/polyfills/stream',
      util: 'rollup-plugin-node-polyfills/polyfills/util',
      buffer: 'rollup-plugin-node-polyfills/polyfills/buffer-es6'
    }
  },
  define: {
    global: 'globalThis',
    'process.env': {}
  }
}) 