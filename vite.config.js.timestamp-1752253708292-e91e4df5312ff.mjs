// vite.config.js
import { defineConfig } from "file:///E:/USA-Notary/usa_notray/node_modules/vite/dist/node/index.js";
import react from "file:///E:/USA-Notary/usa_notray/node_modules/@vitejs/plugin-react/dist/index.mjs";
import path from "path";
var __vite_injected_original_dirname = "E:\\USA-Notary\\usa_notray";
var vite_config_default = defineConfig({
  plugins: [
    react({
      jsxRuntime: "automatic"
    })
  ],
  publicDir: "./client/public",
  build: {
    outDir: "./client/dist",
    rollupOptions: {
      output: {
        // Ensure PDF.js worker is treated as a separate chunk
        manualChunks: {
          "pdf-worker": ["pdfjs-dist"]
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./client/src"),
      "@shared": path.resolve(__vite_injected_original_dirname, "./shared"),
      "@shared/schema": path.resolve(__vite_injected_original_dirname, "./shared/schema.ts")
    }
  },
  server: {
    port: 3002,
    strictPort: true,
    hmr: {
      port: 3002,
      host: "localhost"
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on("proxyReq", (proxyReq, req, res) => {
            if (req.headers.authorization) {
              proxyReq.setHeader("Authorization", req.headers.authorization);
            }
            if (req.headers.cookie) {
              proxyReq.setHeader("Cookie", req.headers.cookie);
            }
            if (req.headers["content-type"]) {
              proxyReq.setHeader("Content-Type", req.headers["content-type"]);
            }
          });
        }
      }
    }
  },
  preview: {
    port: 3002,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on("proxyReq", (proxyReq, req, res) => {
            if (req.headers.authorization) {
              proxyReq.setHeader("Authorization", req.headers.authorization);
            }
            if (req.headers.cookie) {
              proxyReq.setHeader("Cookie", req.headers.cookie);
            }
            if (req.headers["content-type"]) {
              proxyReq.setHeader("Content-Type", req.headers["content-type"]);
            }
          });
        }
      }
    }
  },
  optimizeDeps: {
    include: ["socket.io-client", "pdfjs-dist"],
    exclude: ["pdfjs-dist/build/pdf.worker.min.mjs", "pdfjs-dist/build/pdf.worker.mjs"],
    force: true,
    // Force optimization to ensure consistency
    esbuildOptions: {
      loader: {
        ".tsx": "tsx",
        ".ts": "ts"
      }
    }
  },
  define: {
    global: "globalThis"
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFxVU0EtTm90YXJ5XFxcXHVzYV9ub3RyYXlcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkU6XFxcXFVTQS1Ob3RhcnlcXFxcdXNhX25vdHJheVxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRTovVVNBLU5vdGFyeS91c2Ffbm90cmF5L3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCh7XHJcbiAgICAgIGpzeFJ1bnRpbWU6ICdhdXRvbWF0aWMnXHJcbiAgICB9KVxyXG4gIF0sXHJcbiAgcHVibGljRGlyOiAnLi9jbGllbnQvcHVibGljJyxcclxuICBidWlsZDoge1xyXG4gICAgb3V0RGlyOiAnLi9jbGllbnQvZGlzdCcsXHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIC8vIEVuc3VyZSBQREYuanMgd29ya2VyIGlzIHRyZWF0ZWQgYXMgYSBzZXBhcmF0ZSBjaHVua1xyXG4gICAgICAgIG1hbnVhbENodW5rczoge1xyXG4gICAgICAgICAgJ3BkZi13b3JrZXInOiBbJ3BkZmpzLWRpc3QnXVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0sXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9jbGllbnQvc3JjJyksXHJcbiAgICAgICdAc2hhcmVkJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc2hhcmVkJyksXHJcbiAgICAgICdAc2hhcmVkL3NjaGVtYSc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NoYXJlZC9zY2hlbWEudHMnKSxcclxuICAgIH0sXHJcbiAgfSxcclxuICBzZXJ2ZXI6IHtcclxuICAgIHBvcnQ6IDMwMDIsXHJcbiAgICBzdHJpY3RQb3J0OiB0cnVlLFxyXG4gICAgaG1yOiB7XHJcbiAgICAgIHBvcnQ6IDMwMDIsXHJcbiAgICAgIGhvc3Q6ICdsb2NhbGhvc3QnXHJcbiAgICB9LFxyXG4gICAgcHJveHk6IHtcclxuICAgICAgJy9hcGknOiB7XHJcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDozMDAwJyxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgd3M6IHRydWUsXHJcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcclxuICAgICAgICBjb25maWd1cmU6IChwcm94eSwgb3B0aW9ucykgPT4ge1xyXG4gICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVxJywgKHByb3h5UmVxLCByZXEsIHJlcykgPT4ge1xyXG4gICAgICAgICAgICAvLyBGb3J3YXJkIGFsbCBvcmlnaW5hbCBoZWFkZXJzIGluY2x1ZGluZyBBdXRob3JpemF0aW9uXHJcbiAgICAgICAgICAgIGlmIChyZXEuaGVhZGVycy5hdXRob3JpemF0aW9uKSB7XHJcbiAgICAgICAgICAgICAgcHJveHlSZXEuc2V0SGVhZGVyKCdBdXRob3JpemF0aW9uJywgcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHJlcS5oZWFkZXJzLmNvb2tpZSkge1xyXG4gICAgICAgICAgICAgIHByb3h5UmVxLnNldEhlYWRlcignQ29va2llJywgcmVxLmhlYWRlcnMuY29va2llKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBFbnN1cmUgcHJvcGVyIGNvbnRlbnQgdHlwZSBmb3IgSlNPTiByZXF1ZXN0c1xyXG4gICAgICAgICAgICBpZiAocmVxLmhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddKSB7XHJcbiAgICAgICAgICAgICAgcHJveHlSZXEuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCByZXEuaGVhZGVyc1snY29udGVudC10eXBlJ10pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0sXHJcbiAgfSxcclxuICBwcmV2aWV3OiB7XHJcbiAgICBwb3J0OiAzMDAyLFxyXG4gICAgaG9zdDogJzAuMC4wLjAnLFxyXG4gICAgcHJveHk6IHtcclxuICAgICAgJy9hcGknOiB7XHJcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDozMDAwJyxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgd3M6IHRydWUsXHJcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcclxuICAgICAgICBjb25maWd1cmU6IChwcm94eSwgb3B0aW9ucykgPT4ge1xyXG4gICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVxJywgKHByb3h5UmVxLCByZXEsIHJlcykgPT4ge1xyXG4gICAgICAgICAgICAvLyBGb3J3YXJkIGFsbCBvcmlnaW5hbCBoZWFkZXJzIGluY2x1ZGluZyBBdXRob3JpemF0aW9uXHJcbiAgICAgICAgICAgIGlmIChyZXEuaGVhZGVycy5hdXRob3JpemF0aW9uKSB7XHJcbiAgICAgICAgICAgICAgcHJveHlSZXEuc2V0SGVhZGVyKCdBdXRob3JpemF0aW9uJywgcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHJlcS5oZWFkZXJzLmNvb2tpZSkge1xyXG4gICAgICAgICAgICAgIHByb3h5UmVxLnNldEhlYWRlcignQ29va2llJywgcmVxLmhlYWRlcnMuY29va2llKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBFbnN1cmUgcHJvcGVyIGNvbnRlbnQgdHlwZSBmb3IgSlNPTiByZXF1ZXN0c1xyXG4gICAgICAgICAgICBpZiAocmVxLmhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddKSB7XHJcbiAgICAgICAgICAgICAgcHJveHlSZXEuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCByZXEuaGVhZGVyc1snY29udGVudC10eXBlJ10pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0sXHJcbiAgfSxcclxuICBvcHRpbWl6ZURlcHM6IHtcclxuICAgIGluY2x1ZGU6IFsnc29ja2V0LmlvLWNsaWVudCcsICdwZGZqcy1kaXN0J10sXHJcbiAgICBleGNsdWRlOiBbJ3BkZmpzLWRpc3QvYnVpbGQvcGRmLndvcmtlci5taW4ubWpzJywgJ3BkZmpzLWRpc3QvYnVpbGQvcGRmLndvcmtlci5tanMnXSxcclxuICAgIGZvcmNlOiB0cnVlLCAvLyBGb3JjZSBvcHRpbWl6YXRpb24gdG8gZW5zdXJlIGNvbnNpc3RlbmN5XHJcbiAgICBlc2J1aWxkT3B0aW9uczoge1xyXG4gICAgICBsb2FkZXI6IHtcclxuICAgICAgICAnLnRzeCc6ICd0c3gnLFxyXG4gICAgICAgICcudHMnOiAndHMnXHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9LFxyXG4gIGRlZmluZToge1xyXG4gICAgZ2xvYmFsOiAnZ2xvYmFsVGhpcycsXHJcbiAgfSxcclxufSkgIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFnUSxTQUFTLG9CQUFvQjtBQUM3UixPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBRmpCLElBQU0sbUNBQW1DO0FBSXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxN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
