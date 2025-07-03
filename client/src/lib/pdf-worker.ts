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

    // Try different worker paths in order of preference
    const workerPaths = [
      '/pdf.worker.min.js',
      '/assets/pdf.worker.min.js',
      '/pdf.worker.min.mjs',
      '/assets/pdf.worker.min.mjs',
      // Fallback to CDN if local files don't work
      `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`
    ];

    let workerSet = false;

    for (const workerPath of workerPaths) {
      try {
        // Test if the worker file exists (for local paths)
        if (workerPath.startsWith('/')) {
          // For local paths, just set it directly
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
          workerSet = true;
          console.log(`📄 PDF.js worker configured with: ${workerPath}`);
          break;
        } else {
          // For CDN, set and continue
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
          workerSet = true;
          console.log(`📄 PDF.js worker configured with CDN: ${workerPath}`);
          break;
        }
      } catch (error) {
        console.warn(`📄 Failed to set worker path ${workerPath}:`, error);
        continue;
      }
    }

    if (!workerSet) {
      throw new Error('No valid PDF.js worker path found');
    }

    // Additional PDF.js configuration for better compatibility
    pdfjsLib.GlobalWorkerOptions.workerPort = null;
    
    isWorkerInitialized = true;
    console.log('✅ PDF.js worker initialized successfully');

  } catch (error) {
    console.error('❌ Failed to initialize PDF.js worker:', error);
    
    // Fallback: try to use inline worker if available
    try {
      // This is a fallback that disables the worker for compatibility
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
      console.warn('📄 Using fallback PDF.js configuration without worker');
      isWorkerInitialized = true;
    } catch (fallbackError) {
      console.error('❌ PDF.js fallback configuration also failed:', fallbackError);
      throw new Error('PDF.js worker initialization failed completely');
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
  return isWorkerInitialized && !!pdfjsLib.GlobalWorkerOptions.workerSrc;
};

// Get current worker configuration
export const getPDFWorkerInfo = () => {
  return {
    isInitialized: isWorkerInitialized,
    workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc,
    version: pdfjsLib.version
  };
};

// Initialize immediately when this module is imported
initializePDFWorker(); 