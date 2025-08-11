import { Express } from 'express';
import bcrypt from 'bcrypt';
import { storage } from './storage.js';
import { registrationLimiter } from './middleware/rate-limiter.js';
import { sanitizeHtml, preventSqlInjection } from './middleware/sanitization.js';
import { insertUserSchema } from '../shared/schema.js';
import { z } from 'zod';

const clientRegistrationSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  phoneNumber: z.string().min(10, 'Valid phone number is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
});

export function registerClientRoutes(app: Express): void {
  
  /**
   * POST /api/auth/register-client
   * Register a new client (regular user who needs documents notarized)
   * This is for the "I need documents notarized" signup flow
   */
  app.post('/api/auth/register-client', registrationLimiter, sanitizeHtml, preventSqlInjection, async (req, res) => {
    try {
      const validatedData = clientRegistrationSchema.parse(req.body);
      
      const {
        fullName,
        email,
        phoneNumber,
        password,
        address1,
        address2,
        city,
        state,
        zipCode
      } = validatedData;

      // Parse full name
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email.trim().toLowerCase());
      if (existingUser) {
        return res.status(409).json({ 
          message: 'An account with this email already exists. Please try logging in instead.' 
        });
      }

      // Use insertUserSchema to validate and create proper user data
      const userData = insertUserSchema.parse({
        username: email,
        email: email,
        password: password,
        firstName: firstName,
        lastName: lastName,
        fullName: fullName,
        phoneNumber: phoneNumber,
        address1: address1,
        address2: address2,
        city: city,
        state: state,
        zipCode: zipCode,
        role: 'client',
        isActive: true,
        approvalStatus: 'approved',
        isNotificationsEnabled: true,
        mfaEnabled: false,
        foreignLanguages: []
      });

      // Create user (password will be hashed by storage layer)
      const newUser = await storage.createUser(userData);

      console.log(`✅ New client registered: ${newUser.email} (ID: ${newUser.id})`);

      // Return success response (don't include sensitive data)
      res.status(201).json({
        message: 'Registration successful! You can now log in to your account.',
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.fullName,
          role: newUser.role
        }
      });

    } catch (error) {
      console.error('Client registration error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Validation error',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      res.status(500).json({ 
        message: 'Registration failed. Please try again.' 
      });
    }
  });
} 