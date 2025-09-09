// This file exports only TypeScript types for use in client code
// No drizzle-orm imports to avoid browser module resolution issues

import { z } from 'zod'

// Express Request type for server-side use
// Using 'any' for browser compatibility
export interface AuthenticatedRequest {
  user: User;
  body?: any;
  params?: any;
  query?: any;
  headers?: any;
  method?: string;
  url?: string;
  [key: string]: any;
}

export interface User {
  id: number;
  username: string;
  email: string;
  password: string;
  role: string;
  privileges: string[] | null;
  createdAt: Date | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  phoneNumber: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  address: string | null;
  companyId: number | null;
  companyRole: string | null;
  title: string | null;
  commissionNumber: string | null;
  commissionExpiration: string | null;
  county: string | null;
  disclosure: string | null;
  signatureData: string | null;
  initialData: string | null;
  notaryType: string | null;
  notaryIdCode: string | null;
  isActive: boolean | null;
  accountBalance: number | null;
  minimumBalance: number | null;
  profileSubmitted: boolean | null;
  profileApproved: boolean | null;
  profileRejectionReason: string | null;
  resetToken: string | null;
  resetTokenExpiry: Date | null;
  twoFactorSecret: string | null;
  twoFactorEnabled: boolean | null;
  licenseData: string | null;
  licenseNumber: string | null;
  licenseExpirationDate: string | null;
  stripeCustomerId: string | null;
  lastLoginAt: Date | null;
  failedLoginAttempts: number | null;
  accountLockedUntil: Date | null;
  evs_userid: string | null;
  evs_authcode: string | null;
  evs_api_key: string | null;
  kba_data: any | null;
  identity_verification_completed: boolean | null;
  kba_completed: boolean | null;
  verification_method: string | null;
  verification_completed_at: Date | null;
  address_history: any | null;
  email_verified: boolean | null;
  email_verified_at: Date | null;
  verification_bypass_by_admin: boolean | null;
  verification_bypass_date: Date | null;
  verification_bypass_reason: string | null;
  verification_bypass_admin_id: number | null;
  phone_verified: boolean | null;
  phone_verified_at: Date | null;
  verification_attempts: number | null;
  last_verification_attempt: Date | null;
  governmentIdImageUrl: string | null;
  selfieImageUrl: string | null;
  identity_verification_status: string | null;
  identity_verification_data: any | null;
  assignmentAccess: string | null;
}

export interface Company {
  id: number;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: string;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  createdAt: Date | null;
  lastNotaryJobId: number | null;
  notarySelectionMethod: string | null;
}

export interface TitleCompany {
  id: number;
  name: string;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: Date | null;
}

export interface Job {
  id: number;
  jobId: string;
  closingType: string | null;
  closingTypeOther: string | null;
  status: string | null;
  signerName: string | null;
  signerEmail: string | null;
  signerPhone: string | null;
  signerAddress: string | null;
  propertyAddress: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  createdAt: Date | null;
  userId: number | null;
  notaryId: number | null;
  propertyAddress1: string | null;
  propertyAddress2: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  propertyZipCode: string | null;
  signerAddress1: string | null;
  signerAddress2: string | null;
  signerCity: string | null;
  signerState: string | null;
  signerZipCode: string | null;
  companyId: number | null;
  completedAt: Date | null;
  paidAt: Date | null;
  loanNumber: string | null;
  escrowNumber: string | null;
  titleCompanyId: number | null;
  closingTypeValue: string | null;
  closingTypes: any | null;
  isBuyerSide: boolean | null;
  jobType: string;
  jobAmount: number | null;
  deletedAt: Date | null;
  deletedBy: number | null;
  deleteReason: string | null;
  assignmentCriteria: any | null;
  lastAssignmentId: number | null;
  approvalStatus: string | null;
  approvalNotes: string | null;
  approvedAt: Date | null;
  approvedBy: number | null;
  rejectedAt: Date | null;
  rejectedBy: number | null;
  emailHistory: any | null;
  signersData: any | null;
  cancelReason: string | null;
  cancelledAt: Date | null;
  cancelledBy: number | null;
  completionReportSubmitted: boolean | null;
  completionReportData: any | null;
  completionReportSubmittedAt: Date | null;
  paymentAcknowledgedAt: Date | null;
  paymentAcknowledgedBy: number | null;
  invoiced: boolean | null;
  signerWitness: boolean | null;
  witnessFee: number | null;
  notaryFee: number | null;
  notaryFeeOverride: number | null;
  feeOverrideReason: string | null;
  feeOverrideApprovedBy: number | null;
  specialInstructions: string | null;
  
  // Additional fields for notary assignment
  selectedNotary?: string | null;
  assignedNotary?: {
    id: number;
    name: string;
    notaryIdCode?: string | null;
    email: string;
    isActive: boolean;
  } | null;
}

export interface ClosingType {
  id: number;
  name: string;
  value: string;
  description: string | null;
  active: boolean;
  createdAt: Date | null;
}

export interface Payment {
  id: number;
  jobId: number;
  notaryId: number;
  amount: number;
  status: string;
  processedAt: Date | null;
  stripePaymentIntentId: string | null;
  notes: string | null;
  createdAt: Date | null;
  type: string | null;
  processingFee: number | null;
  netAmount: number | null;
  paymentMethod: string | null;
  referenceNumber: string | null;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  companyId: number | null;
  notaryId: number | null;
  amount: number;
  status: string;
  dueDate: Date | null;
  paidAt: Date | null;
  items: any | null;
  notes: string | null;
  createdAt: Date | null;
  stripeInvoiceId: string | null;
  paymentMethod: string | null;
  paymentDetails: any | null;
}

export interface CalendarEvent {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  jobId: number | null;
  eventType: string;
  location: string | null;
  isAllDay: boolean | null;
  recurrence: string | null;
  reminderMinutes: number | null;
  status: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface File {
  id: number;
  filename: string;
  mimeType: string;
  size: number;
  jobId: number | null;
  userId: number | null;
  type: string | null;
  uploadedAt: Date | null;
  tags: any | null;
  signatureData: any | null;
  fileOrder: number | null;
  sessionId: number | null;
  participantId: number | null;
  isTemplate: boolean | null;
  category: string | null;
  metadata: any | null;
  storageUrl: string | null;
  thumbnailUrl: string | null;
  pageCount: number | null;
  checksum: string | null;
  encryptionKey: string | null;
  isEncrypted: boolean | null;
}

// Zod schemas for client-side validation
export const insertUserSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.string().default('client'),
  privileges: z.array(z.string()).optional(),
  notaryType: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string().optional(),
  phoneNumber: z.string().optional(),
  commissionNumber: z.string().optional(),
  commissionExpiration: z.string().optional(),
  state: z.string().optional(),
  county: z.string().optional(),
  isActive: z.boolean().optional(),
  isNotarySigningAgent: z.boolean().optional(),
  isSpanishSpeaking: z.boolean().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;

// Safe User DTO for API responses - excludes sensitive data
export interface SafeUserDTO {
  id: number;
  username: string;
  email: string;
  role: string;
  privileges: string[] | null;
  createdAt: Date | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  phoneNumber: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  companyId: number | null;
  companyRole: string | null;
  title: string | null;
  commissionNumber: string | null;
  commissionExpiration: string | null;
  county: string | null;
  notaryType: string | null;
  isActive: boolean | null;
  accountBalance: number | null;
  profileSubmitted: boolean | null;
  approvalStatus: string | null;
  approvalNotes: string | null;
  isVerified: boolean | null;
  verificationStatus: string | null;
  lastLoginAt: Date | null;
  updatedAt: Date | null;
  accountSetupComplete: boolean | null;
  // Notary specific fields (safe to expose)
  nameOnCommission: string | null;
  commissionAddress1: string | null;
  commissionAddress2: string | null;
  commissionCity: string | null;
  commissionState: string | null;
  commissionZipCode: string | null;
  commissionCounty: string | null;
  isNotarySigningAgent: boolean | null;
  notarySigningAgentExpiration: string | null;
  isSpanishSpeaking: boolean | null;
  foreignLanguages: string[] | null;
  signingAgentCertified: boolean | null;
  signingAgentExpirationDate: string | null;
  maxConcurrentJobs: number | null;
  // Exclude sensitive fields:
  // - password
  // - mfaSecret
  // - resetToken
  // - resetTokenExpiry
  // - twoFactorSecret
  // - evs_userid, evs_authcode, evs_api_key
  // - verification images URLs
  // - personal identification data
  // - KBA data
  // - Stripe customer ID
  // - File paths/URLs
}

// Utility function to convert User to SafeUserDTO
export function toSafeUserDTO(user: User): SafeUserDTO {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    privileges: user.privileges,
    createdAt: user.createdAt,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber,
    address1: user.address1,
    address2: user.address2,
    city: user.city,
    state: user.state,
    zipCode: user.zipCode,
    companyId: user.companyId,
    companyRole: user.companyRole,
    title: user.title,
    commissionNumber: user.commissionNumber,
    commissionExpiration: user.commissionExpiration,
    county: user.county,
    notaryType: user.notaryType,
    isActive: user.isActive,
    accountBalance: user.accountBalance,
    profileSubmitted: user.profileSubmitted,
    approvalStatus: (user as any).approvalStatus || null,
    approvalNotes: (user as any).approvalNotes || null,
    isVerified: (user as any).isVerified || null,
    verificationStatus: (user as any).verificationStatus || null,
    lastLoginAt: user.lastLoginAt,
    updatedAt: (user as any).updatedAt || null,
    accountSetupComplete: (user as any).accountSetupComplete || null,
    nameOnCommission: (user as any).nameOnCommission || null,
    commissionAddress1: (user as any).commissionAddress1 || null,
    commissionAddress2: (user as any).commissionAddress2 || null,
    commissionCity: (user as any).commissionCity || null,
    commissionState: (user as any).commissionState || null,
    commissionZipCode: (user as any).commissionZipCode || null,
    commissionCounty: (user as any).commissionCounty || null,
    isNotarySigningAgent: (user as any).isNotarySigningAgent || null,
    notarySigningAgentExpiration: (user as any).notarySigningAgentExpiration || null,
    isSpanishSpeaking: (user as any).isSpanishSpeaking || null,
    foreignLanguages: (user as any).foreignLanguages || null,
    signingAgentCertified: (user as any).signingAgentCertified || null,
    signingAgentExpirationDate: (user as any).signingAgentExpirationDate || null,
    maxConcurrentJobs: (user as any).maxConcurrentJobs || null,
  };
}

// Job Participant with dual role support
export interface JobParticipant {
  id: number;
  jobId: number;
  userId: number | null;
  email: string;
  role: string; // Legacy role field - kept for compatibility
  jobSpecificRole: string; // Role for this specific job (e.g., 'signer', 'witness')
  primaryRole: string; // User's primary system role (e.g., 'notary', 'title_company')
  inviteStatus: 'pending' | 'accepted' | 'declined';
  inviteToken: string | null;
  joinedAt: Date | null;
  createdAt: Date;
  
  // ID Verification fields
  requiresIdVerification: boolean;
  idVerificationCompleted: boolean;
  idVerificationCompletedAt: Date | null;
  idVerificationBypassReason: string | null;
  idVerificationBypassedBy: number | null;
  idVerificationBypassedAt: Date | null;
}

// Enhanced Signer interface with dual role support
export interface EnhancedSigner {
  id: number;
  jobId: number;
  userId: number | null;
  signerName: string;
  signerEmail: string;
  signerPhoneNumber: string;
  signerRole: string; // 'borrower', 'co-borrower', 'seller', 'buyer'
  primaryUserRole: string | null; // User's primary system role
  invitationToken: string | null;
  invitationSentAt: Date | null;
  accessType: string;
  guestVerificationStatus: string;
  signingStatus: string;
  
  // ID Verification fields
  requiresIdVerification: boolean;
  idVerificationCompleted: boolean;
  idVerificationCompletedAt: Date | null;
  idVerificationMethod: string | null; // 'evs', 'admin_bypass', 'notary_bypass'
  createdAt: Date;
}

// Participant role summary for easy display
export interface ParticipantRoleSummary {
  id: number;
  jobId: number;
  userId: number | null;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  userSystemRole: string; // Primary role in the system
  jobRole: string; // Role for this specific job
  requiresIdVerification: boolean;
  idVerificationCompleted: boolean;
  inviteStatus: string;
  hasDualRole: boolean; // True if jobRole != userSystemRole
  verificationStatus: 'verification_required' | 'verified' | 'no_verification_needed';
}

// Role assignment request for API
export interface RoleAssignmentRequest {
  userId?: number;
  email: string;
  jobSpecificRole: 'signer' | 'witness' | 'observer' | 'notary' | 'title_agent';
  requiresIdVerification?: boolean;
  skipVerificationReason?: string; // For admin bypass
}

// Add more types as needed... 