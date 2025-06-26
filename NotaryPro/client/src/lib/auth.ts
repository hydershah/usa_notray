import { apiRequest } from './queryClient';

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  privileges: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiRequest('POST', '/api/auth/login', credentials);
    const data = await response.json();
    
    // Store token in localStorage
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    return data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getStoredUser: (): User | null => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  getStoredToken: (): string | null => {
    return localStorage.getItem('token');
  },

  isAuthenticated: (): boolean => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return !!(token && user);
  }
};
