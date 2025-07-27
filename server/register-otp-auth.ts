import { Express } from 'express';
import { registerEmailLinkAuth } from './email-link-registration';

/**
 * Register email link-based authentication routes
 * This file provides a clean way to add email link authentication
 * without modifying the main routes.ts file
 */
export function setupOtpAuthentication(app: Express): void {
  console.log('📧 Setting up email link-based authentication routes...');
  
  try {
    // Register the email link routes (register, verify-email via link)
    registerEmailLinkAuth(app);
    
    console.log('✅ Email link authentication routes registered successfully');
    console.log('   - POST /api/auth/register-email (sends verification email)');
    console.log('   - GET /api/auth/verify-email/:token (verifies & creates account)');
    
  } catch (error) {
    console.error('❌ Failed to register email link authentication routes:', error);
    throw error;
  }
}

// Export for easy importing
export default setupOtpAuthentication; 