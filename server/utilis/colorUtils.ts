// server/utils/colorUtils.ts
import { USER_COLORS } from '../../shared/schema'; // Adjust path to your schema file

interface User {
  id: number;
  firstName?: string;
  lastName?: string;
}

export const getUserColor = (user: User | null): string => {
  if (!user || !user.id) return USER_COLORS[0]; // Default to first color if no user
  return USER_COLORS[user.id % USER_COLORS.length]; // Deterministic color based on user ID
};