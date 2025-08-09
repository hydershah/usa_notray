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
    icon: '👤',
    placeholder: 'Full Name',
    color: PROFESSIONAL_COLORS.primary,
    borderColor: PROFESSIONAL_COLORS.borderActive,
    defaultWidth: 120,  // Reduced size
    defaultHeight: 25,  // Reduced size
    minWidth: 80,
    minHeight: 25,
    allowResize: true,
    allowTextInput: true
  },
  'S': {
    label: 'Signature',
    icon: '✍️',
    placeholder: 'Sign here',
    color: PROFESSIONAL_COLORS.signature,
    borderColor: PROFESSIONAL_COLORS.borderActive,
    defaultWidth: 160,  // Reduced from 180 - slightly bigger for signatures
    defaultHeight: 40,  // Reduced from 50 - slightly bigger for signatures
    minWidth: 100,
    minHeight: 35,
    allowResize: true,
    allowTextInput: false
  },
  'I': {
    label: 'Initials',
    icon: '📝',
    placeholder: 'Initial here',
    color: PROFESSIONAL_COLORS.accent,
    borderColor: PROFESSIONAL_COLORS.borderActive,
    defaultWidth: 120,  // Reduced size
    defaultHeight: 25,  // Reduced size
    minWidth: 60,
    minHeight: 25,
    allowResize: true,
    allowTextInput: false
  },
  'N': {
    label: 'Commission Number',
    icon: '🔢',
    placeholder: 'Commission #',
    color: PROFESSIONAL_COLORS.success,
    borderColor: PROFESSIONAL_COLORS.borderActive,
    defaultWidth: 120,  // Reduced size
    defaultHeight: 25,  // Reduced size
    minWidth: 100,
    minHeight: 25,
    allowResize: true,
    allowTextInput: true
  },
  'X': {
    label: 'Commission Expiration',
    icon: '📅',
    placeholder: 'Expiration Date',
    color: '#fef3c7', // Light yellow background
    borderColor: '#d97706', // Darker orange border for better contrast
    defaultWidth: 120,  // Reduced size
    defaultHeight: 25,  // Reduced size
    minWidth: 100,
    minHeight: 25,
    allowResize: true,
    allowTextInput: true
  },
  'O': {
    label: 'Disclosure',
    icon: '📋',
    placeholder: 'Disclosure info',
    color: '#fef3c7', // Light yellow background for high visibility
    borderColor: '#d97706', // Dark orange border for maximum contrast
    defaultWidth: 120,  // Reduced size
    defaultHeight: 25,  // Reduced size
    minWidth: 120,
    minHeight: 25,
    allowResize: true,
    allowTextInput: true
  },
  'E': {
    label: 'Notary Seal',
    icon: '🔏',
    placeholder: 'Notary seal',
    color: PROFESSIONAL_COLORS.primary,
    borderColor: PROFESSIONAL_COLORS.borderActive,
    defaultWidth: 80,   // Reduced from 100 - slightly bigger for seals
    defaultHeight: 80,  // Reduced from 100 - slightly bigger for seals (square shape)
    minWidth: 60,
    minHeight: 60,
    allowResize: true,
    allowTextInput: false
  },
  'W': {
    label: 'Whiteout',
    icon: '⬜',
    placeholder: 'Whiteout area',
    color: '#ffffff', // Pure white background for true whiteout
    borderColor: '#e5e7eb', // Light gray border
    defaultWidth: 120,  // Reduced size
    defaultHeight: 25,  // Reduced size
    minWidth: 50,
    minHeight: 25,
    allowResize: true,
    allowTextInput: false
  },
  'T': {
    label: 'Text',
    icon: '📄',
    placeholder: 'Text',
    color: '#f8fafc', // Slightly lighter background
    borderColor: '#475569', // Darker border for better contrast
    defaultWidth: 120,  // Standardized size
    defaultHeight: 25,  // Standardized size
    minWidth: 80,
    minHeight: 25,
    allowResize: true,
    allowTextInput: true
  },
  'D': {
    label: 'Date',
    icon: '📅',
    placeholder: 'MM/DD/YYYY',
    color: '#fef3c7', // Light yellow background
    borderColor: '#d97706', // Darker orange border for better contrast
    defaultWidth: 120,  // Reduced size
    defaultHeight: 25,  // Reduced size
    minWidth: 100,
    minHeight: 25,
    allowResize: true,
    allowTextInput: true
  }
};

// Utility functions
export const getTagDimensions = (tagType: TagType) => {
  const config = TAG_TYPE_CONFIG[tagType];
  if (!config) {
    console.warn(`Unknown tag type: ${tagType}, using default dimensions`);
    return {
      width: 120,
      height: 25,
      minWidth: 60,
      minHeight: 25
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
    console.warn(`Unknown tag type: ${tagType}, using default style`);
    return {
      backgroundColor: isCompleted ? 'transparent' : hexToRgba(userColor || '#4ECDC4', 0.6),
      borderColor: isSelected ? PROFESSIONAL_COLORS.borderActive : hexToRgba(userColor || '#4ECDC4', 0.9),
      color: '#1f2937', // Darker text for better readability
      borderWidth: isCompleted ? '0px' : '1.5px',
      borderStyle: 'solid',
      borderRadius: LAYOUT.borderRadius.base,
      padding: LAYOUT.spacing.sm,
      fontFamily: TYPOGRAPHY.fontFamily,
      fontSize: TYPOGRAPHY.fontSize.tag,
      fontWeight: TYPOGRAPHY.fontWeight.normal, // Lighter weight for better readability
      boxShadow: isCompleted ? 'none' : (isSelected ? LAYOUT.shadow.base : 'none'),
      textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)' // Add text shadow for better readability
    };
  }
  
  // Use user's color if provided, otherwise fall back to config color
  const effectiveColor = userColor || config.color;
  
  return {
    backgroundColor: isCompleted ? 'transparent' : hexToRgba(effectiveColor, 0.6), // 60% transparency
    borderColor: isSelected ? PROFESSIONAL_COLORS.borderActive : hexToRgba(effectiveColor, 0.9), // 90% transparency for border
    color: '#1f2937', // Darker text for better readability
    borderWidth: isCompleted ? '0px' : '1.5px',
    borderStyle: 'solid',
    borderRadius: LAYOUT.borderRadius.base,
    padding: LAYOUT.spacing.sm,
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.fontSize.tag,
    fontWeight: TYPOGRAPHY.fontWeight.normal, // Lighter weight for better readability
    boxShadow: isCompleted ? 'none' : (isSelected ? LAYOUT.shadow.base : 'none'),
    textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)' // Add text shadow for better readability
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
  if (!text || text.trim().length === 0) {
    return 100; // Default minimum width
  }
  
  // Create a temporary canvas to measure text width
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    return 100; // Fallback if canvas is not available
  }
  
  // Set font properties
  context.font = `${fontSize}px ${fontFamily}`;
  
  // Measure text width
  const textMetrics = context.measureText(text);
  const textWidth = textMetrics.width;
  
  // Add generous padding for better visual appearance
  const padding = 40; // 20px on each side - more generous padding
  const minWidth = 80; // Minimum width for any tag
  
  // Ensure we always have enough space for the text
  const requiredWidth = Math.max(textWidth + padding, minWidth);
  
  // For very long text, add extra space to prevent cramped appearance
  if (text.length > 50) {
    return Math.max(requiredWidth, 200); // Minimum 200px for long text
  }
  
  return requiredWidth;
};

// Calculate optimal height based on text content and font size
export const calculateOptimalHeight = (text: string, fontSize: number = 12): number => {
  if (!text || text.trim().length === 0) {
    return 25; // Default minimum height aligned with 25px requirement
  }
  
  // For single line text, use font size + padding
  const lineHeight = fontSize * 1.2; // 1.2 line height
  const padding = 8; // 4px top and bottom padding
  
  // Estimate number of lines based on text length and typical character width
  const avgCharWidth = fontSize * 0.6; // Approximate character width
  const estimatedWidth = text.length * avgCharWidth;
  const maxWidth = 200; // Assume max width before wrapping
  
  // Calculate number of lines needed
  const estimatedLines = Math.ceil(estimatedWidth / maxWidth);
  const actualLines = Math.max(1, estimatedLines);
  
  // Calculate height based on number of lines
  const totalHeight = (lineHeight * actualLines) + padding;
  
  return Math.max(totalHeight, 25); // Minimum height of 25px
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