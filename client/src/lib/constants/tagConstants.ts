import type { TagType } from '@/types/editor';

// Professional color palette for the application
export const PROFESSIONAL_COLORS = {
  // Background colors
  background: '#ffffff',
  backgroundHover: '#f9fafb',
  backgroundActive: '#f3f4f6',
  
  // Border colors
  border: '#d1d5db',
  borderHover: '#9ca3af',
  borderActive: '#3b82f6',
  borderCompleted: '#10b981',
  
  // Text colors
  text: '#111827',
  textSecondary: '#6b7280',
  textPlaceholder: '#9ca3af',
  textMuted: '#d1d5db',
  
  // Status colors
  completed: '#dcfce7',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  
  // Interactive colors
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  accent: '#8b5cf6',
  
  // Semantic colors for different tag types
  signature: '#3b82f6',
  initials: '#8b5cf6',
  date: '#10b981',
  textTag: '#6b7280',
  checkbox: '#f59e0b',
  witness: '#ef4444'
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

// Layout constants
export const LAYOUT = {
  // Grid settings
  gridSize: 8,
  
  // Tag-specific padding
  tagPadding: {
    vertical: 4,    // 4px
    horizontal: 8   // 8px
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
  
  // Border radius
  borderRadius: {
    sm: '0.125rem',  // 2px
    base: '0.25rem', // 4px
    md: '0.375rem',  // 6px
    lg: '0.5rem',    // 8px
    xl: '0.75rem'    // 12px
  },
  
  // Shadows
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
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
    defaultWidth: 150,
    defaultHeight: 30,
    minWidth: 100,
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
    defaultWidth: 200,
    defaultHeight: 60,
    minWidth: 120,
    minHeight: 40,
    allowResize: true,
    allowTextInput: false
  },
  'I': {
    label: 'Initials',
    icon: '📝',
    placeholder: 'Initial here',
    color: PROFESSIONAL_COLORS.accent,
    borderColor: PROFESSIONAL_COLORS.borderActive,
    defaultWidth: 80,
    defaultHeight: 40,
    minWidth: 60,
    minHeight: 30,
    allowResize: true,
    allowTextInput: false
  },
  'N': {
    label: 'Commission Number',
    icon: '🔢',
    placeholder: 'Commission #',
    color: PROFESSIONAL_COLORS.success,
    borderColor: PROFESSIONAL_COLORS.borderActive,
    defaultWidth: 120,
    defaultHeight: 30,
    minWidth: 100,
    minHeight: 25,
    allowResize: true,
    allowTextInput: true
  },
  'X': {
    label: 'Commission Expiration',
    icon: '📅',
    placeholder: 'Expiration Date',
    color: PROFESSIONAL_COLORS.warning,
    borderColor: PROFESSIONAL_COLORS.borderActive,
    defaultWidth: 120,
    defaultHeight: 30,
    minWidth: 100,
    minHeight: 25,
    allowResize: true,
    allowTextInput: true
  },
  'O': {
    label: 'Disclosure',
    icon: '📋',
    placeholder: 'Disclosure info',
    color: PROFESSIONAL_COLORS.textSecondary,
    borderColor: PROFESSIONAL_COLORS.border,
    defaultWidth: 150,
    defaultHeight: 40,
    minWidth: 100,
    minHeight: 30,
    allowResize: true,
    allowTextInput: true
  },
  'E': {
    label: 'Notary Seal',
    icon: '🔏',
    placeholder: 'Notary seal',
    color: PROFESSIONAL_COLORS.primary,
    borderColor: PROFESSIONAL_COLORS.borderActive,
    defaultWidth: 80,
    defaultHeight: 80,
    minWidth: 60,
    minHeight: 60,
    allowResize: true,
    allowTextInput: false
  },
  'W': {
    label: 'Whiteout',
    icon: '🗞️',
    placeholder: 'Correction area',
    color: '#ffffff',
    borderColor: PROFESSIONAL_COLORS.border,
    defaultWidth: 100,
    defaultHeight: 30,
    minWidth: 60,
    minHeight: 20,
    allowResize: true,
    allowTextInput: false
  },
  'T': {
    label: 'Text',
    icon: '📄',
    placeholder: 'Enter text',
    color: PROFESSIONAL_COLORS.text,
    borderColor: PROFESSIONAL_COLORS.border,
    defaultWidth: 150,   // Much smaller width like reference image
    defaultHeight: 40,  // Very slim height like reference image
    minWidth: 40,
    minHeight: 15,
    allowResize: true,
    allowTextInput: true
  },
  'D': {
    label: 'Date',
    icon: '📅',
    placeholder: 'MM/DD/YYYY',
    color: PROFESSIONAL_COLORS.date,
    borderColor: PROFESSIONAL_COLORS.borderActive,
    defaultWidth: 120,
    defaultHeight: 30,
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
      width: 100,
      height: 30,
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

export const getTagStyle = (tagType: TagType, isSelected = false, isCompleted = false) => {
  const config = TAG_TYPE_CONFIG[tagType];
  if (!config) {
    console.warn(`Unknown tag type: ${tagType}, using default style`);
    return {
      backgroundColor: isCompleted ? PROFESSIONAL_COLORS.completed : PROFESSIONAL_COLORS.background,
      borderColor: isSelected ? PROFESSIONAL_COLORS.borderActive : PROFESSIONAL_COLORS.border,
      color: PROFESSIONAL_COLORS.text,
      borderWidth: '2px',
      borderStyle: 'solid',
      borderRadius: LAYOUT.borderRadius.base,
      padding: LAYOUT.spacing.sm,
      fontFamily: TYPOGRAPHY.fontFamily,
      fontSize: TYPOGRAPHY.fontSize.tag,
      fontWeight: TYPOGRAPHY.fontWeight.medium
    };
  }
  return {
    backgroundColor: isCompleted ? PROFESSIONAL_COLORS.completed : config.color,
    borderColor: isSelected ? PROFESSIONAL_COLORS.borderActive : config.borderColor,
    color: PROFESSIONAL_COLORS.text,
    borderWidth: '2px',
    borderStyle: 'solid',
    borderRadius: LAYOUT.borderRadius.base,
    padding: LAYOUT.spacing.sm,
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.fontSize.tag,
    fontWeight: TYPOGRAPHY.fontWeight.medium
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