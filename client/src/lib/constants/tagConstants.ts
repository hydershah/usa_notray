import type { TagType } from '@/types/editor';

// Professional color palette for the application - DocuSign Style
export const PROFESSIONAL_COLORS = {
  // Background colors
  background: '#ffffff',
  backgroundHover: '#f8fafc',
  backgroundActive: '#f1f5f9',
  
  // Border colors - DocuSign style
  border: '#e2e8f0',
  borderHover: '#cbd5e1',
  borderActive: '#3b82f6',
  borderCompleted: '#3b82f6',
  
  // Text colors
  text: '#1e293b',
  textSecondary: '#64748b',
  textPlaceholder: '#94a3b8',
  textMuted: '#cbd5e1',
  
  // Status colors
  completed: '#f0f9ff',
  success: '#3b82f6',
  warning: '#f59e0b',
  error: '#ef4444',
  
  // Interactive colors
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  accent: '#1d4ed8',
  
  // Semantic colors for different tag types - DocuSign inspired
  signature: '#3b82f6',
  initials: '#1d4ed8',
  date: '#2563eb',
  textTag: '#64748b',
  checkbox: '#f59e0b',
  witness: '#ef4444',
  
  // DocuSign specific colors
  docuSignBlue: '#0070d2',
  docuSignGreen: '#1e40af',
  docuSignGray: '#f8f9fa',
  docuSignBorder: '#dde1e6'
};

// Typography system
export const TYPOGRAPHY = {
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: {
    xs: '0.75rem',     // 12px
    sm: '0.875rem',    // 14px
    base: '1rem',      // 16px
    lg: '1.125rem',    // 18px
    xl: '1.25rem',     // 20px
    
    // Specific use cases
    label: '0.875rem',   // 14px - for labels and secondary text
    content: '1rem',     // 16px - for main content
    tag: '0.75rem',      // 12px - for tag text
    title: '1.125rem'    // 18px - for titles
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700'
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75'
  }
};

// Layout constants - DocuSign Style
export const LAYOUT = {
  // Grid settings
  gridSize: 8,
  
  // Tag-specific padding - DocuSign style
  tagPadding: {
    vertical: 6,    // 6px - slightly more padding
    horizontal: 10  // 10px - more horizontal padding
  },
  
  // Spacing
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    xxl: '3rem'      // 48px
  },
  
  // Border radius - DocuSign style
  borderRadius: {
    sm: '0.125rem',  // 2px
    base: '0.375rem', // 6px - slightly more rounded
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem'       // 16px
  },
  
  // Shadows - DocuSign style
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.04)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.03)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.03)'
  }
};

// Tag type configuration
export const TAG_TYPE_CONFIG: Record<TagType, {
  label: string;
  icon: string;
  placeholder: string;
  color: string;
  borderColor: string;
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
  allowResize: boolean;
  allowTextInput: boolean;
}> = {
  'A': {
    label: 'Name',
    icon: '',
    placeholder: 'Name',
    color: PROFESSIONAL_COLORS.primary,
    borderColor: PROFESSIONAL_COLORS.borderActive,
    defaultWidth: 60,   // Shorter width for single line text
    defaultHeight: 18,  // Single line height
    minWidth: 1,        // allow hugging content
    minHeight: 1,       // allow hugging content
    allowResize: true,
    allowTextInput: true
  },
  'S': {
    label: 'Signature',
    icon: '',
    placeholder: 'Sign',
    color: PROFESSIONAL_COLORS.signature,
    borderColor: PROFESSIONAL_COLORS.borderActive,
    defaultWidth: 160,  // Keep larger for signatures
    defaultHeight: 40,  // Keep larger for signatures
    minWidth: 1,
    minHeight: 1,
    allowResize: true,
    allowTextInput: false
  },
  'I': {
    label: 'Initials',
    icon: '',
    placeholder: 'Initial',
    color: PROFESSIONAL_COLORS.accent,
    borderColor: PROFESSIONAL_COLORS.borderActive,
    defaultWidth: 50,   // Shorter for initials
    defaultHeight: 18,  // Single line height
    minWidth: 1,
    minHeight: 1,
    allowResize: true,
    allowTextInput: false
  },
  'N': {
    label: 'Commission Number',
    icon: '',
    placeholder: 'Comm #',
    color: PROFESSIONAL_COLORS.success,
    borderColor: PROFESSIONAL_COLORS.borderActive,
    defaultWidth: 70,   // Shorter for commission number
    defaultHeight: 18,  // Single line height
    minWidth: 1,
    minHeight: 1,
    allowResize: true,
    allowTextInput: true
  },
  'X': {
    label: 'Commission Expiration',
    icon: '',
    placeholder: 'Exp Date',
    color: '#fef3c7', // Light yellow background
    borderColor: '#d97706', // Darker orange border for better contrast
    defaultWidth: 70,   // Shorter for expiration date
    defaultHeight: 18,  // Single line height
    minWidth: 1,
    minHeight: 1,
    allowResize: true,
    allowTextInput: true
  },
  'O': {
    label: 'Disclosure',
    icon: '',
    placeholder: 'Disclosure',
    color: '#fef3c7', // Light yellow background for high visibility
    borderColor: '#d97706', // Dark orange border for maximum contrast
    defaultWidth: 80,   // Keep wider for disclosure text
    defaultHeight: 18,  // Single line height
    minWidth: 1,
    minHeight: 1,
    allowResize: true,
    allowTextInput: true
  },
  'E': {
    label: 'Notary Seal',
    icon: '',
    placeholder: 'Seal',
    color: PROFESSIONAL_COLORS.primary,
    borderColor: PROFESSIONAL_COLORS.borderActive,
    defaultWidth: 80,   // Keep larger for seals
    defaultHeight: 80,  // Keep larger square shape for seals
    minWidth: 1,
    minHeight: 1,
    allowResize: true,
    allowTextInput: false
  },
  'W': {
    label: 'Whiteout',
    icon: '',
    placeholder: 'Whiteout',
    color: '#ffffff', // Pure white background for true whiteout
    borderColor: '#e5e7eb', // Light gray border
    defaultWidth: 80,   // Keep larger for whiteout
    defaultHeight: 30,  // Keep larger for whiteout
    minWidth: 1,
    minHeight: 1,
    allowResize: true,
    allowTextInput: false
  },
  'T': {
    label: 'Text',
    icon: '',
    placeholder: 'Text',
    color: '#f8fafc', // Slightly lighter background
    borderColor: '#475569', // Darker border for better contrast
    // Stable default size so the tag never flashes invisible or overly large
    defaultWidth: 40,   // Shorter width for text - reduced from 60
    defaultHeight: 18,  // Single line height
    // Sensible minimums to prevent flicker while still allowing shrink-to-fit
    minWidth: 16,       // Reduced from 24 for tighter fit
    minHeight: 18,
    allowResize: true,
    allowTextInput: true
  },
  'D': {
    label: 'Date',
    icon: '',
    placeholder: 'Date',
    color: '#fef3c7', // Light yellow background
    borderColor: '#d97706', // Darker orange border for better contrast
    defaultWidth: 70,   // Shorter width for dates
    defaultHeight: 18,  // Single line height
    minWidth: 1,
    minHeight: 1,
    allowResize: true,
    allowTextInput: true
  }
};

// Utility functions
export const getTagDimensions = (tagType: TagType) => {
  const config = TAG_TYPE_CONFIG[tagType];
  if (!config) {
    if (typeof window !== 'undefined' && (window as any).__DEBUG_EDITOR__) {
      console.warn(`Unknown tag type: ${tagType}, using default dimensions`);
    }
    return {
      width: 120,
      height: 25,
      minWidth: 1,
      minHeight: 1
    };
  }
  return {
    width: config.defaultWidth,
    height: config.defaultHeight,
    minWidth: config.minWidth,
    minHeight: config.minHeight
  };
};

// Helper function to convert hex color to rgba with opacity
const hexToRgba = (hex: string, opacity: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const getTagStyle = (tagType: TagType, isSelected = false, isCompleted = false, userColor?: string) => {
  const config = TAG_TYPE_CONFIG[tagType];
  if (!config) {
    if (typeof window !== 'undefined' && (window as any).__DEBUG_EDITOR__) {
      console.warn(`Unknown tag type: ${tagType}, using default style`);
    }
    return {
      backgroundColor: isCompleted ? 'transparent' : hexToRgba(userColor || '#4ECDC4', 0.6),
      borderColor: isSelected ? PROFESSIONAL_COLORS.borderActive : hexToRgba(userColor || '#4ECDC4', 0.9),
      color: '#1f2937', // Darker text for better readability
      borderWidth: isCompleted ? '0px' : '1px',
      borderStyle: 'solid',
      borderRadius: LAYOUT.borderRadius.base,
      padding: '0px',
      fontFamily: TYPOGRAPHY.fontFamily,
      fontSize: TYPOGRAPHY.fontSize.tag,
      fontWeight: TYPOGRAPHY.fontWeight.normal, // Lighter weight for better readability
      boxShadow: isCompleted ? 'none' : (isSelected ? LAYOUT.shadow.base : 'none'),
      textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)'
    };
  }
  
  // Use user's color if provided, otherwise fall back to config color
  const effectiveColor = userColor || config.color;
  
  // Special-case: Whiteout should always render as a solid white rectangle with a light border,
  // regardless of completion state, and with no text rendering handled elsewhere.
  if (tagType === 'W') {
    return {
      backgroundColor: '#ffffff',
      borderColor: isSelected ? PROFESSIONAL_COLORS.borderActive : (config.borderColor || '#e5e7eb'),
      color: '#1f2937',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderRadius: LAYOUT.borderRadius.base,
      padding: '0px',
      fontFamily: TYPOGRAPHY.fontFamily,
      fontSize: TYPOGRAPHY.fontSize.tag,
      fontWeight: TYPOGRAPHY.fontWeight.normal,
      boxShadow: isSelected ? LAYOUT.shadow.base : 'none',
      textShadow: 'none'
    };
  }

  return {
    backgroundColor: isCompleted ? 'transparent' : hexToRgba(effectiveColor, 0.6), // 60% transparency
    borderColor: isSelected ? PROFESSIONAL_COLORS.borderActive : hexToRgba(effectiveColor, 0.9), // 90% transparency for border
    color: '#1f2937', // Darker text for better readability
    borderWidth: isCompleted ? '0px' : '1.5px',
    borderStyle: 'solid',
    borderRadius: LAYOUT.borderRadius.base,
    padding: '0px',
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.fontSize.tag,
    fontWeight: TYPOGRAPHY.fontWeight.normal, // Lighter weight for better readability
    boxShadow: isCompleted ? 'none' : (isSelected ? LAYOUT.shadow.base : 'none'),
    textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)'
  };
};

export const snapToGrid = (value: number, gridSize: number = LAYOUT.gridSize): number => {
  return Math.round(value / gridSize) * gridSize;
};

export const isWithinBounds = (
  x: number, 
  y: number, 
  width: number, 
  height: number, 
  containerWidth: number, 
  containerHeight: number
): boolean => {
  return x >= 0 && y >= 0 && x + width <= containerWidth && y + height <= containerHeight;
};

// Calculate optimal width based on text content and font size
export const calculateOptimalWidth = (text: string, fontSize: number = 12, fontFamily: string = 'Arial'): number => {
  // Normalize to a safe string to avoid runtime errors when non-strings are passed
  const safeText = (() => {
    if (typeof text === 'string') return text;
    // Fallbacks for unexpected runtimes
    const anyVal: any = text as any;
    if (anyVal == null) return '';
    if (typeof anyVal === 'number' || typeof anyVal === 'boolean') return String(anyVal);
    if (anyVal instanceof Date) {
      try { return anyVal.toLocaleDateString(); } catch { return anyVal.toISOString(); }
    }
    if (typeof anyVal === 'object') {
      const candidate = anyVal.text ?? anyVal.value ?? anyVal.display ?? '';
      return typeof candidate === 'string' ? candidate : '';
    }
    try { return String(anyVal); } catch { return ''; }
  })();

  if (safeText.trim().length === 0) {
    return 1; // Absolute minimum when empty so box can be placed tightly
  }
  
  // Create a temporary canvas to measure text width
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    return 1; // Fallback if canvas is not available
  }
  
  // Set font properties
  context.font = `${fontSize}px ${fontFamily}`;
  
  // Measure text width
  const textMetrics = context.measureText(safeText);
  const textWidth = textMetrics.width;
  
  // Minimal padding so the border hugs the content tightly
  const padding = 1; // total (0.5px each side) - reduced for tighter fit
  
  // Ensure we always have enough space for the text
  const requiredWidth = Math.max(textWidth + padding, 1);
  
  return requiredWidth;
};

// Calculate optimal height based on text content and font size
export const calculateOptimalHeight = (text: string, fontSize: number = 12): number => {
  // Normalize to a safe string as above
  const safeText = (() => {
    if (typeof text === 'string') return text;
    const anyVal: any = text as any;
    if (anyVal == null) return '';
    if (typeof anyVal === 'number' || typeof anyVal === 'boolean') return String(anyVal);
    if (anyVal instanceof Date) {
      try { return anyVal.toLocaleDateString(); } catch { return anyVal.toISOString(); }
    }
    if (typeof anyVal === 'object') {
      const candidate = anyVal.text ?? anyVal.value ?? anyVal.display ?? '';
      return typeof candidate === 'string' ? candidate : '';
    }
    try { return String(anyVal); } catch { return ''; }
  })();

  // Tight one-line height estimation to hug text content
  const lineHeight = fontSize * 1.0; // exact font size
  const padding = 1; // total (0.5px top + 0.5px bottom) - reduced for tighter fit
  const singleLineHeight = Math.ceil(lineHeight) + padding;

  if (safeText.trim().length === 0) {
    return Math.max(singleLineHeight, 1);
  }
  
  // Rough multi-line estimate (kept conservative)
  const avgCharWidth = fontSize * 0.6;
  const estimatedWidth = safeText.length * avgCharWidth;
  const maxWidth = 200; // Assume wrap threshold
  const estimatedLines = Math.ceil(estimatedWidth / maxWidth);
  const actualLines = Math.max(1, estimatedLines);
  const totalHeight = Math.ceil(lineHeight * actualLines) + padding;
  return Math.max(totalHeight, 1);
};

// Animation constants
export const ANIMATIONS = {
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms'
  },
  easing: {
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)'
  }
};