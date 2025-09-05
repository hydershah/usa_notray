import { pgTable, text, serial, integer, boolean, timestamp, varchar, jsonb, unique, index, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - Enhanced for comprehensive user management
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("client"), // 'admin', 'notary', 'title_company', 'client', 'company_manager', 'signer', 'witness', 'observer'
  privileges: text("privileges").array(), // Array of specific privileges for granular control
  createdAt: timestamp("created_at").defaultNow(),
  
  // Universal Profile fields (required for all users)
  firstName: text("first_name"),
  lastName: text("last_name"),
  fullName: text("full_name"), // Combined first and last name for easier searching
  phoneNumber: text("phone_number"), // Cell phone from requirements
  
  // Address fields (required for signers to start sessions)
  address1: text("address_1"), // Must be completed to start a signing session
  address2: text("address_2"), // Must be completed to start a signing session
  city: text("city"), // Must be completed to start a signing session
  state: text("state"), // Must be completed to start a signing session
  zipCode: text("zip_code"), // Must be completed to start a signing session
  
  // Legacy address field for backward compatibility
  address: text("address"),
  
  // Company association
  companyId: integer("company_id").references(() => companies.id),
  companyRole: text("company_role"), // 'manager', 'user', 'authorized_user'
  
  // Notary-specific fields
  title: text("title"),
  commissionNumber: text("commission_number"),
  commissionExpiration: text("commission_expiration"),
  county: text("county_parish"), // County/Parish from requirements
  disclosure: text("disclosure"),
  signatureData: text("signature_data"), // Base64 encoded signature image (GIF)
  initialData: text("initial_data"), // Base64 encoded initial image (GIF)
  notaryType: text("notary_type"), // 'contractor', 'subscriber', or 'both' for notary role
  notaryIdCode: text("notary_id_code"), // System-generated ID code for notaries (CY0001, CY0002, etc.)
  isActive: boolean("is_active").default(true), // For admin to activate/deactivate users
  
  // Account Balance and Financial Management for Subscribers/Contractors
  accountBalance: integer("account_balance").default(0), // Balance in cents
  minimumBalance: integer("minimum_balance").default(2500), // $25.00 minimum for subscribers in cents
  availableBalance: integer("available_balance").default(0), // Available balance after pending transactions
  pendingBalance: integer("pending_balance").default(0), // Contractor pending payments in cents
  totalEarnings: integer("total_earnings").default(0), // Total lifetime earnings in cents
  totalSpent: integer("total_spent").default(0), // Total lifetime spending in cents
  stripeCustomerId: text("stripe_customer_id"), // Stripe customer ID for payment processing
  
  // Notary qualifications for random assignment
  isNotarySigningAgent: boolean("is_notary_signing_agent").default(false), // NSA qualification
  notarySigningAgentExpiration: text("nsa_expiration_date"), // NSA expiration date
  isSpanishSpeaking: boolean("is_spanish_speaking").default(false), // Spanish speaking capability
  foreignLanguages: text("foreign_languages").array(), // Array of languages: Spanish, Italian, French, Portuguese, German, Mandarin
  maxConcurrentJobs: integer("max_concurrent_jobs").default(1), // How many jobs they can handle at once
  
  // Enhanced Notary Profile Fields (from requirements)
  nameOnCommission: text("name_on_commission"),
  commissionAddress1: text("commission_address_1"),
  commissionAddress2: text("commission_address_2"),
  commissionCity: text("commission_city"),
  commissionState: text("commission_state"),
  commissionZipCode: text("commission_zip_code"),
  commissionCounty: text("commission_county"),
  
  // Document uploads and certifications (file paths)
  notaryCommissionFile: text("notary_commission_file"), // File upload path
  eoInsuranceCompany: text("eo_insurance_company"),
  eoInsuranceAmount: integer("eo_insurance_amount"), // Amount in cents
  eoInsuranceExpiration: text("eo_insurance_expiration"),
  eoInsuranceFile: text("eo_insurance_file"), // File upload path
  publicCertificateExpiration: text("public_certificate_expiration"),
  publicCertificateFile: text("public_certificate_file"), // File upload path
  publicCertificatePassword: text("public_certificate_password"),
  bondCompanyName: text("bond_company_name"),
  bondAmount: integer("bond_amount"), // Amount in cents
  bondExpiration: text("bond_expiration"),
  bondFile: text("bond_file"), // File upload path
  signingAgentCertified: boolean("signing_agent_certified").default(false),
  signingAgentExpirationDate: text("signing_agent_expiration_date"),
  signingAgentFile: text("signing_agent_file"), // File upload path
  
  // ID Verification fields (populated by ID verification tool)
  idType: text("id_type"), // 'drivers_license', 'passport', 'state_id_card'
  idNumber: text("id_number"), // From ID verification tool
  idExpirationDate: text("id_expiration_date"), // From ID verification tool
  idIssueDate: text("id_issue_date"), // From ID verification tool
  
  // Basic verification status
  isVerified: boolean("is_verified").default(false),
  verificationStatus: text("verification_status").default("pending"), // 'pending', 'approved', 'denied', 'review'
  
  // EVS Verification comprehensive data
  evsTransactionId: text("evs_transaction_id"),
  evsVerificationConfidence: integer("evs_verification_confidence"), // Confidence score from EVS (0-100)
  evsVerifiedAt: timestamp("evs_verified_at"),
  
  // Extracted document data from EVS
  evsExtractedFirstName: text("evs_extracted_first_name"),
  evsExtractedLastName: text("evs_extracted_last_name"),
  evsExtractedFullName: text("evs_extracted_full_name"),
  evsExtractedDateOfBirth: text("evs_extracted_date_of_birth"),
  evsExtractedAddress: text("evs_extracted_address"),
  
  // Biometric verification data from EVS
  evsFaceMatchResult: boolean("evs_face_match_result"),
  evsFaceMatchConfidence: integer("evs_face_match_confidence"), // Face matching confidence (0-100)
  evsLivenessScore: integer("evs_liveness_score"), // Liveness detection score (0-100)
  
  // EVS verification status and metadata
  evsVerificationErrors: text("evs_verification_errors").array(), // Array of error messages
  evsVerificationWarnings: text("evs_verification_warnings").array(), // Array of warning messages
  evsDocumentTypeDetected: text("evs_document_type_detected"), // Document type detected by EVS
  evsVerificationMethod: text("evs_verification_method").default("api"), // 'api', 'manual', 'fallback'
  
  // Verification image URLs stored in Vultr
  verificationImageFrontUrl: text("verification_image_front_url"), // Front ID image URL
  verificationImageBackUrl: text("verification_image_back_url"), // Back ID image URL  
  verificationImageSelfieUrl: text("verification_image_selfie_url"), // Selfie image URL
  
  // Additional metadata
  verificationIpAddress: text("verification_ip_address"), // IP address during verification
  verificationUserAgent: text("verification_user_agent"), // Browser/device info during verification
  verificationRetryCount: integer("verification_retry_count").default(0), // Number of verification attempts
  
  // Admin verification bypass functionality
  verificationBypassedBy: integer("verification_bypassed_by").references(() => users.id), // Admin who bypassed verification
  verificationBypassedAt: timestamp("verification_bypassed_at"), // When verification was bypassed
  verificationBypassReason: text("verification_bypass_reason"), // Reason for bypassing verification
  isVerificationBypassed: boolean("is_verification_bypassed").default(false), // Whether verification was manually bypassed
  
  // Digital Certificate
  digitalCertificateFile: text("digital_certificate_file"), // PFX file path
  digitalCertificateExpiration: text("digital_certificate_expiration"),
  
  // Admin approval system for notaries
  approvalStatus: text("approval_status").default("pending"), // 'pending', 'approved', 'rejected', 'requires_update'
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  lastProfileUpdate: timestamp("last_profile_update").defaultNow(),
  approvalNotes: text("approval_notes"),
  
  // Notification and status fields
  isNotificationsEnabled: boolean("is_notifications_enabled").default(true),
  lastLoginAt: timestamp("last_login_at"),
  
  // MFA and Security
  mfaEnabled: boolean("mfa_enabled").default(false),
  mfaSecret: text("mfa_secret"),
  googleId: text("google_id"), // For Google login capability
  
  // KBA (Knowledge-Based Authentication) verification
  kbaVerified: boolean("kba_verified").default(false),
  kbaVerificationDate: timestamp("kba_verification_date"),
  kbaScore: integer("kba_score"), // 0-100 score from KBA verification
  kbaProvider: text("kba_provider"), // 'evs', 'lexisnexis', 'transunion'
  kbaSessionsCompleted: integer("kba_sessions_completed").default(0),
  
  // KBA attempt tracking and lockout system
  kbaAttemptsUsed: integer("kba_attempts_used").default(0), // Number of KBA attempts used
  kbaLockedUntil: timestamp("kba_locked_until"), // When KBA lockout expires
  kbaLockoutReason: text("kba_lockout_reason"), // Reason for lockout
  kbaLastAttemptDate: timestamp("kba_last_attempt_date"), // Last KBA attempt date
  
  // Timestamps
  updatedAt: timestamp("updated_at").defaultNow(),
  
  // Notary verification bypass fields
  notaryVerificationBypassed: boolean("notary_verification_bypassed").default(false),
  notaryVerificationBypassedBy: integer("notary_verification_bypassed_by").references(() => users.id),
  notaryVerificationBypassedAt: timestamp("notary_verification_bypassed_at"),
  notaryVerificationBypassJobId: integer("notary_verification_bypassed_job_id"), // References jobs.id
  notaryVerificationBypassReason: text("notary_verification_bypass_reason"),
  
  // Signature data for live signing sessions
  signatureImage: text("signature_image"), // Base64 signature image for auto-fill
  initialsImage: text("initials_image"), // Base64 initials image for auto-fill
  signatureTyped: text("signature_typed"), // Typed signature text
  initialsTyped: text("initials_typed"), // Typed initials text
  defaultSignatureType: varchar("default_signature_type", { length: 20 }).default('draw'), // 'draw', 'type', or 'upload'
  
  // Profile completion tracking
  profileSubmitted: boolean("profile_submitted").default(false), // Track if user has gone through profile completion process
  
  // Account setup completion tracking
  accountSetupComplete: boolean("account_setup_complete").default(false)
});

// Companies table - Enhanced for comprehensive company management  
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  // Primary company information
  companyName: text("company_name").notNull(),
  
  // Primary user (company manager) - created during initial registration
  primaryUserName: text("primary_user_name").notNull(),
  primaryUserEmail: text("primary_user_email").notNull(),
  // Note: primaryUserPassword handled in users table
  
  // Company address
  address1: text("address_1").notNull(),
  address2: text("address_2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  
  // Billing address (optional - defaults to company address if not provided)
  billingAddress1: text("billing_address_1"),
  billingAddress2: text("billing_address_2"),
  billingCity: text("billing_city"),
  billingState: text("billing_state"),
  billingZipCode: text("billing_zip_code"),
  
  // Payment method
  paymentMethod: text("payment_method").notNull(), // 'invoiced', 'qualia', 'pre_pay'
  
  // Contact and operational information  
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phoneNumber: text("phone_number"),
  
  // Status and preferences
  status: text("status").notNull().default("active"), // 'active', 'inactive', 'suspended'
  preferredNotaryId: integer("preferred_notary_id").references(() => users.id), // Default notary for this company
  
  // Company manager (primary user who can manage the company)
  companyManagerId: integer("company_manager_id").references(() => users.id),
  
  // Authorized users (array of user IDs who can place orders for the company)
  authorizedUserIds: integer("authorized_user_ids").array().default([]),
  
  // Billing and subscription information
  subscriptionPlan: text("subscription_plan"), // For future subscription features
  billingCycle: text("billing_cycle"), // 'monthly', 'yearly'
  nextBillingDate: timestamp("next_billing_date"),
  
  // Company settings
  defaultClosingType: text("default_closing_type"),
  allowUserSelfRegistration: boolean("allow_user_self_registration").default(false),
  requiresApprovalForNewUsers: boolean("requires_approval_for_new_users").default(true),
  
  // Approval fields
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  approvalNotes: text("approval_notes"),

  // Audit fields
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
  lastModifiedBy: integer("last_modified_by").references(() => users.id),
});

// Title companies table - Keep for backward compatibility, but mark as legacy
export const titleCompanies = pgTable("title_companies", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  city: text("city").notNull(),
  status: text("status").notNull().default("active"), // 'active', 'inactive'
  preferredNotaryId: integer("preferred_notary_id").references(() => users.id), // Default notary for this company
  createdAt: timestamp("created_at").defaultNow(),
  // Migration flag to identify which companies have been migrated to the new system
  migratedToCompaniesTable: boolean("migrated_to_companies_table").default(false),
});

// Title Company Notary Assignments - Many-to-Many relationship
export const titleCompanyNotaryAssignments = pgTable("title_company_notary_assignments", {
  id: serial("id").primaryKey(),
  titleCompanyId: integer("title_company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  notaryId: integer("notary_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  isDefault: boolean("is_default").default(false).notNull(),
  assignedBy: integer("assigned_by").references(() => users.id),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  notes: text("notes"),
  status: text("status").default("active").notNull(), // 'active', 'inactive'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
}, (table) => ({
  // Ensure no duplicate assignments
  titleCompanyNotaryUnique: unique().on(table.titleCompanyId, table.notaryId),
}));

// Legacy Title Company Notary Assignments - For backward compatibility
export const legacyTitleCompanyNotaryAssignments = pgTable("legacy_title_company_notary_assignments", {
  id: serial("id").primaryKey(),
  titleCompanyId: integer("title_company_id").notNull().references(() => titleCompanies.id, { onDelete: "cascade" }),
  notaryId: integer("notary_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  isDefault: boolean("is_default").default(false).notNull(),
  assignedBy: integer("assigned_by").references(() => users.id),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  notes: text("notes"),
  status: text("status").default("active").notNull(), // 'active', 'inactive'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
}, (table) => ({
  // Ensure no duplicate assignments
  legacyTitleCompanyNotaryUnique: unique().on(table.titleCompanyId, table.notaryId),
}));

// Jobs table
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  titleCompany: text("title_company").notNull(),
  closingType: text("closing_type").notNull(),
  internalReference: text("internal_reference"),
  kbaRequired: boolean("kba_required").default(false),
  propertyAddressOne: text("property_address_one").notNull(),
  propertyAddressTwo: text("property_address_two"),
  propertyCity: text("property_city").notNull(),
  propertyState: text("property_state").notNull(),
  propertyZipCode: text("property_zip_code").notNull(),
  notaryOption: text("notary_option"), // 'assign', 'auto'
  selectedNotary: text("selected_notary"),
  selectedDate: text("selected_date"),
  selectedTime: text("selected_time"),
  uploadedFile: text("uploaded_file"),
  notarizedFile: text("notarized_file"),
  // Screen recording fields for live signing sessions
  recordingFileKey: text("recording_file_key"), // Vultr storage key for session recording
  recordingFileUrl: text("recording_file_url"), // Vultr URL for session recording
  recordingFileName: text("recording_file_name"), // Original filename of recording
  recordingDuration: integer("recording_duration"), // Recording duration in seconds
  recordingStartedAt: timestamp("recording_started_at"), // When recording started
  recordingUploadedAt: timestamp("recording_uploaded_at"), // When recording was uploaded to Vultr
  recordingParticipantCount: integer("recording_participant_count"), // Number of participants during recording
  recordingSessionId: text("recording_session_id"), // Editor session ID during recording
  recordingLiveSessionId: text("recording_live_session_id"), // Live session ID during recording
  recordingMetadata: jsonb("recording_metadata"), // Additional recording metadata (participants, session details, etc.)
  jobStatus: text("job_status").notNull().default("open"), // 'open', 'pending', 'completed', 'cancelled', 'expired', 'request_pending', 'request_approved', 'request_rejected'
  userId: integer("user_id").references(() => users.id),
  sessionToken: text("session_token"),
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
  completedBy: integer("completed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  // Random notary assignment fields
  requiresNSA: boolean("requires_nsa").default(false), // Job requires Notary Signing Agent
  requiresSpanishSpeaking: boolean("requires_spanish_speaking").default(false), // Job requires Spanish speaking notary
  assignmentAttempts: integer("assignment_attempts").default(0), // Track how many random assignments tried
  rejectedNotaries: text("rejected_notaries").array().default([]), // IDs of notaries who rejected this job
  isRandomAssignment: boolean("is_random_assignment").default(false), // Track if this job uses random assignment
  notaryId: integer("notary_id").references(() => users.id), // Assigned notary ID (cleaner than selectedNotary string)
  // Approval workflow fields
  notaryApprovalStatus: text("notary_approval_status").default("pending_assignment").notNull(), // 'pending_assignment', 'assigned_pending_approval', 'approved', 'rejected', 'approved_with_conditions'
  notaryApprovedAt: timestamp("notary_approved_at"),
  notaryApprovalNotes: text("notary_approval_notes"),
  notaryApprovalConditions: text("notary_approval_conditions"),
  signerNotificationsSent: boolean("signer_notifications_sent").default(false),
  signerNotificationsSentAt: timestamp("signer_notifications_sent_at"),
  // Job type for billing and workflow differentiation
  jobType: text("job_type").default("title_company"), // 'title_company', 'subscriber_personal'
  completionReportPath: text('completion_report_path'),
  completionReportGeneratedAt: timestamp('completion_report_generated_at'),
  auditTrailReportPath: text('audit_trail_report_path'),
  auditTrailGeneratedAt: timestamp('audit_trail_generated_at'),
  // Signer request fields
  isSignerRequest: boolean("is_signer_request").default(false), // Indicates if this job was initiated by a signer
  signerRequestNotes: text("signer_request_notes"), // Additional notes from signer about the request
  adminReviewNotes: text("admin_review_notes"), // Admin's review notes when approving/rejecting
  adminReviewedBy: integer("admin_reviewed_by").references(() => users.id), // Admin who reviewed the request
  adminReviewedAt: timestamp("admin_reviewed_at"), // When admin reviewed the request
  requestPriority: text("request_priority").default("normal"), // 'low', 'normal', 'high', 'urgent'
});

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// OTP Verification table for email verification during registration
export const otpVerifications = pgTable("otp_verifications", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  otpCode: text("otp_code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false).notNull(),
  attempts: integer("attempts").default(0).notNull(),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  verifiedAt: timestamp("verified_at"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
});

// User signatures table - for tracking signature history
export const userSignatures = pgTable("user_signatures", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(), // User-provided name for the signature
  signatureType: varchar("signature_type", { length: 20 }).notNull(), // 'signature' or 'initials'
  type: varchar("type", { length: 20 }).notNull(), // 'uploaded', 'drawn', 'generated'
  imageUrl: text("image_url").notNull(), // Vultr URL or base64 data
  metadata: jsonb("metadata"), // Additional metadata (font, style, etc.)
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
});

// User verification attempts table - for tracking verification history
export const userVerificationAttempts = pgTable("user_verification_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  
  // EVS API response data
  evsTransactionId: text("evs_transaction_id"),
  status: text("status").notNull(), // 'approved', 'denied', 'review', 'error'
  confidenceScore: integer("confidence_score"),
  
  // Document information
  documentType: text("document_type"),
  frontImageUploaded: boolean("front_image_uploaded").default(false),
  backImageUploaded: boolean("back_image_uploaded").default(false),
  selfieUploaded: boolean("selfie_uploaded").default(false),
  
  // Extracted data from this attempt
  extractedFirstName: text("extracted_first_name"),
  extractedLastName: text("extracted_last_name"),
  extractedDateOfBirth: text("extracted_date_of_birth"),
  extractedDocumentNumber: text("extracted_document_number"),
  extractedExpirationDate: text("extracted_expiration_date"),
  extractedAddress: text("extracted_address"),
  
  // Biometric results
  faceMatchResult: boolean("face_match_result"),
  faceMatchConfidence: integer("face_match_confidence"),
  livenessScore: integer("liveness_score"),
  
  // Verification details
  errors: text("errors").array(),
  warnings: text("warnings").array(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  // Metadata
  attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
  processingTimeMs: integer("processing_time_ms"), // How long verification took
  apiEnvironment: text("api_environment").default("sandbox"), // 'sandbox' or 'production'
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// KBA Sessions table - for tracking knowledge-based authentication sessions
export const kbaSessions = pgTable("kba_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  userId: integer("user_id").references(() => users.id).notNull(),
  status: text("status").notNull().default("initialized"), // 'initialized', 'ready', 'completed', 'failed', 'expired'
  questionsCount: integer("questions_count").notNull(),
  questionsAnswered: integer("questions_answered").default(0),
  correctAnswers: integer("correct_answers").default(0),
  score: integer("score").default(0), // 0-100 score
  provider: text("provider").notNull(), // 'evs', 'lexisnexis', 'transunion'
  expiresAt: timestamp("expires_at").notNull(),
  completedAt: timestamp("completed_at"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Signers table
export const signers = pgTable("signers", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id),
  userId: integer("user_id").references(() => users.id), // Link to user account
  signerName: text("signer_name").notNull(),
  signerEmail: text("signer_email").notNull(),
  signerPhoneNumber: text("signer_phone_number").notNull(),
  signerRole: text("signer_role").notNull(), // 'borrower', 'co-borrower', 'seller', 'buyer'
  invitationToken: text("invitation_token"),
  invitationSentAt: timestamp("invitation_sent_at"),
  accessType: text("access_type").default("registered"), // Now all signers get registered accounts
  guestVerificationStatus: text("guest_verification_status").default("pending"), // 'pending', 'verified', 'failed'
  signingStatus: text("signing_status").default("pending"), // 'pending', 'in_progress', 'completed', 'declined'
  createdAt: timestamp("created_at").defaultNow(),
});

// Job participants table for session access control
export const jobParticipants = pgTable("job_participants", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id),
  userId: integer("user_id").references(() => users.id),
  email: text("email").notNull(),
  role: text("role").notNull(), // 'notary', 'signer', 'witness', 'title_agent'
  inviteStatus: text("invite_status").notNull().default("pending"), // 'pending', 'accepted', 'declined'
  inviteToken: text("invite_token"),
  joinedAt: timestamp("joined_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Job documents table for multiple document support
export const jobDocuments = pgTable("job_documents", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(), // Size in bytes
  mimeType: text("mime_type").notNull(),
  documentType: text("document_type").notNull().default("original"), // 'original', 'notarized', 'additional'
  status: text("status").notNull().default("uploaded"), // 'uploaded', 'processing', 'ready', 'signed'
  uploadedBy: integer("uploaded_by").references(() => users.id),
  isRequired: boolean("is_required").default(false),
  signaturePages: text("signature_pages").array().default([]), // Array of page numbers requiring signatures
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Participant Roles table for configurable signer roles
export const participantRoles = pgTable("participant_roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // 'borrower', 'co-borrower', 'seller', 'buyer', 'witness', etc.
  displayName: text("display_name").notNull(), // 'Borrower (Signs documents)', 'Co-Borrower (Signs documents)', etc.
  description: text("description"), // Optional description of what this role does
  category: text("category").default("signer").notNull(), // 'signer', 'witness', 'observer'
  requiresSignature: boolean("requires_signature").default(true), // Whether this role needs to sign documents
  requiresIdVerification: boolean("requires_id_verification").default(true), // Whether this role needs ID verification
  isActive: boolean("is_active").default(true), // Admin can enable/disable roles
  sortOrder: integer("sort_order").default(0), // For ordering in dropdowns
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  jobs: many(jobs),
  uploadedDocuments: many(jobDocuments),
  notaryStamps: many(notaryStamps),
  notaryAvailability: many(notaryAvailability),
  notaryTimeSlots: many(notaryTimeSlots),
  notaryWorkingHours: many(notaryWorkingHours),
  calendarEvents: many(calendarEvents),
  assignmentLogs: many(notaryAssignmentLog),
  passwordResetTokens: many(passwordResetTokens),
  signers: many(signers),
  jobNotifications: many(jobNotifications),
  approvalQueue: many(notaryApprovalQueue),
  verificationAttempts: many(userVerificationAttempts),
  kbaSessions: many(kbaSessions),
  // Financial relationships
  accountTransactions: many(accountTransactions),
  contractorPayments: many(contractorPayments),
  subscriberJobFeeBreakdowns: many(jobFeeBreakdowns, {
    relationName: "SubscriberNotary"
  }),
  stripeWebhookEvents: many(stripeWebhookEvents),
  // Company relationships
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id]
  }),
  managedCompanies: many(companies, {
    relationName: "CompanyManager"
  }),
  createdCompanies: many(companies, {
    relationName: "CompanyCreator"
  }),
  modifiedCompanies: many(companies, {
    relationName: "CompanyModifier"
  }),
  preferredByCompanies: many(companies, {
    relationName: "PreferredNotary"
  }),
  // Legacy title companies
  preferredByTitleCompanies: many(titleCompanies, {
    relationName: "PreferredNotary"
  }),
  // Title company notary assignments
  titleCompanyAssignments: many(titleCompanyNotaryAssignments),
  legacyTitleCompanyAssignments: many(legacyTitleCompanyNotaryAssignments),
  // Approval relationships
  approvedUsers: many(users, {
    relationName: "ApprovedBy"
  }),
  approver: one(users, {
    fields: [users.approvedBy],
    references: [users.id],
    relationName: "ApprovedBy"
  }),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  preferredNotary: one(users, {
    fields: [companies.preferredNotaryId],
    references: [users.id],
    relationName: "PreferredNotary"
  }),
  companyManager: one(users, {
    fields: [companies.companyManagerId],
    references: [users.id],
    relationName: "CompanyManager"
  }),
  approvedBy: one(users, {
    fields: [companies.approvedBy],
    references: [users.id],
    relationName: "CompanyApprover"
  }),
  createdBy: one(users, {
    fields: [companies.createdBy],
    references: [users.id],
    relationName: "CompanyCreator"
  }),
  lastModifiedBy: one(users, {
    fields: [companies.lastModifiedBy],
    references: [users.id],
    relationName: "CompanyModifier"
  }),
  users: many(users),
  notaryAssignments: many(titleCompanyNotaryAssignments),
}));

export const titleCompaniesRelations = relations(titleCompanies, ({ one, many }) => ({
  preferredNotary: one(users, {
    fields: [titleCompanies.preferredNotaryId],
    references: [users.id],
    relationName: "PreferredNotary"
  }),
  notaryAssignments: many(legacyTitleCompanyNotaryAssignments),
}));

export const titleCompanyNotaryAssignmentsRelations = relations(titleCompanyNotaryAssignments, ({ one }) => ({
  titleCompany: one(companies, {
    fields: [titleCompanyNotaryAssignments.titleCompanyId],
    references: [companies.id],
  }),
  notary: one(users, {
    fields: [titleCompanyNotaryAssignments.notaryId],
    references: [users.id],
  }),
  assignedByUser: one(users, {
    fields: [titleCompanyNotaryAssignments.assignedBy],
    references: [users.id],
    relationName: "AssignedBy"
  }),
  updatedByUser: one(users, {
    fields: [titleCompanyNotaryAssignments.updatedBy],
    references: [users.id],
    relationName: "UpdatedBy"
  }),
}));

export const legacyTitleCompanyNotaryAssignmentsRelations = relations(legacyTitleCompanyNotaryAssignments, ({ one }) => ({
  titleCompany: one(titleCompanies, {
    fields: [legacyTitleCompanyNotaryAssignments.titleCompanyId],
    references: [titleCompanies.id],
  }),
  notary: one(users, {
    fields: [legacyTitleCompanyNotaryAssignments.notaryId],
    references: [users.id],
  }),
  assignedByUser: one(users, {
    fields: [legacyTitleCompanyNotaryAssignments.assignedBy],
    references: [users.id],
    relationName: "AssignedBy"
  }),
  updatedByUser: one(users, {
    fields: [legacyTitleCompanyNotaryAssignments.updatedBy],
    references: [users.id],
    relationName: "UpdatedBy"
  }),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  user: one(users, {
    fields: [jobs.userId],
    references: [users.id],
  }),
  assignedNotary: one(users, {
    fields: [jobs.notaryId],
    references: [users.id],
    relationName: "AssignedNotary"
  }),
  signers: many(signers),
  participants: many(jobParticipants),
  documents: many(jobDocuments),
  assignmentLogs: many(notaryAssignmentLog),
  notifications: many(jobNotifications),
  approvalQueue: many(notaryApprovalQueue),
}));

export const signersRelations = relations(signers, ({ one }) => ({
  job: one(jobs, {
    fields: [signers.jobId],
    references: [jobs.id],
  }),
  user: one(users, {
    fields: [signers.userId],
    references: [users.id],
  }),
}));

export const jobParticipantsRelations = relations(jobParticipants, ({ one }) => ({
  job: one(jobs, {
    fields: [jobParticipants.jobId],
    references: [jobs.id],
  }),
  user: one(users, {
    fields: [jobParticipants.userId],
    references: [users.id],
  }),
}));

export const jobDocumentsRelations = relations(jobDocuments, ({ one }) => ({
  job: one(jobs, {
    fields: [jobDocuments.jobId],
    references: [jobs.id],
  }),
  uploadedBy: one(users, {
    fields: [jobDocuments.uploadedBy],
    references: [users.id],
  }),
}));

export const kbaSessionsRelations = relations(kbaSessions, ({ one }) => ({
  user: one(users, {
    fields: [kbaSessions.userId],
    references: [users.id],
  }),
}));

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  payerId: integer("payer_id").references(() => users.id).notNull(),
  payeeId: integer("payee_id").references(() => users.id).notNull(),
  amount: integer("amount").notNull(), // Amount in cents
  currency: text("currency").default("USD").notNull(),
  description: text("description").notNull(),
  status: text("status").default("pending").notNull(), // 'pending', 'completed', 'failed', 'refunded'
  paymentMethod: text("payment_method"), // 'credit_card', 'bank_transfer', 'cash', 'check'
  transactionId: text("transaction_id"),
  invoiceNumber: text("invoice_number"),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  clientId: integer("client_id").references(() => users.id).notNull(),
  notaryId: integer("notary_id").references(() => users.id).notNull(),
  invoiceNumber: text("invoice_number").unique().notNull(),
  description: text("description").notNull(),
  subtotal: integer("subtotal").notNull(), // Amount in cents
  taxAmount: integer("tax_amount").default(0).notNull(),
  totalAmount: integer("total_amount").notNull(),
  status: text("status").default("draft").notNull(), // 'draft', 'sent', 'paid', 'overdue', 'cancelled'
  dueDate: timestamp("due_date").notNull(),
  sentAt: timestamp("sent_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const paymentSchedules = pgTable("payment_schedules", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  totalAmount: integer("total_amount").notNull(),
  paidAmount: integer("paid_amount").default(0).notNull(),
  remainingAmount: integer("remaining_amount").notNull(),
  installments: integer("installments").default(1).notNull(),
  currentInstallment: integer("current_installment").default(1).notNull(),
  nextPaymentDate: timestamp("next_payment_date"),
  status: text("status").default("active").notNull(), // 'active', 'completed', 'defaulted'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const paymentsRelations = relations(payments, ({ one }) => ({
  job: one(jobs, {
    fields: [payments.jobId],
    references: [jobs.id],
  }),
  payer: one(users, {
    fields: [payments.payerId],
    references: [users.id],
  }),
  payee: one(users, {
    fields: [payments.payeeId],
    references: [users.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  job: one(jobs, {
    fields: [invoices.jobId],
    references: [jobs.id],
  }),
  client: one(users, {
    fields: [invoices.clientId],
    references: [users.id],
  }),
  notary: one(users, {
    fields: [invoices.notaryId],
    references: [users.id],
  }),
}));

export const paymentSchedulesRelations = relations(paymentSchedules, ({ one }) => ({
  job: one(jobs, {
    fields: [paymentSchedules.jobId],
    references: [jobs.id],
  }),
}));

export const closingTypes = pgTable("closing_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  basePrice: integer("base_price").notNull(), // Price in cents
  isActive: boolean("is_active").default(true).notNull(),
  estimatedDuration: integer("estimated_duration"), // Duration in minutes
  requiresWitness: boolean("requires_witness").default(false),
  requiresNotaryTravel: boolean("requires_notary_travel").default(false),
  travelFee: integer("travel_fee").default(0), // Additional travel fee in cents
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const closingTypesRelations = relations(closingTypes, ({ many }) => ({
  jobs: many(jobs),
}));

export const systemSettings = pgTable("system_settings", {
  key: varchar("key").primaryKey(),
  value: text("value").notNull(),
  type: text("type").default("string").notNull(), // 'string', 'number', 'boolean', 'json'
  description: text("description"),
  isProtected: boolean("is_protected").default(false).notNull(), // Prevent deletion of critical settings
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Notary Stamps table
export const notaryStamps = pgTable("notary_stamps", {
  id: serial("id").primaryKey(),
  notaryId: integer("notary_id").references(() => users.id).notNull(),
  stampType: text("stamp_type").notNull(), // 'notary', 'jurat', 'acknowledgment', 'custom'
  stampData: text("stamp_data"), // Base64 encoded stamp image or SVG data
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notaryStampsRelations = relations(notaryStamps, ({ one }) => ({
  notary: one(users, {
    fields: [notaryStamps.notaryId],
    references: [users.id],
  }),
}));

// Calendar/Availability System
export const notaryAvailability = pgTable("notary_availability", {
  id: serial("id").primaryKey(),
  notaryId: integer("notary_id").references(() => users.id).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  startTime: text("start_time").notNull(), // HH:MM format
  endTime: text("end_time").notNull(), // HH:MM format
  isRecurring: boolean("is_recurring").default(false),
  recurringPattern: text("recurring_pattern"), // 'daily', 'weekly', 'monthly'
  recurringDays: text("recurring_days").array(), // ['monday', 'tuesday', etc.]
  recurringEndDate: text("recurring_end_date"), // YYYY-MM-DD format
  timezone: text("timezone").default("America/Los_Angeles"),
  maxConcurrentJobs: integer("max_concurrent_jobs").default(1),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notaryTimeSlots = pgTable("notary_time_slots", {
  id: serial("id").primaryKey(),
  notaryId: integer("notary_id").references(() => users.id).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  startTime: text("start_time").notNull(), // HH:MM format
  endTime: text("end_time").notNull(), // HH:MM format
  status: text("status").default("available").notNull(), // 'available', 'busy', 'blocked', 'booked'
  jobId: integer("job_id").references(() => jobs.id), // Reference to job if booked
  blockReason: text("block_reason"), // Reason for manual block (vacation, personal, etc.)
  timezone: text("timezone").default("America/Los_Angeles"),
  isManualBlock: boolean("is_manual_block").default(false), // true if manually blocked by notary
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notaryWorkingHours = pgTable("notary_working_hours", {
  id: serial("id").primaryKey(),
  notaryId: integer("notary_id").references(() => users.id).notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday, 1=Monday, etc.
  startTime: text("start_time").notNull(), // HH:MM format
  endTime: text("end_time").notNull(), // HH:MM format
  isActive: boolean("is_active").default(true),
  timezone: text("timezone").default("America/Los_Angeles"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Calendar events for notary personal tracking
export const calendarEvents = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  notaryId: integer("notary_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startDateTime: timestamp("start_date_time").notNull(),
  endDateTime: timestamp("end_date_time").notNull(),
  location: text("location"),
  eventType: text("event_type").default("personal").notNull(), // 'personal', 'job', 'appointment', 'vacation'
  isAllDay: boolean("is_all_day").default(false),
  jobId: integer("job_id").references(() => jobs.id), // If event is related to a job
  reminders: jsonb("reminders"), // Array of reminder settings
  isRecurring: boolean("is_recurring").default(false),
  recurringPattern: jsonb("recurring_pattern"), // Recurring pattern details
  googleEventId: text("google_event_id"), // For future Google Calendar integration
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Notary assignment log for tracking assignment history
export const notaryAssignmentLog = pgTable("notary_assignment_log", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  notaryId: integer("notary_id").references(() => users.id).notNull(),
  assignmentType: text("assignment_type").notNull(), // 'manual', 'random', 'preferred', 'subscriber_self'
  assignmentStatus: text("assignment_status").notNull(), // 'assigned', 'accepted', 'rejected', 'completed'
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Job notifications table for enhanced notification system
export const jobNotifications = pgTable("job_notifications", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  recipientId: integer("recipient_id").references(() => users.id).notNull(),
  recipientEmail: text("recipient_email").notNull(),
  notificationType: text("notification_type").notNull(), // 'job_assignment', 'approval_request', 'approval_granted', 'signer_invite', 'job_reminder', 'job_completed'
  status: text("status").default("pending").notNull(), // 'pending', 'sent', 'failed', 'opened', 'clicked'
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata"), // Additional notification data
  sentAt: timestamp("sent_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Notary approval queue table for better tracking
export const notaryApprovalQueue = pgTable("notary_approval_queue", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  notaryId: integer("notary_id").references(() => users.id).notNull(),
  titleCompany: text("title_company").notNull(),
  priority: text("priority").default("normal").notNull(), // 'low', 'normal', 'high', 'urgent'
  deadline: timestamp("deadline"),
  specialInstructions: text("special_instructions"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueJobNotary: unique("unique_job_notary").on(table.jobId, table.notaryId)
}));

// Fee Configuration Table - Define the fee structure from business requirements
export const feeConfigurations = pgTable("fee_configurations", {
  id: serial("id").primaryKey(),
  feeType: text("fee_type").notNull(), // 'platform_base', 'additional_id', 'extended_time', 'title_closing_seller', 'title_closing_buyer', 'title_closing_buyer_loans', 'single_document', 'additional_document', 'additional_signer_single', 'additional_signer_title', 'witness_provided', 'witness_client_provided'
  amount: integer("amount").notNull(), // Amount in cents
  currency: text("currency").default("USD").notNull(),
  description: text("description").notNull(),
  isActive: boolean("is_active").default(true),
  applicableToRole: text("applicable_to_role"), // 'subscriber', 'contractor', 'both'
  metadata: jsonb("metadata"), // Additional configuration like duration limits, thresholds, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Account Transactions Table - Track all balance changes
export const accountTransactions = pgTable("account_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  transactionType: text("transaction_type").notNull(), // 'deposit', 'withdrawal', 'fee_deduction', 'contractor_payment', 'platform_fee', 'refund'
  amount: integer("amount").notNull(), // Amount in cents (positive for credits, negative for debits)
  balanceBefore: integer("balance_before").notNull(), // Account balance before transaction
  balanceAfter: integer("balance_after").notNull(), // Account balance after transaction
  description: text("description").notNull(),
  jobId: integer("job_id").references(() => jobs.id), // Associated job if applicable
  paymentMethod: text("payment_method"), // 'stripe', 'bank_transfer', 'manual'
  stripeTransactionId: text("stripe_transaction_id"), // Stripe payment intent/transfer ID
  status: text("status").default("pending").notNull(), // 'pending', 'completed', 'failed', 'cancelled'
  metadata: jsonb("metadata"), // Additional transaction details
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Contractor Payments Table - Track the 55% payments and delayed payment status
export const contractorPayments = pgTable("contractor_payments", {
  id: serial("id").primaryKey(),
  contractorId: integer("contractor_id").references(() => users.id).notNull(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  totalJobFee: integer("total_job_fee").notNull(), // Total amount charged to client in cents
  contractorPercentage: integer("contractor_percentage").default(55).notNull(), // Percentage contractor receives (default 55%)
  contractorAmount: integer("contractor_amount").notNull(), // Amount contractor will receive (55% of total)
  platformFee: integer("platform_fee").notNull(), // Platform fee (45% of total)
  paymentStatus: text("payment_status").default("pending").notNull(), // 'pending', 'paid_by_client', 'available_for_payout', 'paid_to_contractor', 'failed'
  clientPaymentDate: timestamp("client_payment_date"), // When client paid the invoice
  availableForPayoutDate: timestamp("available_for_payout_date"), // When payment becomes available for contractor
  paidToContractorDate: timestamp("paid_to_contractor_date"), // When contractor was actually paid
  stripeTransferId: text("stripe_transfer_id"), // Stripe transfer ID for contractor payment
  delayReason: text("delay_reason"), // Reason for payment delay (e.g., "Waiting for title company payment")
  estimatedPayoutDate: timestamp("estimated_payout_date"), // Estimated date when payment will be available
  invoiceNumber: text("invoice_number"), // Client invoice number reference
  metadata: jsonb("metadata"), // Additional payment details
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Job Fee Breakdown Table - Track how fees are calculated for each job
export const jobFeeBreakdowns = pgTable("job_fee_breakdowns", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  subscriberNotaryId: integer("subscriber_notary_id").references(() => users.id), // If subscriber created the job
  basePlatformFee: integer("base_platform_fee").default(1000), // $10.00 in cents
  idVerificationCount: integer("id_verification_count").default(1),
  additionalIdFees: integer("additional_id_fees").default(0), // $2.00 per additional ID
  sessionDuration: integer("session_duration"), // Actual session duration in minutes
  extendedTimeFees: integer("extended_time_fees").default(0), // $5.00 per 10 minutes over 20
  totalSubscriberFees: integer("total_subscriber_fees").notNull(), // Total fees charged to subscriber
  witnessProvided: boolean("witness_provided").default(false),
  witnessFee: integer("witness_fee").default(0), // $10.00 if provided, $5.00 if client provided
  feeBreakdown: jsonb("fee_breakdown"), // Detailed breakdown of all fees
  deductedAt: timestamp("deducted_at"), // When fees were deducted from subscriber account
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Stripe Webhook Events Table - Track Stripe events for audit
export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
  id: serial("id").primaryKey(),
  stripeEventId: text("stripe_event_id").notNull().unique(),
  eventType: text("event_type").notNull(), // payment_intent.succeeded, transfer.created, etc.
  processed: boolean("processed").default(false),
  userId: integer("user_id").references(() => users.id), // Associated user if applicable
  transactionId: integer("transaction_id").references(() => accountTransactions.id), // Associated transaction if applicable
  eventData: jsonb("event_data").notNull(), // Full Stripe event data
  processingError: text("processing_error"), // Error message if processing failed
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Financial Management Relations
export const feeConfigurationsRelations = relations(feeConfigurations, ({ many }) => ({
  jobFeeBreakdowns: many(jobFeeBreakdowns),
}));

export const accountTransactionsRelations = relations(accountTransactions, ({ one, many }) => ({
  user: one(users, {
    fields: [accountTransactions.userId],
    references: [users.id],
  }),
  job: one(jobs, {
    fields: [accountTransactions.jobId],
    references: [jobs.id],
  }),
  stripeWebhookEvents: many(stripeWebhookEvents),
}));

export const contractorPaymentsRelations = relations(contractorPayments, ({ one }) => ({
  contractor: one(users, {
    fields: [contractorPayments.contractorId],
    references: [users.id],
  }),
  job: one(jobs, {
    fields: [contractorPayments.jobId],
    references: [jobs.id],
  }),
}));

export const jobFeeBreakdownsRelations = relations(jobFeeBreakdowns, ({ one }) => ({
  job: one(jobs, {
    fields: [jobFeeBreakdowns.jobId],
    references: [jobs.id],
  }),
  subscriberNotary: one(users, {
    fields: [jobFeeBreakdowns.subscriberNotaryId],
    references: [users.id],
    relationName: "SubscriberNotary"
  }),
}));

export const stripeWebhookEventsRelations = relations(stripeWebhookEvents, ({ one }) => ({
  user: one(users, {
    fields: [stripeWebhookEvents.userId],
    references: [users.id],
  }),
  transaction: one(accountTransactions, {
    fields: [stripeWebhookEvents.transactionId],
    references: [accountTransactions.id],
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const selectUserSchema = createSelectSchema(users);

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectCompanySchema = createSelectSchema(companies);

export const insertTitleCompanySchema = createInsertSchema(titleCompanies).omit({
  id: true,
  createdAt: true,
});

export const selectTitleCompanySchema = createSelectSchema(titleCompanies);

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
});

export const selectJobSchema = createSelectSchema(jobs);

export const insertSignerSchema = createInsertSchema(signers).omit({
  id: true,
  createdAt: true,
});

export const selectSignerSchema = createSelectSchema(signers);

export const insertJobParticipantSchema = createInsertSchema(jobParticipants).omit({
  id: true,
  createdAt: true,
  joinedAt: true,
});

export const selectJobParticipantSchema = createSelectSchema(jobParticipants);

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectPaymentSchema = createSelectSchema(payments);

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectInvoiceSchema = createSelectSchema(invoices);

export const insertPaymentScheduleSchema = createInsertSchema(paymentSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectPaymentScheduleSchema = createSelectSchema(paymentSchedules);

export const insertClosingTypeSchema = createInsertSchema(closingTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectClosingTypeSchema = createSelectSchema(closingTypes);

export const insertJobDocumentSchema = createInsertSchema(jobDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectJobDocumentSchema = createSelectSchema(jobDocuments);

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  createdAt: true,
  updatedAt: true,
});
export const selectSystemSettingSchema = createSelectSchema(systemSettings);

export const insertNotaryStampSchema = createInsertSchema(notaryStamps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectNotaryStampSchema = createSelectSchema(notaryStamps);

// Calendar/Availability Relations
export const notaryAvailabilityRelations = relations(notaryAvailability, ({ one }) => ({
  notary: one(users, {
    fields: [notaryAvailability.notaryId],
    references: [users.id],
  }),
}));

export const notaryTimeSlotsRelations = relations(notaryTimeSlots, ({ one }) => ({
  notary: one(users, {
    fields: [notaryTimeSlots.notaryId],
    references: [users.id],
  }),
  job: one(jobs, {
    fields: [notaryTimeSlots.jobId],
    references: [jobs.id],
  }),
}));

export const notaryWorkingHoursRelations = relations(notaryWorkingHours, ({ one }) => ({
  notary: one(users, {
    fields: [notaryWorkingHours.notaryId],
    references: [users.id],
  }),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  notary: one(users, {
    fields: [calendarEvents.notaryId],
    references: [users.id],
  }),
  job: one(jobs, {
    fields: [calendarEvents.jobId],
    references: [jobs.id],
  }),
}));

// Calendar/Availability Schemas
export const insertNotaryAvailabilitySchema = createInsertSchema(notaryAvailability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectNotaryAvailabilitySchema = createSelectSchema(notaryAvailability);

export const insertNotaryTimeSlotsSchema = createInsertSchema(notaryTimeSlots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectNotaryTimeSlotsSchema = createSelectSchema(notaryTimeSlots);

export const insertNotaryWorkingHoursSchema = createInsertSchema(notaryWorkingHours).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectNotaryWorkingHoursSchema = createSelectSchema(notaryWorkingHours);

export const insertCalendarEventsSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectCalendarEventsSchema = createSelectSchema(calendarEvents);

export const insertNotaryAssignmentLogSchema = createInsertSchema(notaryAssignmentLog).omit({
  id: true,
  createdAt: true,
});

export const selectNotaryAssignmentLogSchema = createSelectSchema(notaryAssignmentLog);

export const insertJobNotificationSchema = createInsertSchema(jobNotifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectJobNotificationSchema = createSelectSchema(jobNotifications);

export const insertNotaryApprovalQueueSchema = createInsertSchema(notaryApprovalQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectNotaryApprovalQueueSchema = createSelectSchema(notaryApprovalQueue);

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export const selectPasswordResetTokenSchema = createSelectSchema(passwordResetTokens);

export const insertUserVerificationAttemptSchema = createInsertSchema(userVerificationAttempts).omit({
  id: true,
  createdAt: true,
  attemptedAt: true,
});

export const selectUserVerificationAttemptSchema = createSelectSchema(userVerificationAttempts);

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertTitleCompany = z.infer<typeof insertTitleCompanySchema>;
export type TitleCompany = typeof titleCompanies.$inferSelect;
export type InsertTitleCompanyNotaryAssignment = typeof titleCompanyNotaryAssignments.$inferInsert;
export type TitleCompanyNotaryAssignment = typeof titleCompanyNotaryAssignments.$inferSelect;
export type InsertLegacyTitleCompanyNotaryAssignment = typeof legacyTitleCompanyNotaryAssignments.$inferInsert;
export type LegacyTitleCompanyNotaryAssignment = typeof legacyTitleCompanyNotaryAssignments.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertSigner = z.infer<typeof insertSignerSchema>;
export type Signer = typeof signers.$inferSelect;
export type InsertJobParticipant = z.infer<typeof insertJobParticipantSchema>;
export type JobParticipant = typeof jobParticipants.$inferSelect;
export type InsertJobDocument = z.infer<typeof insertJobDocumentSchema>;
export type JobDocument = typeof jobDocuments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertPaymentSchedule = z.infer<typeof insertPaymentScheduleSchema>;
export type PaymentSchedule = typeof paymentSchedules.$inferSelect;
export type InsertClosingType = z.infer<typeof insertClosingTypeSchema>;
export type ClosingType = typeof closingTypes.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertNotaryStamp = z.infer<typeof insertNotaryStampSchema>;
export type NotaryStamp = typeof notaryStamps.$inferSelect;

// Calendar/Availability Types
export type InsertNotaryAvailability = z.infer<typeof insertNotaryAvailabilitySchema>;
export type NotaryAvailability = typeof notaryAvailability.$inferSelect;
export type InsertNotaryTimeSlots = z.infer<typeof insertNotaryTimeSlotsSchema>;
export type NotaryTimeSlots = typeof notaryTimeSlots.$inferSelect;
export type InsertNotaryWorkingHours = z.infer<typeof insertNotaryWorkingHoursSchema>;
export type NotaryWorkingHours = typeof notaryWorkingHours.$inferSelect;
export type InsertCalendarEvents = z.infer<typeof insertCalendarEventsSchema>;
export type CalendarEvents = typeof calendarEvents.$inferSelect;
export type InsertNotaryAssignmentLog = z.infer<typeof insertNotaryAssignmentLogSchema>;
export type NotaryAssignmentLog = typeof notaryAssignmentLog.$inferSelect;
export type InsertJobNotification = z.infer<typeof insertJobNotificationSchema>;
export type JobNotification = typeof jobNotifications.$inferSelect;
export type InsertNotaryApprovalQueue = z.infer<typeof insertNotaryApprovalQueueSchema>;
export type NotaryApprovalQueue = typeof notaryApprovalQueue.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertUserVerificationAttempt = z.infer<typeof insertUserVerificationAttemptSchema>;
export type UserVerificationAttempt = typeof userVerificationAttempts.$inferSelect;

export const insertKbaSessionSchema = createInsertSchema(kbaSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectKbaSessionSchema = createSelectSchema(kbaSessions);
export type InsertKbaSession = z.infer<typeof insertKbaSessionSchema>;
export type KbaSession = typeof kbaSessions.$inferSelect;

export const notaryAssignmentLogRelations = relations(notaryAssignmentLog, ({ one }) => ({
  job: one(jobs, {
    fields: [notaryAssignmentLog.jobId],
    references: [jobs.id],
  }),
  notary: one(users, {
    fields: [notaryAssignmentLog.notaryId],
    references: [users.id],
  }),
}));

export const jobNotificationsRelations = relations(jobNotifications, ({ one }) => ({
  job: one(jobs, {
    fields: [jobNotifications.jobId],
    references: [jobs.id],
  }),
  recipient: one(users, {
    fields: [jobNotifications.recipientId],
    references: [users.id],
  }),
}));

export const notaryApprovalQueueRelations = relations(notaryApprovalQueue, ({ one }) => ({
  job: one(jobs, {
    fields: [notaryApprovalQueue.jobId],
    references: [jobs.id],
  }),
  notary: one(users, {
    fields: [notaryApprovalQueue.notaryId],
    references: [users.id],
  }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

export const userVerificationAttemptsRelations = relations(userVerificationAttempts, ({ one }) => ({
  user: one(users, {
    fields: [userVerificationAttempts.userId],
    references: [users.id],
  }),
}));

// Financial Management Schemas
export const insertFeeConfigurationSchema = createInsertSchema(feeConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectFeeConfigurationSchema = createSelectSchema(feeConfigurations);

export const insertAccountTransactionSchema = createInsertSchema(accountTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectAccountTransactionSchema = createSelectSchema(accountTransactions);

export const insertContractorPaymentSchema = createInsertSchema(contractorPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectContractorPaymentSchema = createSelectSchema(contractorPayments);

export const insertJobFeeBreakdownSchema = createInsertSchema(jobFeeBreakdowns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectJobFeeBreakdownSchema = createSelectSchema(jobFeeBreakdowns);

export const insertStripeWebhookEventSchema = createInsertSchema(stripeWebhookEvents).omit({
  id: true,
  createdAt: true,
});

export const selectStripeWebhookEventSchema = createSelectSchema(stripeWebhookEvents);

// Financial Management Types
export type InsertFeeConfiguration = z.infer<typeof insertFeeConfigurationSchema>;
export type FeeConfiguration = typeof feeConfigurations.$inferSelect;
export type InsertAccountTransaction = z.infer<typeof insertAccountTransactionSchema>;
export type AccountTransaction = typeof accountTransactions.$inferSelect;
export type InsertContractorPayment = z.infer<typeof insertContractorPaymentSchema>;
export type ContractorPayment = typeof contractorPayments.$inferSelect;
export type InsertJobFeeBreakdown = z.infer<typeof insertJobFeeBreakdownSchema>;
export type JobFeeBreakdown = typeof jobFeeBreakdowns.$inferSelect;
export type InsertStripeWebhookEvent = z.infer<typeof insertStripeWebhookEventSchema>;
export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect;

// Participant Payments Table - Track payments to signers, witnesses, and observers
export const participantPayments = pgTable("participant_payments", {
  id: serial("id").primaryKey(),
  participantId: integer("participant_id").references(() => users.id).notNull(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  sessionId: integer("session_id"), // Reference to signing session if applicable
  participantRole: text("participant_role").notNull(), // 'signer', 'witness', 'observer', 'primary_signer', 'co_signer'
  baseCompensation: integer("base_compensation").notNull(), // Base amount for participation in cents
  sessionDuration: integer("session_duration"), // Session duration in minutes
  bonusAmount: integer("bonus_amount").default(0), // Additional compensation for complex/long sessions
  totalAmount: integer("total_amount").notNull(), // Total compensation amount in cents
  paymentStatus: text("payment_status").default("pending").notNull(), // 'pending', 'available', 'paid', 'failed'
  sessionCompletedDate: timestamp("session_completed_date"), // When the signing session was completed
  availableForPayoutDate: timestamp("available_for_payout_date"), // When payment becomes available (usually 24h after completion)
  paidToParticipantDate: timestamp("paid_to_participant_date"), // When participant was actually paid
  stripeTransferId: text("stripe_transfer_id"), // Stripe transfer ID for participant payment
  paymentMethod: text("payment_method"), // 'stripe_transfer', 'ach', 'check', etc.
  metadata: jsonb("metadata"), // Additional payment details
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertParticipantPayment = typeof participantPayments.$inferInsert;
export type SelectParticipantPayment = typeof participantPayments.$inferSelect;

// Editor Session table - for tracking active editing sessions
export const editorSessions = pgTable("editor_sessions", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  sessionId: text("session_id").notNull().unique(), // UUID for session
  notaryId: integer("notary_id").references(() => users.id).notNull(),
  status: text("status").default("preparing").notNull(), // 'preparing', 'active', 'completed', 'cancelled'
  sessionType: text("session_type").default("notary").notNull(), // 'tagging', 'notary'
  videoSessionId: text("video_session_id"), // Whereby.com session ID
  // Live signing session fields
  signingState: text("signing_state").default("waiting"), // 'waiting', 'active', 'paused', 'completing', 'completed'
  pausedAt: timestamp("paused_at"),
  resumedAt: timestamp("resumed_at"),
  activeUserId: integer("active_user_id").references(() => users.id),
  isLiveSession: boolean("is_live_session").default(false),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Document Tags table - for storing tags placed on documents
export const documentTags = pgTable("document_tags", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => jobDocuments.id).notNull(),
  sessionId: integer("session_id").references(() => editorSessions.id).notNull(),
  tagType: text("tag_type").notNull(), // 'A', 'S', 'I', 'N', 'X', 'O', 'E', 'W', 'T', 'D'
  assignedUserId: integer("assigned_user_id").references(() => users.id), // null for universal tags
  pageNumber: integer("page_number").notNull(),
  xPosition: integer("x_position").notNull(),
  yPosition: integer("y_position").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  isCompleted: boolean("is_completed").default(false),
  content: text("content"), // For completed tags
  completedBy: integer("completed_by").references(() => users.id),
  completedAt: timestamp("completed_at"),
  // Live signing content fields
  contentType: text("content_type"), // 'signature', 'text', 'date', 'notary'
  contentData: text("content_data"), // JSON data for complex content
  isRequired: boolean("is_required").default(true),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Session Participants table - for tracking who's in the session
export const sessionParticipants = pgTable("session_participants", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => editorSessions.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  role: text("role").notNull(), // 'notary', 'signer', 'observer'
  userColor: text("user_color").notNull(), // Color for tags assigned to this user
  isActive: boolean("is_active").default(true).notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
  leftAt: timestamp("left_at"),
  
  // ID Verification fields (per specs)
  idVerified: boolean("id_verified").default(false).notNull(),
  idVerifiedAt: timestamp("id_verified_at"),
  idVerifiedBy: integer("id_verified_by").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Notary Log Entries table - for tracking notary actions
export const notaryLogEntries = pgTable("notary_log_entries", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => editorSessions.id).notNull(),
  notaryId: integer("notary_id").references(() => users.id).notNull(),
  signerId: integer("signer_id").references(() => users.id).notNull(),
  documentId: integer("document_id").references(() => jobDocuments.id).notNull(),
  notarizationType: text("notarization_type").notNull(), // 'JURAT', 'Acknowledgment', 'Copy Certification'
  pageNumber: integer("page_number").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Enhanced Audit Trail table - for comprehensive RON platform audit requirements
export const auditTrail = pgTable("audit_trail", {
  // Session Context
  id: serial("id").primaryKey(), // Audit ID - Unique identifier for the record entry
  sessionId: integer("session_id").references(() => editorSessions.id).notNull(), // Session ID - Links all audit entries to a specific RON session
  documentId: integer("document_id").references(() => jobDocuments.id), // Document ID - Links the entry to a specific document being signed
  timestamp: timestamp("timestamp").defaultNow().notNull(), // Timestamp (UTC) - Exact time of the event in standardized format
  userId: integer("user_id").references(() => users.id).notNull(), // Actor/User ID - Who performed the action (notary, signer, witness, system)
  userRole: text("user_role").notNull(), // Role - Role of the actor (Notary, Signer, Witness, System)
  ipAddress: text("ip_address"), // IP Address / Device Fingerprint - Source of the action, helps confirm location/device
  deviceFingerprint: text("device_fingerprint"), // Device fingerprint for additional security
  
  // Event/Action
  eventType: text("event_type").notNull(), // Event Type - Type of event (login, signature, seal applied, video start, etc.)
  eventDetails: text("event_details"), // Event Details - Detailed description of the event or action taken
  coordinatesPageReference: text("coordinates_page_reference"), // Coordinates/Page Reference - Page number and coordinates if action involves a document
  previousState: jsonb("previous_state"), // Previous vs. New State - If something was changed (moved tag, deleted tag, etc.)
  newState: jsonb("new_state"), // New state after the action
  
  // Verification
  authenticationMethod: text("authentication_method"), // Authentication Method - How the actor was authenticated (KBA, ID, biometric, etc.)
  verificationResult: text("verification_result"), // Verification Result - Pass/fail outcome of KBA, credential analysis, or biometric check
  credentialReference: text("credential_reference"), // Credential Reference - ID of the ID verification session or token
  
  // Notarial Actions
  sealApplied: jsonb("seal_applied"), // Seal Applied - Details of notary seal use (image hash, location, time)
  notaryCertificateReference: text("notary_certificate_reference"), // Notary Certificate Reference - Digital certificate or PFX used for final signature
  digitalSignatureHash: text("digital_signature_hash"), // Digital Signature Hash - Cryptographic proof of integrity for the signed document
  
  // System/Compliance
  systemSource: text("system_source"), // System Source - Which subsystem logged the event (signing module, video server)
  auditLogIntegrityHash: text("audit_log_integrity_hash"), // Audit Log Integrity Hash - Cryptographic hash chain linking audit entries together
  retentionMetadata: jsonb("retention_metadata"), // Retention Metadata - WORM storage reference or retention policy tag (e.g., 10 years)
  
  // Legacy fields for backward compatibility
  action: text("action"), // Legacy action field
  details: jsonb("details"), // Legacy details field
  pageNumber: integer("page_number"), // Legacy page number field
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Document Versions table - for tracking document versions
export const documentVersions = pgTable("document_versions", {
  id: serial("id").primaryKey(),
  originalDocumentId: integer("original_document_id").references(() => jobDocuments.id).notNull(),
  sessionId: integer("session_id").references(() => editorSessions.id).notNull(),
  versionNumber: integer("version_number").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  status: text("status").default("draft").notNull(), // 'draft', 'completed', 'certified'
  digitalCertificateApplied: boolean("digital_certificate_applied").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Session Settings table - for storing session configuration
export const sessionSettings = pgTable("session_settings", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => editorSessions.id).notNull(),
  allowParticipantChat: boolean("allow_participant_chat").default(true),
  autoSyncScreens: boolean("auto_sync_screens").default(false),
  recordSession: boolean("record_session").default(true),
  requireIdVerification: boolean("require_id_verification").default(true),
  maxConcurrentUsers: integer("max_concurrent_users").default(10),
  sessionTimeout: integer("session_timeout").default(7200), // 2 hours in seconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Session Participants Status table - for tracking participant status in live signing sessions
export const sessionParticipantsStatus = pgTable("session_participants_status", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => editorSessions.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
  leftAt: timestamp("left_at"),
  isActive: boolean("is_active").default(false),
  lastActivity: timestamp("last_activity").defaultNow(),
  canInteract: boolean("can_interact").default(false),
});

// Live Session Events table - for audit trail of live session activities
export const liveSessionEvents = pgTable("live_session_events", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => editorSessions.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  eventType: text("event_type").notNull(),
  eventData: text("event_data"), // JSON string
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Relations for new tables
export const editorSessionsRelations = relations(editorSessions, ({ one, many }) => ({
  job: one(jobs, {
    fields: [editorSessions.jobId],
    references: [jobs.id],
  }),
  notary: one(users, {
    fields: [editorSessions.notaryId],
    references: [users.id],
  }),
  documentTags: many(documentTags),
  participants: many(sessionParticipants),
  notaryLogEntries: many(notaryLogEntries),
  auditTrail: many(auditTrail),
  documentVersions: many(documentVersions),
  settings: one(sessionSettings),
}));

export const documentTagsRelations = relations(documentTags, ({ one }) => ({
  document: one(jobDocuments, {
    fields: [documentTags.documentId],
    references: [jobDocuments.id],
  }),
  session: one(editorSessions, {
    fields: [documentTags.sessionId],
    references: [editorSessions.id],
  }),
  assignedUser: one(users, {
    fields: [documentTags.assignedUserId],
    references: [users.id],
  }),
  completedBy: one(users, {
    fields: [documentTags.completedBy],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [documentTags.createdBy],
    references: [users.id],
  }),
}));

export const sessionParticipantsRelations = relations(sessionParticipants, ({ one }) => ({
  session: one(editorSessions, {
    fields: [sessionParticipants.sessionId],
    references: [editorSessions.id],
  }),
  user: one(users, {
    fields: [sessionParticipants.userId],
    references: [users.id],
  }),
}));

export const notaryLogEntriesRelations = relations(notaryLogEntries, ({ one }) => ({
  session: one(editorSessions, {
    fields: [notaryLogEntries.sessionId],
    references: [editorSessions.id],
  }),
  notary: one(users, {
    fields: [notaryLogEntries.notaryId],
    references: [users.id],
  }),
  signer: one(users, {
    fields: [notaryLogEntries.signerId],
    references: [users.id],
  }),
  document: one(jobDocuments, {
    fields: [notaryLogEntries.documentId],
    references: [jobDocuments.id],
  }),
}));

export const auditTrailRelations = relations(auditTrail, ({ one }) => ({
  session: one(editorSessions, {
    fields: [auditTrail.sessionId],
    references: [editorSessions.id],
  }),
  user: one(users, {
    fields: [auditTrail.userId],
    references: [users.id],
  }),
  document: one(jobDocuments, {
    fields: [auditTrail.documentId],
    references: [jobDocuments.id],
  }),
}));

export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  originalDocument: one(jobDocuments, {
    fields: [documentVersions.originalDocumentId],
    references: [jobDocuments.id],
  }),
  session: one(editorSessions, {
    fields: [documentVersions.sessionId],
    references: [editorSessions.id],
  }),
}));

export const sessionSettingsRelations = relations(sessionSettings, ({ one }) => ({
  session: one(editorSessions, {
    fields: [sessionSettings.sessionId],
    references: [editorSessions.id],
  }),
}));

export const sessionParticipantsStatusRelations = relations(sessionParticipantsStatus, ({ one }) => ({
  session: one(editorSessions, {
    fields: [sessionParticipantsStatus.sessionId],
    references: [editorSessions.id],
  }),
  user: one(users, {
    fields: [sessionParticipantsStatus.userId],
    references: [users.id],
  }),
}));

export const liveSessionEventsRelations = relations(liveSessionEvents, ({ one }) => ({
  session: one(editorSessions, {
    fields: [liveSessionEvents.sessionId],
    references: [editorSessions.id],
  }),
  user: one(users, {
    fields: [liveSessionEvents.userId],
    references: [users.id],
  }),
}));

// Zod schemas for new tables
export const insertEditorSessionSchema = createInsertSchema(editorSessions);
export const selectEditorSessionSchema = createSelectSchema(editorSessions);
export const insertDocumentTagSchema = createInsertSchema(documentTags);
export const selectDocumentTagSchema = createSelectSchema(documentTags);
export const insertSessionParticipantSchema = createInsertSchema(sessionParticipants);
export const selectSessionParticipantSchema = createSelectSchema(sessionParticipants);
export const insertNotaryLogEntrySchema = createInsertSchema(notaryLogEntries);
export const selectNotaryLogEntrySchema = createSelectSchema(notaryLogEntries);
export const insertAuditTrailSchema = createInsertSchema(auditTrail);
export const selectAuditTrailSchema = createSelectSchema(auditTrail);
export const insertDocumentVersionSchema = createInsertSchema(documentVersions);
export const selectDocumentVersionSchema = createSelectSchema(documentVersions);
export const insertSessionSettingsSchema = createInsertSchema(sessionSettings);
export const selectSessionSettingsSchema = createSelectSchema(sessionSettings);
export const insertSessionParticipantsStatusSchema = createInsertSchema(sessionParticipantsStatus);
export const selectSessionParticipantsStatusSchema = createSelectSchema(sessionParticipantsStatus);
export const insertLiveSessionEventsSchema = createInsertSchema(liveSessionEvents);
export const selectLiveSessionEventsSchema = createSelectSchema(liveSessionEvents);

// Type exports for new tables
export type InsertEditorSession = z.infer<typeof insertEditorSessionSchema>;
export type EditorSession = typeof editorSessions.$inferSelect;
export type InsertDocumentTag = z.infer<typeof insertDocumentTagSchema>;
export type DocumentTag = typeof documentTags.$inferSelect;
export type InsertSessionParticipant = z.infer<typeof insertSessionParticipantSchema>;
export type SessionParticipant = typeof sessionParticipants.$inferSelect;
export type InsertNotaryLogEntry = z.infer<typeof insertNotaryLogEntrySchema>;
export type NotaryLogEntry = typeof notaryLogEntries.$inferSelect;
export type InsertAuditTrail = z.infer<typeof insertAuditTrailSchema>;
export type AuditTrail = typeof auditTrail.$inferSelect;
export type InsertDocumentVersion = z.infer<typeof insertDocumentVersionSchema>;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type InsertSessionSettings = z.infer<typeof insertSessionSettingsSchema>;
export type SessionSettings = typeof sessionSettings.$inferSelect;
export type InsertSessionParticipantsStatus = z.infer<typeof insertSessionParticipantsStatusSchema>;
export type SessionParticipantsStatus = typeof sessionParticipantsStatus.$inferSelect;
export type InsertLiveSessionEvents = z.infer<typeof insertLiveSessionEventsSchema>;
export type LiveSessionEvents = typeof liveSessionEvents.$inferSelect;

// Add tag types and colors
export const TAG_TYPES = {
  // Signer tags
  A: { name: 'Name', description: 'Signer name field', userType: 'signer' },
  S: { name: 'Signature', description: 'Signature field', userType: 'signer' },
  I: { name: 'Initials', description: 'Initial field', userType: 'signer' },
  
  // Notary tags
  N: { name: 'Commission Number', description: 'Notary commission number', userType: 'notary' },
  X: { name: 'Commission Expiration', description: 'Commission expiration date', userType: 'notary' },
  O: { name: 'Disclosure', description: 'Notary disclosure line', userType: 'notary' },
  E: { name: 'Seal', description: 'Notary seal/stamp', userType: 'notary' },
  W: { name: 'Whiteout', description: 'Cover original PDF content', userType: 'notary' },
  
  // Universal tags
  T: { name: 'Text', description: 'Text field', userType: 'universal' },
  D: { name: 'Date', description: 'Date field', userType: 'universal' },
} as const;

export const USER_COLORS = [
  '#1e40af', // Professional Blue (notary)
  '#7c2d12', // Professional Brown (admin)
  '#3b82f6', // Professional Blue (signer1)
  '#2563eb', // Professional Blue (signer2)
  '#dc2626', // Professional Red (signer3)
  '#ea580c', // Professional Orange (signer4)
  '#0891b2', // Professional Cyan (signer5)
  '#be185d', // Professional Pink (witness1)
  '#65a30d', // Professional Lime (witness2)
  '#374151', // Professional Gray (additional users)
] as const;

// Participant Roles schemas
export const insertParticipantRoleSchema = createInsertSchema(participantRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectParticipantRoleSchema = createSelectSchema(participantRoles);

// Participant Roles types
export type InsertParticipantRole = z.infer<typeof insertParticipantRoleSchema>;
export type ParticipantRole = typeof participantRoles.$inferSelect;

// System-wide Activity Logs table - for tracking ALL user actions across the system
export const systemActivityLogs = pgTable("system_activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  userRole: text("user_role"), // 'admin', 'notary', 'signer', 'title_company', 'witness'
  userEmail: text("user_email"),
  userName: text("user_name"),
  
  // Action details
  action: text("action").notNull(), // 'login', 'logout', 'job_created', 'job_assigned', 'user_approved', 'company_approved', 'document_uploaded', 'payment_processed', etc.
  actionCategory: text("action_category").notNull(), // 'authentication', 'job_management', 'user_management', 'company_management', 'document_management', 'payment', 'system_admin'
  actionDescription: text("action_description").notNull(),
  
  // Context information
  targetType: text("target_type"), // 'user', 'job', 'company', 'document', 'payment', 'system'
  targetId: integer("target_id"), // ID of the target entity
  targetName: text("target_name"), // Name/title of the target entity
  
  // Related entities
  jobId: integer("job_id").references(() => jobs.id),
  companyId: integer("company_id").references(() => companies.id),
  
  // Request/Response details
  requestMethod: text("request_method"), // 'GET', 'POST', 'PUT', 'DELETE'
  requestPath: text("request_path"), // API endpoint path
  requestBody: jsonb("request_body"), // Request payload (filtered for sensitive data)
  responseStatus: integer("response_status"), // HTTP status code
  
  // Additional metadata
  details: jsonb("details"), // Additional structured data about the action
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  sessionId: text("session_id"),
  
  // Location and geolocation data
  latitude: decimal("latitude", { precision: 10, scale: 8 }), // GPS latitude coordinate (when available)
  longitude: decimal("longitude", { precision: 11, scale: 8 }), // GPS longitude coordinate (when available)
  locationAccuracy: decimal("location_accuracy", { precision: 6, scale: 2 }), // Location accuracy in meters
  city: varchar("city", { length: 100 }), // City name from IP geolocation or GPS
  state: varchar("state", { length: 50 }), // State/province from geolocation
  country: varchar("country", { length: 50 }), // Country from geolocation
  ispName: varchar("isp_name", { length: 200 }), // Internet Service Provider name
  connectionType: varchar("connection_type", { length: 50 }), // Connection type (mobile/broadband/corporate)
  timezone: varchar("timezone", { length: 50 }), // User timezone
  
  // Status and flags
  severity: text("severity").default("info").notNull(), // 'info', 'warning', 'error', 'critical'
  isSystemAction: boolean("is_system_action").default(false), // True for automated system actions
  isSuccessful: boolean("is_successful").default(true),
  errorMessage: text("error_message"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  
  // Indexing for performance
}, (table) => ({
  userIdIdx: index("idx_system_activity_logs_user_id").on(table.userId),
  actionIdx: index("idx_system_activity_logs_action").on(table.action),
  categoryIdx: index("idx_system_activity_logs_category").on(table.actionCategory),
  createdAtIdx: index("idx_system_activity_logs_created_at").on(table.createdAt),
  jobIdIdx: index("idx_system_activity_logs_job_id").on(table.jobId),
  companyIdIdx: index("idx_system_activity_logs_company_id").on(table.companyId),
  severityIdx: index("idx_system_activity_logs_severity").on(table.severity),
  // Location-based indexes
  locationIdx: index("idx_system_activity_logs_location").on(table.latitude, table.longitude),
  cityIdx: index("idx_system_activity_logs_city").on(table.city),
  countryIdx: index("idx_system_activity_logs_country").on(table.country),
  timezoneIdx: index("idx_system_activity_logs_timezone").on(table.timezone),
}));

// System Activity Log Relations
export const systemActivityLogsRelations = relations(systemActivityLogs, ({ one }) => ({
  user: one(users, {
    fields: [systemActivityLogs.userId],
    references: [users.id],
  }),
  job: one(jobs, {
    fields: [systemActivityLogs.jobId],
    references: [jobs.id],
  }),
  company: one(companies, {
    fields: [systemActivityLogs.companyId],
    references: [companies.id],
  }),
}));

// System Activity Log Schemas
export const insertSystemActivityLogSchema = createInsertSchema(systemActivityLogs).omit({
  id: true,
  createdAt: true,
});

export const selectSystemActivityLogSchema = createSelectSchema(systemActivityLogs);

// System Activity Log Types
export type InsertSystemActivityLog = z.infer<typeof insertSystemActivityLogSchema>;
export type SystemActivityLog = typeof systemActivityLogs.$inferSelect;

// Log Action Constants
export const LOG_ACTIONS = {
  // Authentication
  LOGIN: 'login',
  LOGOUT: 'logout',
  LOGIN_FAILED: 'login_failed',
  PASSWORD_RESET: 'password_reset',
  
  // Job Management
  JOB_CREATED: 'job_created',
  JOB_UPDATED: 'job_updated',
  JOB_ASSIGNED: 'job_assigned',
  JOB_COMPLETED: 'job_completed',
  JOB_CANCELLED: 'job_cancelled',
  JOB_DELETED: 'job_deleted',
  
  // User Management
  USER_REGISTERED: 'user_registered',
  USER_APPROVED: 'user_approved',
  USER_REJECTED: 'user_rejected',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
  USER_VERIFICATION_BYPASSED: 'user_verification_bypassed',
  
  // Company Management
  COMPANY_REGISTERED: 'company_registered',
  COMPANY_APPROVED: 'company_approved',
  COMPANY_REJECTED: 'company_rejected',
  COMPANY_UPDATED: 'company_updated',
  COMPANY_DELETED: 'company_deleted',
  
  // Document Management
  DOCUMENT_UPLOADED: 'document_uploaded',
  DOCUMENT_DOWNLOADED: 'document_downloaded',
  DOCUMENT_DELETED: 'document_deleted',
  DOCUMENT_SIGNED: 'document_signed',
  DOCUMENT_NOTARIZED: 'document_notarized',
  
  // Payment
  PAYMENT_PROCESSED: 'payment_processed',
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_REFUNDED: 'payment_refunded',
  INVOICE_GENERATED: 'invoice_generated',
  
  // System Admin
  SYSTEM_SETTING_CHANGED: 'system_setting_changed',
  BACKUP_CREATED: 'backup_created',
  MAINTENANCE_MODE_ENABLED: 'maintenance_mode_enabled',
  MAINTENANCE_MODE_DISABLED: 'maintenance_mode_disabled',
  
  // Notary Assignment
  NOTARY_ASSIGNED: 'notary_assigned',
  NOTARY_ASSIGNMENT_FAILED: 'notary_assignment_failed',
  NOTARY_REJECTED_JOB: 'notary_rejected_job',
  
  // Verification
  VERIFICATION_STARTED: 'verification_started',
  VERIFICATION_COMPLETED: 'verification_completed',
  VERIFICATION_FAILED: 'verification_failed',
  KBA_STARTED: 'kba_started',
  KBA_COMPLETED: 'kba_completed',
  
  // Session Management
  SESSION_STARTED: 'session_started',
  SESSION_ENDED: 'session_ended',
  SESSION_PARTICIPANT_JOINED: 'session_participant_joined',
  SESSION_PARTICIPANT_LEFT: 'session_participant_left',
} as const;

export const LOG_CATEGORIES = {
  AUTHENTICATION: 'authentication',
  JOB_MANAGEMENT: 'job_management',
  USER_MANAGEMENT: 'user_management',
  COMPANY_MANAGEMENT: 'company_management',
  DOCUMENT_MANAGEMENT: 'document_management',
  PAYMENT: 'payment',
  SYSTEM_ADMIN: 'system_admin',
  NOTARY_ASSIGNMENT: 'notary_assignment',
  VERIFICATION: 'verification',
  SESSION_MANAGEMENT: 'session_management',
} as const;

export const LOG_SEVERITIES = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const;

// Self-signed certificates table for signers and witnesses
export const selfSignedCertificates = pgTable('self_signed_certificates', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  certificateId: varchar('certificate_id', { length: 255 }).notNull().unique(),
  commonName: varchar('common_name', { length: 255 }).notNull(),
  certificateContent: text('certificate_content').notNull(),
  privateKey: text('private_key').notNull(),
  publicKey: text('public_key').notNull(),
  certificatePath: varchar('certificate_path', { length: 500 }),
  privateKeyPath: varchar('private_key_path', { length: 500 }),
  publicKeyPath: varchar('public_key_path', { length: 500 }),
  issuedAt: timestamp('issued_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  status: varchar('status', { length: 50 }).default('active').notNull(), // active, revoked, expired
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Digital signatures table for tracking PDF signatures
export const digitalSignatures = pgTable('digital_signatures', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id').references(() => jobs.id).notNull(),
  sessionId: varchar('session_id', { length: 255 }),
  documentId: integer('document_id').references(() => jobDocuments.id),
  signerId: integer('signer_id').references(() => users.id).notNull(),
  signerName: varchar('signer_name', { length: 255 }).notNull(),
  signerEmail: varchar('signer_email', { length: 255 }).notNull(),
  signatureType: varchar('signature_type', { length: 50 }).notNull(), // 'user', 'notary'
  certificateId: varchar('certificate_id', { length: 255 }).notNull(),
  signatureHash: varchar('signature_hash', { length: 255 }).notNull(),
  signatureData: text('signature_data'), // Base64 encoded signature
  signedAt: timestamp('signed_at').defaultNow().notNull(),
  isValid: boolean('is_valid').default(true).notNull(),
  verificationStatus: varchar('verification_status', { length: 50 }).default('pending').notNull(), // pending, verified, failed
  verifiedAt: timestamp('verified_at'),
  metadata: jsonb('metadata'), // Additional signature metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Job requests table - for signer-initiated requests that need admin approval
export const jobRequests = pgTable("notarization_job_requests", {
  id: serial("id").primaryKey(),
  // Request details
  title: text("title").notNull(), // Brief title of the request
  description: text("description").notNull(), // Detailed description of what needs to be notarized
  documentType: text("document_type").notNull(), // Type of document(s) to be notarized
  urgency: text("urgency").notNull().default("normal"), // 'low', 'normal', 'high', 'urgent'
  preferredDate: text("preferred_date"), // Preferred date for notarization
  preferredTime: text("preferred_time"), // Preferred time for notarization
  location: text("location"), // Location where notarization should take place
  
  // Requestor information
  requestorId: integer("requestor_id").references(() => users.id).notNull(), // Signer who made the request
  requestorEmail: text("requestor_email").notNull(),
  requestorPhone: text("requestor_phone"),
  
  // Status and workflow
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'rejected', 'assigned', 'completed', 'cancelled'
  priority: text("priority").default("normal"), // 'low', 'normal', 'high', 'urgent'
  
  // Admin review
  reviewedBy: integer("reviewed_by").references(() => users.id), // Admin who reviewed
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"), // Admin's notes on approval/rejection
  
  // Assignment
  assignedNotaryId: integer("assigned_notary_id").references(() => users.id), // Notary assigned to handle this request
  assignedAt: timestamp("assigned_at"),
  assignmentNotes: text("assignment_notes"), // Notes about the assignment
  
  // Conversion to job
  convertedToJobId: integer("converted_to_job_id").references(() => jobs.id), // If converted to a regular job
  convertedAt: timestamp("converted_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  
  // Additional metadata
  metadata: jsonb("metadata"), // Additional request data
});

// Job Request schemas
export const insertJobRequestSchema = createInsertSchema(jobRequests, {
  urgency: z.enum(['low', 'normal', 'high', 'urgent']),
  status: z.enum(['pending', 'approved', 'rejected', 'assigned', 'completed', 'cancelled']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
});

export const selectJobRequestSchema = createSelectSchema(jobRequests, {
  urgency: z.enum(['low', 'normal', 'high', 'urgent']),
  status: z.enum(['pending', 'approved', 'rejected', 'assigned', 'completed', 'cancelled']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
});

export type InsertJobRequest = z.infer<typeof insertJobRequestSchema>;
export type JobRequest = typeof jobRequests.$inferSelect;
