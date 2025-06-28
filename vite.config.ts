import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    // Only load runtime error overlay in Replit environment
    ...(process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-runtime-error-modal").then((m) =>
            m.default(),
          ),
        ]
      : []),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  define: {
    global: 'globalThis',
    // Define process and process.env for the browser
    'process.env': JSON.stringify(process.env),
    'process.platform': JSON.stringify(process.platform),
    'process.version': JSON.stringify(process.version),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
      // Add process polyfill
      process: "process/browser",
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  publicDir: 'client/public',
  optimizeDeps: {
    include: ['pdfjs-dist', 'process'],
    exclude: ['pdfjs-dist/build/pdf.worker.min.mjs'],
    esbuildOptions: {
      target: 'esnext',
      define: {
        global: 'globalThis'
      }
    }
  }
});
