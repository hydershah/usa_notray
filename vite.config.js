import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import fs from 'fs'

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic'
    }),
    // Only copy PDF.js worker files if they don't already exist in public
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
          dest: '',
          rename: 'pdf.worker.min.js',
          transform: (contents) => contents // This ensures the file is read properly
        },
        {
          src: 'node_modules/pdfjs-dist/build/pdf.worker.mjs', 
          dest: '',
          rename: 'pdf.worker.js',
          transform: (contents) => contents
        }
      ].filter(target => {
        // Check if target already exists in public to avoid unnecessary copies
        const destPath = path.join(__dirname, 'client/public', target.rename || path.basename(target.src));
        return !fs.existsSync(destPath);
      })
    })
  ],
  publicDir: './client/public',
  build: {
    outDir: './client/dist',
    rollupOptions: {
      output: {
        // Ensure PDF.js worker is treated as a separate chunk
        manualChunks: {
          'pdf-worker': ['pdfjs-dist']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@shared/schema': path.resolve(__dirname, './shared/schema.ts'),
    },
  },
  server: {
    port: 3002,
    strictPort: true,
    hmr: {
      port: 3002,
      host: 'localhost'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Forward all original headers including Authorization
            if (req.headers.authorization) {
              proxyReq.setHeader('Authorization', req.headers.authorization);
            }
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
            // Ensure proper content type for JSON requests
            if (req.headers['content-type']) {
              proxyReq.setHeader('Content-Type', req.headers['content-type']);
            }
          });
        }
      }
    },
  },
  preview: {
    port: 3002,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Forward all original headers including Authorization
            if (req.headers.authorization) {
              proxyReq.setHeader('Authorization', req.headers.authorization);
            }
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
            // Ensure proper content type for JSON requests
            if (req.headers['content-type']) {
              proxyReq.setHeader('Content-Type', req.headers['content-type']);
            }
          });
        }
      }
    },
  },
  optimizeDeps: {
    include: ['socket.io-client', 'pdfjs-dist'],
    exclude: ['pdfjs-dist/build/pdf.worker.min.mjs', 'pdfjs-dist/build/pdf.worker.mjs'],
    force: true // Force optimization to ensure consistency
  },
  define: {
    global: 'globalThis',
  },
}) 