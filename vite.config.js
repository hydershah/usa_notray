import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic'
    })
  ],
  publicDir: './client/public',
  build: {
    outDir: './client/dist',
    rollupOptions: {
      external: [
        // Server-side dependencies that should not be bundled in client
        'canvas',
        'sharp',
        'lightningcss',
        '@babel/preset-typescript',
        'bcrypt',
        'nodemailer',
        'speakeasy',
        'qrcode',
        'drizzle-orm',
        'postgres',
        'node-fetch',
        'multer',
        'express',
        'passport',
        'jsonwebtoken',
        'fsevents',
        'crypto',
        'fs',
        'path',
        'util',
        'stream',
        'buffer',
        'os',
        'child_process',
        'net',
        'tls',
        'http',
        'https',
        'events',
        'url',
        'querystring',
        'zlib'
      ],
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
      '@shared/schema': path.resolve(__dirname, './shared/types.ts'),
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
      },
      '/ws': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        secure: false
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
      },
      '/ws': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        secure: false
      }
    },
  },
  optimizeDeps: {
    include: ['socket.io-client', 'pdfjs-dist'],
    exclude: [
      'pdfjs-dist/build/pdf.worker.min.mjs', 
      'pdfjs-dist/build/pdf.worker.mjs',
      // Exclude server-side dependencies from optimization
      'canvas',
      'sharp',
      'lightningcss',
      '@babel/preset-typescript',
      'bcrypt',
      'nodemailer',
      'speakeasy',
      'qrcode',
      'drizzle-orm',
      'postgres',
      'node-fetch',
      'multer',
      'express',
      'passport',
      'jsonwebtoken',
      'fsevents'
    ],
    force: true, // Force optimization to ensure consistency
    esbuildOptions: {
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts'
      }
    }
  },
  define: {
    global: 'globalThis',
  },
}) 