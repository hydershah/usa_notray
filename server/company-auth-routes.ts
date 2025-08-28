import { Express } from 'express';
import { storage } from './storage.js';
import { registrationLimiter } from './middleware/rate-limiter.js';
import { sanitizeHtml, preventSqlInjection } from './middleware/sanitization.js';
import { validateEmailUniqueness } from './middleware/email-validation.js';
import { z } from 'zod';

const companyRegistrationSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  primaryUserName: z.string().min(1, 'Primary user name is required'),
  primaryUserEmail: z.string().email('Valid primary user email is required'),
  primaryUserPassword: z.string().min(6, 'Password must be at least 6 characters'),
  address1: z.string().min(1, 'Address 1 is required'),
  address2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(1, 'Zip code is required'),
  paymentMethod: z.enum(['invoiced', 'qualia', 'pre_pay']),
  contactName: z.string().min(1, 'Contact name is required'),
  email: z.string().email('Valid email is required'),
  phoneNumber: z.string().optional(),
});

export function registerCompanyAuthRoutes(app: Express): void {
  
  /**
   * POST /api/auth/register-company
   * Register a new title company with primary user
   * This is for the "Register Your Title Company" signup flow
   */
  app.post('/api/auth/register-company', registrationLimiter, sanitizeHtml, preventSqlInjection, validateEmailUniqueness, async (req, res) => {
    try {
      const validatedData = companyRegistrationSchema.parse(req.body);
      
      // Check if company already exists
      const existingCompany = await storage.getCompanyByName(validatedData.companyName);
      if (existingCompany) {
        return res.status(409).json({ 
          message: 'Company with this name already exists' 
        });
      }

      // Check if primary user email already exists
      const existingUser = await storage.getUserByEmail(validatedData.primaryUserEmail.trim().toLowerCase());
      if (existingUser) {
        return res.status(409).json({ 
          message: 'User with this email already exists' 
        });
      }

      // Prepare company and manager data
      const companyData = {
        ...validatedData,
        status: 'pending' // Companies require admin approval
      };

      const managerData = {
        username: validatedData.primaryUserEmail,
        email: validatedData.primaryUserEmail,
        password: validatedData.primaryUserPassword,
        firstName: validatedData.primaryUserName.split(' ')[0] || validatedData.primaryUserName,
        lastName: validatedData.primaryUserName.split(' ').slice(1).join(' ') || '',
        fullName: validatedData.primaryUserName,
        phoneNumber: validatedData.phoneNumber,
        role: 'title_company',
        companyRole: 'manager',
        isActive: true,
        approvalStatus: 'approved'
      };

      // Register company and manager
      const result = await storage.registerCompany(companyData, managerData);

      console.log(`✅ New company registered: ${result.company.companyName} with manager ${result.manager.email}`);

      res.status(201).json({
        message: 'Company registration successful! Your company is pending admin approval.',
        company: {
          id: result.company.id,
          companyName: result.company.companyName,
          status: result.company.status
        },
        manager: {
          id: result.manager.id,
          email: result.manager.email,
          fullName: result.manager.fullName,
          role: result.manager.role
        }
      });

    } catch (error) {
      console.error('Company registration error:', error);
      
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