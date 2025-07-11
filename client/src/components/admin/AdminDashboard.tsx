import React, { useEffect } from 'react';
import { useLocation } from 'wouter';

export function AdminDashboard() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // If user is at the old admin dashboard, redirect to the main dashboard
    if (location === '/admin' || location === '/admin/') {
      setLocation('/dashboard');
    }
  }, [location, setLocation]);

  // This component now just handles redirects
  // The actual admin content is handled by the new admin components
  return null;
} 