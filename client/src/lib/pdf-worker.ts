import * as pdfjsLib from 'pdfjs-dist';

// PDF.js Worker Configuration
// This ensures the worker is properly initialized only once
let isWorkerInitialized = false;

export const initializePDFWorker = () => {
  if (isWorkerInitialized) {
    console.log('📄 PDF.js worker already initialized');
    return;
  }

  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      console.warn('📄 PDF.js worker initialization skipped - not in browser environment');
      return;
    }

    // For production deployment, use CDN worker first for reliability
    const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    
    if (isProduction) {
      // Production: Use CDN worker for reliability
      const cdnWorkerUrl = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      pdfjsLib.GlobalWorkerOptions.workerSrc = cdnWorkerUrl;
      console.log(`📄 Production: PDF.js worker configured with CDN: ${cdnWorkerUrl}`);
    } else {
      // Development: Try local files first, then fallback to CDN
      const localWorkerPaths = [
        '/pdf.worker.min.js',
        '/pdf.worker.js',
        '/pdf.worker.min.mjs',
        '/pdf.worker.mjs',
        '/client/public/pdf.worker.min.js',
        '/assets/pdf.worker.min.js'
      ];

      let workerSet = false;
      for (const workerPath of localWorkerPaths) {
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
          workerSet = true;
          console.log(`📄 Development: PDF.js worker configured with: ${workerPath}`);
          break;
        } catch (error) {
          console.warn(`📄 Failed to set worker path ${workerPath}:`, error);
          continue;
        }
      }

      // Fallback to CDN for development if local files fail
      if (!workerSet) {
        const cdnWorkerUrl = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        pdfjsLib.GlobalWorkerOptions.workerSrc = cdnWorkerUrl;
        console.log(`📄 Development fallback: PDF.js worker configured with CDN: ${cdnWorkerUrl}`);
      }
    }

    // Additional PDF.js configuration for better compatibility
    pdfjsLib.GlobalWorkerOptions.workerPort = null;
    
    // Set additional options for production stability
    if (isProduction) {
      // Additional production-specific configurations can be added here
      // Note: isEvalSupported is no longer available in PDF.js 5.4.149
    }
    
    isWorkerInitialized = true;
    console.log('✅ PDF.js worker initialized successfully for', isProduction ? 'production' : 'development');

  } catch (error) {
    console.error('❌ Failed to initialize PDF.js worker:', error);
    
    // Enhanced fallback: try to use inline worker with matching version
    try {
      // Use a more reliable CDN fallback with matching version
      const fallbackWorkerUrl = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      pdfjsLib.GlobalWorkerOptions.workerSrc = fallbackWorkerUrl;
      console.warn(`📄 Using enhanced fallback PDF.js worker from unpkg: ${fallbackWorkerUrl}`);
      isWorkerInitialized = true;
    } catch (fallbackError) {
      console.error('❌ PDF.js enhanced fallback also failed:', fallbackError);
      // Last resort: disable worker (will be slower but should work)
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
      console.warn('📄 PDF.js worker disabled - using main thread (slower performance)');
      isWorkerInitialized = true;
    }
  }
};

// Reset function for development/testing
export const resetPDFWorker = () => {
  isWorkerInitialized = false;
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  console.log('🔄 PDF.js worker reset');
};

// Check if worker is properly initialized
export const isPDFWorkerReady = (): boolean => {
  return isWorkerInitialized;
};

// Get current worker configuration
export const getPDFWorkerInfo = () => {
  return {
    isInitialized: isWorkerInitialized,
    workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc,
    version: pdfjsLib.version,
    isProduction: typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
  };
};

// Initialize immediately when this module is imported
initializePDFWorker(); 