import { eq, desc, and, or, asc, sql } from "drizzle-orm";
import {
  users,
  titleCompanies,
  jobs,
  jobParticipants,
  payments,
  invoices,
  paymentSchedules,
  closingTypes,
  participantRoles,
  jobDocuments,
  companies,
  notaryStamps,
  notaryAvailability,
  notaryTimeSlots,
  notaryWorkingHours,
  calendarEvents,
  notaryAssignmentLog,
  signers,
  auditTrail,
  notaryLogEntries,
  documentTags,
  documentVersions,
  InsertUser,
  InsertTitleCompany,
  InsertJob,
  InsertJobParticipant,
  InsertJobDocument,
  InsertPayment,
  InsertInvoice,
  InsertPaymentSchedule,
  InsertClosingType,
  InsertParticipantRole,
  InsertCompany,
  InsertNotaryStamp,
  InsertNotaryAvailability,
  InsertNotaryTimeSlots,
  InsertNotaryWorkingHours,
  InsertCalendarEvents,
  InsertNotaryAssignmentLog,
  InsertSigner,
  User,
  TitleCompany,
  Job,
  JobParticipant,
  JobDocument,
  Payment,
  Invoice,
  PaymentSchedule,
  ClosingType,
  ParticipantRole,
  Company,
  NotaryStamp,
  NotaryAvailability,
  NotaryTimeSlots,
  NotaryWorkingHours,
  CalendarEvents,
  NotaryAssignmentLog,
  Signer
} from "@shared/schema";
import { db, pool } from "./db";
import { hasAdminPrivileges } from "./auth";
import bcrypt from "bcrypt";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsersByEmail(email: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getUsers(): Promise<User[]>;
  getNotaryUsers(): Promise<User[]>;

  // Enhanced user queries
  getUsersByRole(role: string): Promise<User[]>;
  getUsersByCompany(companyId: number): Promise<User[]>;
  getUsersByApprovalStatus(status: string): Promise<User[]>;
  getActiveNotaries(): Promise<User[]>;
  getNotariesByQualifications(requiresNSA?: boolean, requiresSpanish?: boolean): Promise<User[]>;

  // User approval operations
  approveUser(userId: number, approvedBy: number, notes?: string): Promise<User | undefined>;
  rejectUser(userId: number, approvedBy: number, notes: string): Promise<User | undefined>;
  requestUserUpdate(userId: number, approvedBy: number, notes: string): Promise<User | undefined>;

  // Company operations - Comprehensive
  getCompany(id: number): Promise<Company | undefined>;
  getCompanyByName(name: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: number): Promise<boolean>;
  getCompanies(): Promise<Company[]>;
  getActiveCompanies(): Promise<Company[]>;
  getCompaniesByStatus(status: string): Promise<Company[]>;

  // Company-user association operations
  addUserToCompany(userId: number, companyId: number, role: string): Promise<boolean>;
  removeUserFromCompany(userId: number): Promise<boolean>;
  updateUserCompanyRole(userId: number, role: string): Promise<boolean>;
  addAuthorizedUser(companyId: number, userId: number): Promise<boolean>;
  removeAuthorizedUser(companyId: number, userId: number): Promise<boolean>;

  // Company registration workflow
  registerCompany(companyData: InsertCompany, managerData: InsertUser): Promise<{ company: Company; manager: User }>;

  // Legacy title company operations (for backward compatibility)
  getTitleCompany(id: number): Promise<TitleCompany | undefined>;
  createTitleCompany(company: InsertTitleCompany): Promise<TitleCompany>;
  updateTitleCompany(id: number, company: Partial<InsertTitleCompany>): Promise<TitleCompany | undefined>;
  deleteTitleCompany(id: number): Promise<boolean>;
  getTitleCompanies(): Promise<TitleCompany[]>;

  // Job operations
  getJob(id: number): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: number, job: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(id: number): Promise<boolean>;
  getJobs(): Promise<Job[]>;
  getJobsByUserId(userId: number): Promise<Job[]>;
  getRoleBasedJobs(userId: number, role: string): Promise<Job[]>;

  // Job participant operations
  getJobParticipant(id: number): Promise<JobParticipant | undefined>;
  createJobParticipant(participant: InsertJobParticipant): Promise<JobParticipant>;
  updateJobParticipant(id: number, participant: Partial<InsertJobParticipant>): Promise<JobParticipant | undefined>;
  deleteJobParticipant(id: number): Promise<boolean>;
  getJobParticipantsByJobId(jobId: number): Promise<JobParticipant[]>;
  verifySessionAccess(jobId: number, userId: number): Promise<boolean>;
  generateSessionToken(jobId: number): Promise<string>;
  validateSessionToken(jobId: number, token: string): Promise<boolean>;

  // Job document operations
  getJobDocument(id: number): Promise<JobDocument | undefined>;
  createJobDocument(document: InsertJobDocument): Promise<JobDocument>;
  updateJobDocument(id: number, document: Partial<InsertJobDocument>): Promise<JobDocument | undefined>;
  deleteJobDocument(id: number): Promise<boolean>;
  getJobDocumentsByJobId(jobId: number): Promise<JobDocument[]>;
  getJobDocumentsByType(jobId: number, documentType: string): Promise<JobDocument[]>;

  // Payment operations
  getPayment(id: number): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: number, payment: Partial<InsertPayment>): Promise<Payment | undefined>;
  deletePayment(id: number): Promise<boolean>;
  getPaymentsByJobId(jobId: number): Promise<Payment[]>;
  getPaymentsByUserId(userId: number): Promise<Payment[]>;

  // Invoice operations
  getInvoice(id: number): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: number): Promise<boolean>;
  getInvoicesByJobId(jobId: number): Promise<Invoice[]>;
  getInvoicesByClientId(clientId: number): Promise<Invoice[]>;
  getInvoicesByNotaryId(notaryId: number): Promise<Invoice[]>;
  generateInvoiceNumber(): Promise<string>;

  // Payment schedule operations
  getPaymentSchedule(id: number): Promise<PaymentSchedule | undefined>;
  createPaymentSchedule(schedule: InsertPaymentSchedule): Promise<PaymentSchedule>;
  updatePaymentSchedule(id: number, schedule: Partial<InsertPaymentSchedule>): Promise<PaymentSchedule | undefined>;
  deletePaymentSchedule(id: number): Promise<boolean>;
  getPaymentSchedulesByJobId(jobId: number): Promise<PaymentSchedule[]>;

  // Closing type operations
  getClosingType(id: number): Promise<ClosingType | undefined>;
  createClosingType(closingType: InsertClosingType): Promise<ClosingType>;
  updateClosingType(id: number, closingType: Partial<InsertClosingType>): Promise<ClosingType | undefined>;
  deleteClosingType(id: number): Promise<boolean>;
  getClosingTypes(): Promise<ClosingType[]>;
  getActiveClosingTypes(): Promise<ClosingType[]>;

  // Participant role operations
  getParticipantRole(id: number): Promise<ParticipantRole | undefined>;
  createParticipantRole(role: InsertParticipantRole): Promise<ParticipantRole>;
  updateParticipantRole(id: number, role: Partial<InsertParticipantRole>): Promise<ParticipantRole | undefined>;
  deleteParticipantRole(id: number): Promise<boolean>;
  getParticipantRoles(): Promise<ParticipantRole[]>;
  getActiveParticipantRoles(): Promise<ParticipantRole[]>;

  // Signer operations
  getSignersByJobId(jobId: number): Promise<Signer[]>;
  getSigner(id: number): Promise<Signer | undefined>;
  createSigner(signer: InsertSigner): Promise<Signer>;
  updateSigner(id: number, signer: Partial<InsertSigner>): Promise<Signer | undefined>;
  deleteSigner(id: number): Promise<boolean>;

  // Signature management operations
  getUserSignatures(userId: number): Promise<any[]>;
  createUserSignature(signature: any): Promise<any>;
  setDefaultSignature(userId: number, signatureId: string): Promise<void>;
  deleteUserSignature(userId: number, signatureId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Raw SQL query execution method
  async executeQuery(query: string, params?: any[]): Promise<any[]> {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(query, params);
        return result.rows;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  // Alias for getUser to maintain compatibility
  async getUserById(id: number): Promise<User | undefined> {
    return this.getUser(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUsersByEmail(email: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.email, email));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        password: hashedPassword,
      })
      .returning();
    return user;
  }

  async updateUser(id: number, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(asc(users.createdAt));
  }

  async getNotaryUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, 'notary')).orderBy(asc(users.username));
  }

  // Enhanced user queries
  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role)).orderBy(asc(users.username));
  }

  async getUsersByCompany(companyId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.companyId, companyId)).orderBy(asc(users.username));
  }

  async getUsersByApprovalStatus(status: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.approvalStatus, status)).orderBy(asc(users.username));
  }

  async getActiveNotaries(): Promise<User[]> {
    return await db.select().from(users).where(
      and(
        eq(users.role, 'notary'),
        eq(users.isActive, true),
        eq(users.approvalStatus, 'approved')
      )
    ).orderBy(asc(users.username));
  }

  async getNotariesByQualifications(requiresNSA?: boolean, requiresSpanish?: boolean): Promise<User[]> {
    let conditions = [
      eq(users.role, 'notary'),
      eq(users.isActive, true),
      eq(users.approvalStatus, 'approved')
    ];
    
    if (requiresNSA) {
      conditions.push(eq(users.isNotarySigningAgent, true));
    }
    if (requiresSpanish) {
      conditions.push(eq(users.isSpanishSpeaking, true));
    }
    
    return await db.select().from(users).where(and(...conditions)).orderBy(asc(users.username));
  }

  // User approval operations
  async approveUser(userId: number, approvedBy: number, notes?: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        approvalStatus: 'approved',
        approvedBy: approvedBy,
        approvalNotes: notes,
      })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async rejectUser(userId: number, approvedBy: number, notes: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        approvalStatus: 'rejected',
        approvedBy: approvedBy,
        approvalNotes: notes,
      })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async requestUserUpdate(userId: number, approvedBy: number, notes: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        approvalStatus: 'pending',
        approvedBy: approvedBy,
        approvalNotes: notes,
      })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  // Company operations - Comprehensive
  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async getCompanyByName(name: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.companyName, name));
    return company || undefined;
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const [company] = await db
      .insert(companies)
      .values(insertCompany)
      .returning();
    return company;
  }

  async updateCompany(id: number, updateData: Partial<InsertCompany>): Promise<Company | undefined> {
    const [company] = await db
      .update(companies)
      .set(updateData)
      .where(eq(companies.id, id))
      .returning();
    return company || undefined;
  }

  async deleteCompany(id: number): Promise<boolean> {
    const result = await db.delete(companies).where(eq(companies.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getCompanies(): Promise<Company[]> {
    return await db.select().from(companies).orderBy(asc(companies.companyName));
  }

  async getActiveCompanies(): Promise<Company[]> {
    return await db.select().from(companies).where(eq(companies.status, 'active')).orderBy(asc(companies.companyName));
  }

  async getCompaniesByStatus(status: string): Promise<Company[]> {
    return await db.select().from(companies).where(eq(companies.status, status)).orderBy(asc(companies.companyName));
  }

  // Company-user association operations
  async addUserToCompany(userId: number, companyId: number, companyRole: string): Promise<boolean> {
    const result = await db
      .update(users)
      .set({
        companyId: companyId,
        companyRole: companyRole,
      })
      .where(eq(users.id, userId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async removeUserFromCompany(userId: number): Promise<boolean> {
    const result = await db
      .update(users)
      .set({
        companyId: null,
        companyRole: null,
      })
      .where(eq(users.id, userId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async updateUserCompanyRole(userId: number, companyRole: string): Promise<boolean> {
    const result = await db
      .update(users)
      .set({
        companyRole: companyRole,
      })
      .where(eq(users.id, userId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async addAuthorizedUser(companyId: number, userId: number): Promise<boolean> {
    const result = await db
      .update(companies)
      .set({
        authorizedUserIds: sql`array_append(${companies.authorizedUserIds}, ${userId})`,
      })
      .where(eq(companies.id, companyId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async removeAuthorizedUser(companyId: number, userId: number): Promise<boolean> {
    const result = await db
      .update(companies)
      .set({
        authorizedUserIds: sql`array_remove(${companies.authorizedUserIds}, ${userId})`,
      })
      .where(eq(companies.id, companyId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Company registration workflow
  async registerCompany(companyData: InsertCompany, managerData: InsertUser): Promise<{ company: Company; manager: User }> {
    const [company] = await db
      .insert(companies)
      .values(companyData)
      .returning();
    const [manager] = await db
      .insert(users)
      .values({
        ...managerData,
        password: await bcrypt.hash(managerData.password, 10),
        companyId: company.id,
        role: 'manager',
      })
      .returning();
    return { company, manager };
  }

  // Legacy title company operations (for backward compatibility)
  async getTitleCompany(id: number): Promise<TitleCompany | undefined> {
    const [company] = await db.select().from(titleCompanies).where(eq(titleCompanies.id, id));
    return company || undefined;
  }

  async createTitleCompany(insertCompany: InsertTitleCompany): Promise<TitleCompany> {
    const [company] = await db
      .insert(titleCompanies)
      .values(insertCompany)
      .returning();
    return company;
  }

  async updateTitleCompany(id: number, updateData: Partial<InsertTitleCompany>): Promise<TitleCompany | undefined> {
    const [company] = await db
      .update(titleCompanies)
      .set(updateData)
      .where(eq(titleCompanies.id, id))
      .returning();
    return company || undefined;
  }

  async deleteTitleCompany(id: number): Promise<boolean> {
    const result = await db.delete(titleCompanies).where(eq(titleCompanies.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getTitleCompanies(): Promise<TitleCompany[]> {
    return await db.select().from(titleCompanies).orderBy(asc(titleCompanies.companyName));
  }

  // Job operations
  async getJob(id: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    if (!job) return undefined;

    // If a notary is assigned, fetch their details
    let assignedNotary = null;
    const notaryId = job.notaryId || (job.selectedNotary ? parseInt(job.selectedNotary) : null);
    
    if (notaryId) {
      const [notary] = await db
        .select({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          notaryIdCode: users.notaryIdCode,
          isActive: users.isActive
        })
        .from(users)
        .where(eq(users.id, notaryId));
      
      if (notary) {
        assignedNotary = {
          id: notary.id,
          name: notary.firstName && notary.lastName 
            ? `${notary.firstName} ${notary.lastName}` 
            : notary.username,
          notaryIdCode: notary.notaryIdCode,
          email: notary.email,
          isActive: notary.isActive
        };
      }
    }

    return {
      ...job,
      assignedNotary
    };
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const [job] = await db
      .insert(jobs)
      .values(insertJob)
      .returning();
    return job;
  }

  async updateJob(id: number, updateData: Partial<InsertJob>): Promise<Job | undefined> {
    const [job] = await db
      .update(jobs)
      .set(updateData)
      .where(eq(jobs.id, id))
      .returning();
    return job || undefined;
  }

  async deleteJob(id: number): Promise<boolean> {
    const result = await db.delete(jobs).where(eq(jobs.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getJobs(): Promise<Job[]> {
    return await db.select().from(jobs).orderBy(desc(jobs.createdAt));
  }

  async getJobsByUserId(userId: number): Promise<Job[]> {
    return await db.select().from(jobs).where(eq(jobs.userId, userId)).orderBy(desc(jobs.createdAt));
  }

  async getRoleBasedJobs(userId: number, role: string): Promise<Job[]> {
    // For this method, we still need to check the role string since it's passed as a parameter
    if (role === 'admin') {
      return await this.getJobs();
    } else if (role === 'notary') {
      return await db.select().from(jobs).where(
        or(
          eq(jobs.userId, userId),
          eq(jobs.selectedNotary, userId.toString()),
          eq(jobs.notaryId, userId) // Also check the modern notaryId field
        )
      ).orderBy(desc(jobs.createdAt));
    } else {
      return await this.getJobsByUserId(userId);
    }
  }

  // Job participant operations
  async getJobParticipant(id: number): Promise<JobParticipant | undefined> {
    const [participant] = await db.select().from(jobParticipants).where(eq(jobParticipants.id, id));
    return participant || undefined;
  }

  async createJobParticipant(insertParticipant: InsertJobParticipant): Promise<JobParticipant> {
    const [participant] = await db
      .insert(jobParticipants)
      .values(insertParticipant)
      .returning();
    return participant;
  }

  async updateJobParticipant(id: number, updateData: Partial<InsertJobParticipant>): Promise<JobParticipant | undefined> {
    const [participant] = await db
      .update(jobParticipants)
      .set(updateData)
      .where(eq(jobParticipants.id, id))
      .returning();
    return participant || undefined;
  }

  async deleteJobParticipant(id: number): Promise<boolean> {
    const result = await db.delete(jobParticipants).where(eq(jobParticipants.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getJobParticipantsByJobId(jobId: number): Promise<JobParticipant[]> {
    return await db.select().from(jobParticipants).where(eq(jobParticipants.jobId, jobId));
  }

  async verifySessionAccess(jobId: number, userId: number): Promise<boolean> {
    // First check job_participants table
    const [participant] = await db
      .select()
      .from(jobParticipants)
      .where(and(eq(jobParticipants.jobId, jobId), eq(jobParticipants.userId, userId)));
    
    if (!participant) {
      // Get user details for further checks
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return false;
      
      // Check if user is linked through signers table (important for invitation flow)
      const [signer] = await db
        .select()
        .from(signers)
        .where(and(eq(signers.jobId, jobId), eq(signers.signerEmail, user.email)));
      
      if (signer) {
        console.log(`✅ Session access granted via signers table for user ${userId} (${user.email}) on job ${jobId}`);
        return true; // User is a signer for this job
      }
      
      // Check if user is the job creator or a notary assigned to the job
      const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
      
      return job?.userId === userId || (user && hasAdminPrivileges(user)) || job?.selectedNotary === user?.username;
    }
    
    // Check if participant has accepted the invitation
    if (participant.inviteStatus !== 'accepted') {
      return false;
    }

    // Get user details to check verification status
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      return false;
    }

    // For signers and witnesses, require ID verification (either EVS, admin bypass, or notary bypass) before session access
    if ((user.role === 'signer' || user.role === 'witness') && 
        !(user.isVerified || user.isVerificationBypassed || user.notaryVerificationBypassed)) {
      return false;
    }

    // Also check if user has completed their profile setup
    if ((user.role === 'signer' || user.role === 'witness') && !user.accountSetupComplete) {
      return false;
    }

    return true;
  }

  async generateSessionToken(jobId: number): Promise<string> {
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    await db
      .update(jobs)
      .set({ sessionToken: token })
      .where(eq(jobs.id, jobId));
    
    return token;
  }

  async validateSessionToken(jobId: number, token: string): Promise<boolean> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    return job?.sessionToken === token;
  }

  // Job document operations
  async getJobDocument(id: number): Promise<JobDocument | undefined> {
    const [document] = await db.select().from(jobDocuments).where(eq(jobDocuments.id, id));
    return document || undefined;
  }

  async createJobDocument(insertDocument: InsertJobDocument): Promise<JobDocument> {
    const [document] = await db
      .insert(jobDocuments)
      .values(insertDocument)
      .returning();
    return document;
  }

  async updateJobDocument(id: number, updateData: Partial<InsertJobDocument>): Promise<JobDocument | undefined> {
    const [document] = await db
      .update(jobDocuments)
      .set(updateData)
      .where(eq(jobDocuments.id, id))
      .returning();
    return document || undefined;
  }

  async deleteJobDocument(id: number): Promise<boolean> {
    try {
      // First, handle audit trail references to preserve audit history
      // Set documentId to NULL in audit_trail records that reference this document
      await db
        .update(auditTrail)
        .set({ documentId: null })
        .where(eq(auditTrail.documentId, id));
      
      // Also handle other tables that might reference the document
      await db
        .update(notaryLogEntries)
        .set({ documentId: null })
        .where(eq(notaryLogEntries.documentId, id));
      
      await db
        .update(documentTags)
        .set({ documentId: null })
        .where(eq(documentTags.documentId, id));
      
      // Handle document versions by setting originalDocumentId to NULL
      await db
        .update(documentVersions)
        .set({ originalDocumentId: null })
        .where(eq(documentVersions.originalDocumentId, id));
      
      // Now delete the document itself
      const result = await db.delete(jobDocuments).where(eq(jobDocuments.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error deleting job document:', error);
      return false;
    }
  }

  async getJobDocumentsByJobId(jobId: number): Promise<JobDocument[]> {
    return await db.select().from(jobDocuments).where(eq(jobDocuments.jobId, jobId));
  }

  async getJobDocumentsByType(jobId: number, documentType: string): Promise<JobDocument[]> {
    return await db.select().from(jobDocuments).where(and(eq(jobDocuments.jobId, jobId), eq(jobDocuments.documentType, documentType)));
  }

  // Payment operations
  async getPayment(id: number): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment || undefined;
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const [payment] = await db
      .insert(payments)
      .values(insertPayment)
      .returning();
    return payment;
  }

  async updatePayment(id: number, updateData: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [payment] = await db
      .update(payments)
      .set(updateData)
      .where(eq(payments.id, id))
      .returning();
    return payment || undefined;
  }

  async deletePayment(id: number): Promise<boolean> {
    const result = await db.delete(payments).where(eq(payments.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getPaymentsByJobId(jobId: number): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.jobId, jobId));
  }

  async getPaymentsByUserId(userId: number): Promise<Payment[]> {
    return await db.select().from(payments).where(
      or(eq(payments.payerId, userId), eq(payments.payeeId, userId))
    );
  }

  // Invoice operations
  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db
      .insert(invoices)
      .values(insertInvoice)
      .returning();
    return invoice;
  }

  async updateInvoice(id: number, updateData: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [invoice] = await db
      .update(invoices)
      .set(updateData)
      .where(eq(invoices.id, id))
      .returning();
    return invoice || undefined;
  }

  async deleteInvoice(id: number): Promise<boolean> {
    const result = await db.delete(invoices).where(eq(invoices.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getInvoicesByJobId(jobId: number): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.jobId, jobId));
  }

  async getInvoicesByClientId(clientId: number): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.clientId, clientId));
  }

  async getInvoicesByNotaryId(notaryId: number): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.notaryId, notaryId));
  }

  async generateInvoiceNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-6);
    return `INV-${year}${month}-${timestamp}`;
  }

  // Payment schedule operations
  async getPaymentSchedule(id: number): Promise<PaymentSchedule | undefined> {
    const [schedule] = await db.select().from(paymentSchedules).where(eq(paymentSchedules.id, id));
    return schedule || undefined;
  }

  async createPaymentSchedule(insertSchedule: InsertPaymentSchedule): Promise<PaymentSchedule> {
    const [schedule] = await db
      .insert(paymentSchedules)
      .values(insertSchedule)
      .returning();
    return schedule;
  }

  async updatePaymentSchedule(id: number, updateData: Partial<InsertPaymentSchedule>): Promise<PaymentSchedule | undefined> {
    const [schedule] = await db
      .update(paymentSchedules)
      .set(updateData)
      .where(eq(paymentSchedules.id, id))
      .returning();
    return schedule || undefined;
  }

  async deletePaymentSchedule(id: number): Promise<boolean> {
    const result = await db.delete(paymentSchedules).where(eq(paymentSchedules.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getPaymentSchedulesByJobId(jobId: number): Promise<PaymentSchedule[]> {
    return await db.select().from(paymentSchedules).where(eq(paymentSchedules.jobId, jobId));
  }

  // Closing type operations
  async getClosingType(id: number): Promise<ClosingType | undefined> {
    const [closingType] = await db.select().from(closingTypes).where(eq(closingTypes.id, id));
    return closingType || undefined;
  }

  async createClosingType(insertClosingType: InsertClosingType): Promise<ClosingType> {
    const [closingType] = await db
      .insert(closingTypes)
      .values(insertClosingType)
      .returning();
    return closingType;
  }

  async updateClosingType(id: number, updateData: Partial<InsertClosingType>): Promise<ClosingType | undefined> {
    const [closingType] = await db
      .update(closingTypes)
      .set(updateData)
      .where(eq(closingTypes.id, id))
      .returning();
    return closingType || undefined;
  }

  async deleteClosingType(id: number): Promise<boolean> {
    const result = await db.delete(closingTypes).where(eq(closingTypes.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getClosingTypes(): Promise<ClosingType[]> {
    return await db.select().from(closingTypes).orderBy(asc(closingTypes.name));
  }

  async getActiveClosingTypes(): Promise<ClosingType[]> {
    return await db.select().from(closingTypes)
      .where(eq(closingTypes.isActive, true))
      .orderBy(asc(closingTypes.name));
  }

  // Participant role operations
  async getParticipantRole(id: number): Promise<ParticipantRole | undefined> {
    const [role] = await db.select().from(participantRoles).where(eq(participantRoles.id, id));
    return role || undefined;
  }

  async createParticipantRole(insertRole: InsertParticipantRole): Promise<ParticipantRole> {
    const [role] = await db
      .insert(participantRoles)
      .values(insertRole)
      .returning();
    return role;
  }

  async updateParticipantRole(id: number, updateData: Partial<InsertParticipantRole>): Promise<ParticipantRole | undefined> {
    const [role] = await db
      .update(participantRoles)
      .set(updateData)
      .where(eq(participantRoles.id, id))
      .returning();
    return role || undefined;
  }

  async deleteParticipantRole(id: number): Promise<boolean> {
    const result = await db.delete(participantRoles).where(eq(participantRoles.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getParticipantRoles(): Promise<ParticipantRole[]> {
    return await db.select().from(participantRoles).orderBy(asc(participantRoles.name));
  }

  async getActiveParticipantRoles(): Promise<ParticipantRole[]> {
    return await db.select().from(participantRoles)
      .where(eq(participantRoles.isActive, true))
      .orderBy(asc(participantRoles.name));
  }

  // Signer operations
  async getSignersByJobId(jobId: number): Promise<Signer[]> {
    return await db.select().from(signers).where(eq(signers.jobId, jobId));
  }

  async getSigner(id: number): Promise<Signer | undefined> {
    const [signer] = await db.select().from(signers).where(eq(signers.id, id));
    return signer || undefined;
  }

  async createSigner(insertSigner: InsertSigner): Promise<Signer> {
    const [signer] = await db
      .insert(signers)
      .values(insertSigner)
      .returning();
    return signer;
  }

  async updateSigner(id: number, updateData: Partial<InsertSigner>): Promise<Signer | undefined> {
    const [signer] = await db
      .update(signers)
      .set(updateData)
      .where(eq(signers.id, id))
      .returning();
    return signer || undefined;
  }

  async deleteSigner(id: number): Promise<boolean> {
    const result = await db.delete(signers).where(eq(signers.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Signature management operations
  async getUserSignatures(userId: number): Promise<any[]> {
    // For now, we'll use a simple in-memory storage approach
    // In production, you would store these in a dedicated database table
    const signatures = this.userSignatures.get(userId) || [];
    return signatures;
  }

  async createUserSignature(signature: any): Promise<any> {
    const signatureId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const newSignature = {
      id: signatureId,
      ...signature,
      createdAt: new Date().toISOString()
    };

    if (!this.userSignatures.has(signature.userId)) {
      this.userSignatures.set(signature.userId, []);
    }

    const userSignatures = this.userSignatures.get(signature.userId)!;
    
    // If this is the first signature, make it default
    if (userSignatures.length === 0) {
      newSignature.isDefault = true;
    }

    userSignatures.push(newSignature);
    return newSignature;
  }

  async setDefaultSignature(userId: number, signatureId: string): Promise<void> {
    const userSignatures = this.userSignatures.get(userId) || [];
    
    // Reset all signatures to not default
    userSignatures.forEach(sig => sig.isDefault = false);
    
    // Set the specified signature as default
    const targetSignature = userSignatures.find(sig => sig.id === signatureId);
    if (targetSignature) {
      targetSignature.isDefault = true;
    }
  }

  async deleteUserSignature(userId: number, signatureId: string): Promise<void> {
    const userSignatures = this.userSignatures.get(userId) || [];
    const index = userSignatures.findIndex(sig => sig.id === signatureId);
    
    if (index >= 0) {
      userSignatures.splice(index, 1);
    }
  }

  // In-memory storage for signatures (in production, use a database table)
  private userSignatures = new Map<number, any[]>();
}

export const storage = new DatabaseStorage();
