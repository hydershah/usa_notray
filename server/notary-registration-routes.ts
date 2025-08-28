import { Express } from 'express';
import bcrypt from 'bcrypt';
import { storage } from './storage.js';
import { registrationLimiter } from './middleware/rate-limiter.js';
import { sanitizeHtml, preventSqlInjection } from './middleware/sanitization.js';
import { validateEmailUniqueness } from './middleware/email-validation.js';
import { insertUserSchema } from '../shared/schema.js';
import { z } from 'zod';

const notaryRegistrationSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phoneNumber: z.string().min(10, 'Valid phone number is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  address1: z.string().min(1, 'Address is required'),
  address2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(1, 'ZIP code is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  commissionNumber: z.string().min(1, 'Commission number is required'),
  commissionState: z.string().min(1, 'Commission state is required'),
  commissionExpiration: z.string().min(1, 'Commission expiration is required'),
  yearsOfExperience: z.string().min(1, 'Years of experience is required'),
  specializations: z.string().optional(),
  workingHours: z.string().optional(),
  bio: z.string().optional(),
  notaryType: z.enum(['contractor', 'subscriber']).default('contractor'),
});

export function registerNotaryRoutes(app: Express): void {
  
  /**
   * POST /api/auth/register-notary
   * Register a new notary professional
   * This is for the "I'm a notary" signup flow
   */
  app.post('/api/auth/register-notary', registrationLimiter, sanitizeHtml, preventSqlInjection, validateEmailUniqueness, async (req, res) => {
    try {
      const validatedData = notaryRegistrationSchema.parse(req.body);
      
      const {
        firstName,
        lastName,
        email,
        phoneNumber,
        password,
        address1,
        address2,
        city,
        state,
        zipCode,
        dateOfBirth,
        commissionNumber,
        commissionState,
        commissionExpiration,
        yearsOfExperience,
        specializations,
        workingHours,
        bio,
        notaryType
      } = validatedData;

      const fullName = `${firstName} ${lastName}`.trim();

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
        
        // Address fields (required for notaries)
        address1: address1,
        address2: address2,
        city: city,
        state: state,
        zipCode: zipCode,
        
        // Notary-specific fields
        commissionNumber: commissionNumber,
        commissionExpiration: commissionExpiration,
        notaryType: notaryType,
        
        // Role and status
        role: 'notary',
        isActive: false, // Notaries require admin approval
        approvalStatus: 'pending', // Notaries need approval
        
        // Initialize default settings
        isNotificationsEnabled: true,
        mfaEnabled: false,
        foreignLanguages: []
      });

      // Create user (password will be hashed by storage layer)
      const newUser = await storage.createUser(userData);

      // Store additional notary profile data that doesn't fit in user table
      // This could be extended to store in a separate notary_profiles table
      const notaryProfileData = {
        userId: newUser.id,
        dateOfBirth,
        yearsOfExperience,
        specializations,
        workingHours,
        bio,
        commissionState
      };

      console.log(`✅ New notary registered: ${newUser.email} (ID: ${newUser.id}) - Status: Pending Approval`);
      console.log(`📝 Additional notary profile data:`, notaryProfileData);

      // Return success response (don't include sensitive data)
      res.status(201).json({
        message: 'Notary registration successful! Your application is pending admin approval. You will receive an email notification once your account is approved.',
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.fullName,
          role: newUser.role,
          approvalStatus: newUser.approvalStatus
        }
      });

    } catch (error) {
      console.error('Notary registration error:', error);
      
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