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
      external: ['fs', 'path', 'crypto'],
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      // Browser polyfills for Node.js modules
      'events': 'events',
      'stream': 'stream-browserify',
      'util': 'util',
      'buffer': 'buffer',
      'process': 'process/browser'
    }
  },
  define: {
    global: 'globalThis',
    'process.env': {}
  },
  optimizeDeps: {
    include: ['events', 'buffer', 'process']
  }
}) 