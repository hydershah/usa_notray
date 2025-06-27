import { 
  users, 
  titleCompanies, 
  jobs, 
  signers,
  jobParticipants,
  jobDocuments,
  payments,
  invoices,
  paymentSchedules,
  closingTypes,
  systemSettings,
  type User, 
  type InsertUser,
  type TitleCompany,
  type InsertTitleCompany,
  type Job,
  type InsertJob,
  type Signer,
  type InsertSigner,
  type JobParticipant,
  type InsertJobParticipant,
  type JobDocument,
  type InsertJobDocument,
  type Payment,
  type InsertPayment,
  type Invoice,
  type InsertInvoice,
  type PaymentSchedule,
  type InsertPaymentSchedule,
  type ClosingType,
  type InsertClosingType,
  type SystemSetting,
  type InsertSystemSetting
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, asc } from "drizzle-orm";
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

  // Title company operations
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

  // Signer operations
  getSigner(id: number): Promise<Signer | undefined>;
  createSigner(signer: InsertSigner): Promise<Signer>;
  updateSigner(id: number, signer: Partial<InsertSigner>): Promise<Signer | undefined>;
  deleteSigner(id: number): Promise<boolean>;
  getSignersByJobId(jobId: number): Promise<Signer[]>;
  getSignerByInvitationToken(token: string): Promise<Signer | undefined>;

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

  // System settings operations
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  setSystemSetting(key: string, value: string, type?: string, description?: string): Promise<SystemSetting>;
  getSystemSettings(): Promise<SystemSetting[]>;
  deleteSystemSetting(key: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
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

  // Title company operations
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
    return job || undefined;
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
    if (role === 'admin') {
      return await this.getJobs();
    } else if (role === 'notary') {
      return await db.select().from(jobs).where(
        or(
          eq(jobs.userId, userId),
          eq(jobs.selectedNotary, userId.toString())
        )
      ).orderBy(desc(jobs.createdAt));
    } else {
      return await this.getJobsByUserId(userId);
    }
  }

  // Signer operations
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

  async getSignersByJobId(jobId: number): Promise<Signer[]> {
    return await db.select().from(signers).where(eq(signers.jobId, jobId)).orderBy(asc(signers.id));
  }

  async getSignerByInvitationToken(token: string): Promise<Signer | undefined> {
    const [signer] = await db.select().from(signers).where(eq(signers.invitationToken, token));
    return signer || undefined;
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
    const [participant] = await db
      .select()
      .from(jobParticipants)
      .where(and(eq(jobParticipants.jobId, jobId), eq(jobParticipants.userId, userId)));
    
    if (!participant) {
      // Check if user is the job creator or a notary assigned to the job
      const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      return job?.userId === userId || user?.role === 'admin' || job?.selectedNotary === user?.username;
    }
    
    return participant.inviteStatus === 'accepted';
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
    const result = await db.delete(jobDocuments).where(eq(jobDocuments.id, id));
    return (result.rowCount || 0) > 0;
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

  // System settings operations
  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return setting || undefined;
  }

  async setSystemSetting(key: string, value: string, type: string = 'string', description?: string): Promise<SystemSetting> {
    // Check if setting exists
    const existing = await this.getSystemSetting(key);
    
    if (existing) {
      // Update existing setting
      const [updated] = await db
        .update(systemSettings)
        .set({ 
          value, 
          type, 
          description: description || existing.description,
          updatedAt: new Date()
        })
        .where(eq(systemSettings.key, key))
        .returning();
      return updated;
    } else {
      // Create new setting
      const [created] = await db
        .insert(systemSettings)
        .values({ key, value, type, description })
        .returning();
      return created;
    }
  }

  async getSystemSettings(): Promise<SystemSetting[]> {
    return await db.select().from(systemSettings).orderBy(asc(systemSettings.key));
  }

  async deleteSystemSetting(key: string): Promise<boolean> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    
    // Prevent deletion of protected settings
    if (setting?.isProtected) {
      return false;
    }
    
    const result = await db.delete(systemSettings).where(eq(systemSettings.key, key));
    return result.rowCount !== null && result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();
