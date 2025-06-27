import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'bg-success/10 text-success';
    case 'pending':
      return 'bg-warning/10 text-warning';
    case 'open':
      return 'bg-primary/10 text-primary';
    case 'cancelled':
      return 'bg-destructive/10 text-destructive';
    case 'expired':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export function getRoleColor(role: string): string {
  switch (role.toLowerCase()) {
    case 'admin':
      return 'bg-accent/10 text-accent';
    case 'notary':
      return 'bg-primary/10 text-primary';
    case 'title_company':
      return 'bg-success/10 text-success';
    case 'client':
      return 'bg-warning/10 text-warning';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export function formatRole(role: string): string {
  switch (role) {
    case 'title_company':
      return 'Title Company';
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

export function getUserDisplayName(user: any): string {
  if (!user) return 'Unknown';
  
  // Prioritize first name + last name if both are available
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`.trim();
  }
  
  // Fall back to username
  return user.username || 'Unknown User';
}
