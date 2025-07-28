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
    'A': '#334155', // Name - dark slate
    'S': '#991b1b', // Signature - dark red
    'I': '#166534', // Initials - dark green
    'N': '#9a3412', // Commission # - dark orange
    'X': '#581c87', // Expiration - dark purple
    'O': '#0f4c75', // Disclosure - dark blue
    'E': '#831843', // Seal - dark pink
    'W': '#374151', // Whiteout - dark gray
    'T': '#1e3a8a', // Text - dark blue
    'D': '#14532d'  // Date - dark emerald
  };
  return colors[tagType] || '#334155';
};

export const getTagTypeInfo = (tagType: string) => {
  return {
    icon: getTagIcon(tagType),
    label: getTagLabel(tagType),
    color: getTagColor(tagType)
  };
}; 