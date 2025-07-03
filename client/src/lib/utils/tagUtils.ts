// Tag utility functions for PDF tagging system

export const getTagIcon = (tagType: string): string => {
  const icons: Record<string, string> = {
    'A': '✍️', // Name
    'S': '📝', // Signature
    'I': '🔤', // Initials
    'N': '🆔', // Commission Number
    'X': '📅', // Expiration
    'O': '📋', // Disclosure
    'E': '🔖', // Seal
    'W': '⬜', // Whiteout
    'T': '📝', // Text
    'D': '📆'  // Date
  };
  return icons[tagType] || '📝';
};

export const getTagLabel = (tagType: string): string => {
  const labels: Record<string, string> = {
    'A': 'Name',
    'S': 'Signature', 
    'I': 'Initials',
    'N': 'Commission #',
    'X': 'Expiration',
    'O': 'Disclosure',
    'E': 'Seal',
    'W': 'Whiteout',
    'T': 'Text',
    'D': 'Date'
  };
  return labels[tagType] || 'Tag';
};

export const getTagColor = (tagType: string): string => {
  const colors: Record<string, string> = {
    'A': '#4ECDC4', // Name - teal
    'S': '#45B7D1', // Signature - blue
    'I': '#96CEB4', // Initials - green
    'N': '#FECA57', // Commission # - yellow
    'X': '#FF6B6B', // Expiration - red
    'O': '#DDA0DD', // Disclosure - plum
    'E': '#98D8C8', // Seal - mint
    'W': '#F0F0F0', // Whiteout - light gray
    'T': '#74B9FF', // Text - light blue
    'D': '#FD79A8'  // Date - pink
  };
  return colors[tagType] || '#4ECDC4';
};

export const getTagTypeInfo = (tagType: string) => {
  return {
    icon: getTagIcon(tagType),
    label: getTagLabel(tagType),
    color: getTagColor(tagType)
  };
}; 