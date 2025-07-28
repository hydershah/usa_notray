import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic'
    }),
    nodePolyfills(),
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
        // Add retry logic for server startup delays
        timeout: 10000, // 10 second timeout
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
          
          // Suppress ECONNREFUSED errors during startup
          proxy.on('error', (err, req, res) => {
            if (err.code === 'ECONNREFUSED') {
              // Server not ready yet - return 503 Service Unavailable instead of crashing
              if (!res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                  error: 'Server starting up, please wait...', 
                  code: 'SERVER_STARTING' 
                }));
              }
            } else {
              console.error('Proxy error:', err);
            }
          });
        }
      },
      '/ws': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        secure: false,
        timeout: 10000
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        secure: false,
        timeout: 10000,
        // Suppress WebSocket connection errors during startup
        configure: (proxy, options) => {
          proxy.on('error', (err) => {
            if (err.code !== 'ECONNREFUSED') {
              console.error('Socket.IO proxy error:', err);
            }
          });
        }
      },
      '/video-signaling': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        secure: false,
        timeout: 10000,
        // Suppress WebSocket connection errors during startup  
        configure: (proxy, options) => {
          proxy.on('error', (err) => {
            if (err.code !== 'ECONNREFUSED') {
              console.error('Video signaling proxy error:', err);
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
        timeout: 10000, // Add timeout for preview mode too
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
          
          // Suppress ECONNREFUSED errors during startup
          proxy.on('error', (err, req, res) => {
            if (err.code === 'ECONNREFUSED') {
              if (!res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                  error: 'Server starting up, please wait...', 
                  code: 'SERVER_STARTING' 
                }));
              }
            } else {
              console.error('Preview proxy error:', err);
            }
          });
        }
      },
      '/ws': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        secure: false,
        timeout: 10000
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        secure: false,
        timeout: 10000
      },
      '/video-signaling': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        secure: false,
        timeout: 10000
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