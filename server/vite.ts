import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { type Server } from "http";
import { nanoid } from "nanoid";

// Get current directory in a way that works for both ESM and CommonJS
function getCurrentDir() {
  // Check if we're in CommonJS environment
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  
  // ESM environment - but only if import.meta.url exists
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    return path.dirname(fileURLToPath(import.meta.url));
  }
  
  // Fallback to process.cwd() if neither works
  return process.cwd();
}

const currentDir = getCurrentDir();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  try {
    // Dynamically import vite only when needed
    const { createServer: createViteServer, createLogger } = await import("vite");
    
    const viteLogger = createLogger();
    
    const serverOptions = {
      middlewareMode: true,
      hmr: { server },
      allowedHosts: true as const,
    };

    const vite = await createViteServer({
      root: path.resolve(currentDir, "client"),
      plugins: [
        (await import("@vitejs/plugin-react")).default({
          jsxRuntime: 'automatic'
        })
      ],
      resolve: {
        alias: {
          "@": path.resolve(currentDir, "client", "src"),
          "@shared": path.resolve(currentDir, "shared"),
        },
      },
      optimizeDeps: {
        include: ['socket.io-client'],
      },
      configFile: false,
      customLogger: {
        ...viteLogger,
        error: (msg, options) => {
          viteLogger.error(msg, options);
          process.exit(1);
        },
      },
      server: serverOptions,
      appType: "custom",
    });

    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;

      try {
        const clientTemplate = path.resolve(
          currentDir,
          "client",
          "index.html",
        );

        // always reload the index.html file from disk incase it changes
        let template = await fs.promises.readFile(clientTemplate, "utf-8");
        template = template.replace(
          `src="/src/main.tsx"`,
          `src="/src/main.tsx?v=${nanoid()}"`,
        );
        const page = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(page);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
    
    console.log('✅ Vite development server setup complete');
  } catch (error) {
    console.warn('⚠️ Vite not available, falling back to static serving');
    console.warn('Please run "npm run dev:client" separately for development');
    
    // Fallback to serving static files if they exist
    serveStatic(app);
  }
}

export function serveStatic(app: Express) {
  // In production, when running from dist/index.cjs, we need to handle paths differently
  let distPath: string;
  
  if (process.env.NODE_ENV === 'production') {
    // In production, the server is run from project root with "node dist/index.cjs"
    // So we need dist/public from the project root
    distPath = path.resolve(process.cwd(), "dist", "public");
  } else {
    // In development, client files are in client/dist
    distPath = path.resolve(process.cwd(), "client", "dist");
  }

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  console.log(`📁 Serving static files from: ${distPath}`);

  // Enhanced static file serving with proper headers
  app.use(express.static(distPath, {
    maxAge: '1y', // Cache static assets for 1 year
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      // Set appropriate headers for different file types
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else if (path.endsWith('.js') || path.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'application/javascript');
        // Special handling for PDF worker files
        if (path.includes('pdf.worker')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        }
      } else if (path.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      } else if (path.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
      }
    }
  }));

  // Special handling for PDF worker files - serve from root for easier access
  const workerPaths = ['pdf.worker.min.js', 'pdf.worker.js', 'pdf.worker.min.mjs', 'pdf.worker.mjs'];
  workerPaths.forEach(workerFile => {
    app.get(`/${workerFile}`, (req, res) => {
      const workerPath = path.join(distPath, workerFile);
      if (fs.existsSync(workerPath)) {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.sendFile(workerPath);
      } else {
        console.warn(`⚠️ PDF worker file not found: ${workerPath}`);
        res.status(404).send('PDF worker file not found');
      }
    });
  });

  // Health check for static serving
  app.get('/static-health', (req, res) => {
    res.json({ 
      status: 'ok', 
      staticPath: distPath,
      exists: fs.existsSync(distPath),
      files: fs.existsSync(distPath) ? fs.readdirSync(distPath).slice(0, 10) : []
    });
  });

  // fall through to index.html if the file doesn't exist
  app.use("*", (req, res, next) => {
    // Skip API routes
    if (req.originalUrl.startsWith('/api/') || req.originalUrl.startsWith('/health')) {
      return next();
    }
    
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      console.error(`❌ index.html not found at: ${indexPath}`);
      res.status(404).send('Application not found. Please ensure the client has been built.');
    }
  });

  console.log('✅ Static file serving configured successfully');
}