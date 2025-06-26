import { pgTable, text, serial, integer, boolean, timestamp, varchar, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull(), // 'admin', 'title_company', 'notary', 'client'
  privileges: text("privileges").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

// Title companies table
export const titleCompanies = pgTable("title_companies", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  city: text("city").notNull(),
  status: text("status").notNull().default("active"), // 'active', 'inactive'
  createdAt: timestamp("created_at").defaultNow(),
});

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
  jobStatus: text("job_status").notNull().default("open"), // 'open', 'pending', 'completed', 'cancelled', 'expired'
  userId: integer("user_id").references(() => users.id),
  sessionToken: text("session_token"),
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Signers table
export const signers = pgTable("signers", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id),
  signerName: text("signer_name").notNull(),
  signerEmail: text("signer_email").notNull(),
  signerPhoneNumber: text("signer_phone_number").notNull(),
  signerRole: text("signer_role").notNull(), // 'borrower', 'co-borrower', 'seller', 'buyer'
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  jobs: many(jobs),
  uploadedDocuments: many(jobDocuments),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  user: one(users, {
    fields: [jobs.userId],
    references: [users.id],
  }),
  signers: many(signers),
  participants: many(jobParticipants),
  documents: many(jobDocuments),
}));

export const signersRelations = relations(signers, ({ one }) => ({
  job: one(jobs, {
    fields: [signers.jobId],
    references: [jobs.id],
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

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const selectUserSchema = createSelectSchema(users);

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

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertTitleCompany = z.infer<typeof insertTitleCompanySchema>;
export type TitleCompany = typeof titleCompanies.$inferSelect;
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
