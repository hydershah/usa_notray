/**
 * Time validation utilities to prevent scheduling appointments in the past
 */

/**
 * Checks if a given date and time is in the past
 * @param date - Date string in YYYY-MM-DD format
 * @param time - Time string in HH:MM format
 * @returns boolean - true if the date/time is in the past
 */
export function isDateTimeInPast(date: string, time: string): boolean {
  if (!date || !time) return false;
  
  const selectedDateTime = new Date(`${date}T${time}`);
  const now = new Date();
  
  return selectedDateTime < now;
}

/**
 * Gets the minimum time that can be selected for today
 * @returns string - Time in HH:MM format with 15-minute buffer
 */
export function getMinimumTimeForToday(): string {
  const now = new Date();
  const bufferMinutes = 15; // 15-minute buffer
  
  // Add buffer minutes
  now.setMinutes(now.getMinutes() + bufferMinutes);
  
  // Round up to the next 15-minute interval
  const minutes = now.getMinutes();
  const roundedMinutes = Math.ceil(minutes / 15) * 15;
  now.setMinutes(roundedMinutes);
  
  return now.toTimeString().slice(0, 5); // Return HH:MM format
}

/**
 * Gets the minimum time that can be selected for a specific date
 * @param date - Date string in YYYY-MM-DD format
 * @returns string - Time in HH:MM format
 */
export function getMinimumTimeForDate(date: string): string {
  const today = new Date().toISOString().split('T')[0];
  
  if (date === today) {
    return getMinimumTimeForToday();
  }
  
  // For future dates, allow any time
  return '00:00';
}

/**
 * Validates if a date/time combination is valid for scheduling
 * @param date - Date string in YYYY-MM-DD format
 * @param time - Time string in HH:MM format
 * @returns object - { isValid: boolean, error?: string }
 */
export function validateSchedulingDateTime(date: string, time: string): { isValid: boolean; error?: string } {
  if (!date || !time) {
    return { isValid: false, error: 'Date and time are required' };
  }
  
  if (isDateTimeInPast(date, time)) {
    return { isValid: false, error: 'Cannot schedule appointments in the past' };
  }
  
  return { isValid: true };
}

/**
 * Formats a time string to ensure it's in HH:MM format
 * @param time - Time string
 * @returns string - Formatted time string
 */
export function formatTimeString(time: string): string {
  if (!time) return '';
  
  // Remove any non-numeric characters except colon
  const cleaned = time.replace(/[^0-9:]/g, '');
  
  // If it's just numbers, format as HH:MM
  if (/^\d{3,4}$/.test(cleaned)) {
    const hours = cleaned.slice(0, -2);
    const minutes = cleaned.slice(-2);
    return `${hours.padStart(2, '0')}:${minutes}`;
  }
  
  return cleaned;
}

/**
 * Checks if a date is selectable (not in the past)
 * @param date - Date string in YYYY-MM-DD format
 * @returns boolean - true if the date can be selected
 */
export function isDateSelectable(date: string): boolean {
  if (!date) return false;
  
  const selectedDate = new Date(date);
  const today = new Date();
  
  // Reset time to start of day for comparison
  selectedDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  return selectedDate >= today;
} 