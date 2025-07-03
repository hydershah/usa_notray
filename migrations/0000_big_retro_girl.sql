CREATE TABLE "account_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"transaction_type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_before" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"description" text NOT NULL,
	"job_id" integer,
	"payment_method" text,
	"stripe_transaction_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"metadata" jsonb,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_trail" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"action" text NOT NULL,
	"details" jsonb,
	"document_id" integer,
	"page_number" integer,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"notary_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_date_time" timestamp NOT NULL,
	"end_date_time" timestamp NOT NULL,
	"location" text,
	"event_type" text DEFAULT 'personal' NOT NULL,
	"is_all_day" boolean DEFAULT false,
	"job_id" integer,
	"reminders" jsonb,
	"is_recurring" boolean DEFAULT false,
	"recurring_pattern" jsonb,
	"google_event_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closing_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"base_price" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"estimated_duration" integer,
	"requires_witness" boolean DEFAULT false,
	"requires_notary_travel" boolean DEFAULT false,
	"travel_fee" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "closing_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"primary_user_name" text NOT NULL,
	"primary_user_email" text NOT NULL,
	"address_1" text NOT NULL,
	"address_2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"zip_code" text NOT NULL,
	"billing_address_1" text,
	"billing_address_2" text,
	"billing_city" text,
	"billing_state" text,
	"billing_zip_code" text,
	"payment_method" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone_number" text,
	"status" text DEFAULT 'active' NOT NULL,
	"preferred_notary_id" integer,
	"company_manager_id" integer,
	"authorized_user_ids" integer[] DEFAULT '{}',
	"subscription_plan" text,
	"billing_cycle" text,
	"next_billing_date" timestamp,
	"default_closing_type" text,
	"allow_user_self_registration" boolean DEFAULT false,
	"requires_approval_for_new_users" boolean DEFAULT true,
	"approved_by" integer,
	"approved_at" timestamp,
	"approval_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" integer,
	"last_modified_by" integer
);
--> statement-breakpoint
CREATE TABLE "contractor_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"contractor_id" integer NOT NULL,
	"job_id" integer NOT NULL,
	"total_job_fee" integer NOT NULL,
	"contractor_percentage" integer DEFAULT 55 NOT NULL,
	"contractor_amount" integer NOT NULL,
	"platform_fee" integer NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"client_payment_date" timestamp,
	"available_for_payout_date" timestamp,
	"paid_to_contractor_date" timestamp,
	"stripe_transfer_id" text,
	"delay_reason" text,
	"estimated_payout_date" timestamp,
	"invoice_number" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"session_id" integer NOT NULL,
	"tag_type" text NOT NULL,
	"assigned_user_id" integer,
	"page_number" integer NOT NULL,
	"x_position" integer NOT NULL,
	"y_position" integer NOT NULL,
	"width" integer DEFAULT 100 NOT NULL,
	"height" integer DEFAULT 30 NOT NULL,
	"is_completed" boolean DEFAULT false,
	"content" text,
	"completed_by" integer,
	"completed_at" timestamp,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_document_id" integer NOT NULL,
	"session_id" integer NOT NULL,
	"version_number" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"digital_certificate_applied" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editor_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"session_id" text NOT NULL,
	"notary_id" integer NOT NULL,
	"status" text DEFAULT 'preparing' NOT NULL,
	"session_type" text DEFAULT 'notary' NOT NULL,
	"video_session_id" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "editor_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "fee_configurations" (
	"id" serial PRIMARY KEY NOT NULL,
	"fee_type" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"description" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"applicable_to_role" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"notary_id" integer NOT NULL,
	"invoice_number" text NOT NULL,
	"description" text NOT NULL,
	"subtotal" integer NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"total_amount" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"due_date" timestamp NOT NULL,
	"sent_at" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "job_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"document_type" text DEFAULT 'original' NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"uploaded_by" integer,
	"is_required" boolean DEFAULT false,
	"signature_pages" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_fee_breakdowns" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"subscriber_notary_id" integer,
	"base_platform_fee" integer DEFAULT 1000,
	"id_verification_count" integer DEFAULT 1,
	"additional_id_fees" integer DEFAULT 0,
	"session_duration" integer,
	"extended_time_fees" integer DEFAULT 0,
	"total_subscriber_fees" integer NOT NULL,
	"witness_provided" boolean DEFAULT false,
	"witness_fee" integer DEFAULT 0,
	"fee_breakdown" jsonb,
	"deducted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"recipient_id" integer NOT NULL,
	"recipient_email" text NOT NULL,
	"notification_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"sent_at" timestamp,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer,
	"user_id" integer,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"invite_status" text DEFAULT 'pending' NOT NULL,
	"invite_token" text,
	"joined_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"title_company" text NOT NULL,
	"closing_type" text NOT NULL,
	"internal_reference" text,
	"kba_required" boolean DEFAULT false,
	"property_address_one" text NOT NULL,
	"property_address_two" text,
	"property_city" text NOT NULL,
	"property_state" text NOT NULL,
	"property_zip_code" text NOT NULL,
	"notary_option" text,
	"selected_notary" text,
	"selected_date" text,
	"selected_time" text,
	"uploaded_file" text,
	"notarized_file" text,
	"job_status" text DEFAULT 'open' NOT NULL,
	"user_id" integer,
	"session_token" text,
	"scheduled_at" timestamp,
	"completed_at" timestamp,
	"completed_by" integer,
	"created_at" timestamp DEFAULT now(),
	"requires_nsa" boolean DEFAULT false,
	"requires_spanish_speaking" boolean DEFAULT false,
	"assignment_attempts" integer DEFAULT 0,
	"rejected_notaries" text[] DEFAULT '{}',
	"is_random_assignment" boolean DEFAULT false,
	"notary_id" integer,
	"notary_approval_status" text DEFAULT 'pending_assignment' NOT NULL,
	"notary_approved_at" timestamp,
	"notary_approval_notes" text,
	"notary_approval_conditions" text,
	"signer_notifications_sent" boolean DEFAULT false,
	"signer_notifications_sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "notary_approval_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"notary_id" integer NOT NULL,
	"title_company" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"deadline" timestamp,
	"special_instructions" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_job_notary" UNIQUE("job_id","notary_id")
);
--> statement-breakpoint
CREATE TABLE "notary_assignment_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"notary_id" integer NOT NULL,
	"assignment_type" text NOT NULL,
	"assignment_status" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notary_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"notary_id" integer NOT NULL,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"is_recurring" boolean DEFAULT false,
	"recurring_pattern" text,
	"recurring_days" text[],
	"recurring_end_date" text,
	"timezone" text DEFAULT 'America/Los_Angeles',
	"max_concurrent_jobs" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notary_log_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"notary_id" integer NOT NULL,
	"signer_id" integer NOT NULL,
	"document_id" integer NOT NULL,
	"notarization_type" text NOT NULL,
	"page_number" integer NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notary_stamps" (
	"id" serial PRIMARY KEY NOT NULL,
	"notary_id" integer NOT NULL,
	"stamp_type" text NOT NULL,
	"stamp_data" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notary_time_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"notary_id" integer NOT NULL,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"job_id" integer,
	"block_reason" text,
	"timezone" text DEFAULT 'America/Los_Angeles',
	"is_manual_block" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notary_working_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"notary_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"timezone" text DEFAULT 'America/Los_Angeles',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"participant_id" integer NOT NULL,
	"job_id" integer NOT NULL,
	"session_id" integer,
	"participant_role" text NOT NULL,
	"base_compensation" integer NOT NULL,
	"session_duration" integer,
	"bonus_amount" integer DEFAULT 0,
	"total_amount" integer NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"session_completed_date" timestamp,
	"available_for_payout_date" timestamp,
	"paid_to_participant_date" timestamp,
	"stripe_transfer_id" text,
	"payment_method" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "payment_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"remaining_amount" integer NOT NULL,
	"installments" integer DEFAULT 1 NOT NULL,
	"current_installment" integer DEFAULT 1 NOT NULL,
	"next_payment_date" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"payer_id" integer NOT NULL,
	"payee_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_method" text,
	"transaction_id" text,
	"invoice_number" text,
	"due_date" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text NOT NULL,
	"user_color" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp DEFAULT now(),
	"left_at" timestamp,
	"id_verified" boolean DEFAULT false NOT NULL,
	"id_verified_at" timestamp,
	"id_verified_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"allow_participant_chat" boolean DEFAULT true,
	"auto_sync_screens" boolean DEFAULT false,
	"record_session" boolean DEFAULT true,
	"require_id_verification" boolean DEFAULT true,
	"max_concurrent_users" integer DEFAULT 10,
	"session_timeout" integer DEFAULT 7200,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signers" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer,
	"user_id" integer,
	"signer_name" text NOT NULL,
	"signer_email" text NOT NULL,
	"signer_phone_number" text NOT NULL,
	"signer_role" text NOT NULL,
	"invitation_token" text,
	"invitation_sent_at" timestamp,
	"access_type" text DEFAULT 'registered',
	"guest_verification_status" text DEFAULT 'pending',
	"signing_status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"processed" boolean DEFAULT false,
	"user_id" integer,
	"transaction_id" integer,
	"event_data" jsonb NOT NULL,
	"processing_error" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_webhook_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" varchar PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"type" text DEFAULT 'string' NOT NULL,
	"description" text,
	"is_protected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "title_companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"city" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"preferred_notary_id" integer,
	"created_at" timestamp DEFAULT now(),
	"migrated_to_companies_table" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "user_verification_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"attempt_number" integer NOT NULL,
	"evs_transaction_id" text,
	"status" text NOT NULL,
	"confidence_score" integer,
	"document_type" text,
	"front_image_uploaded" boolean DEFAULT false,
	"back_image_uploaded" boolean DEFAULT false,
	"selfie_uploaded" boolean DEFAULT false,
	"extracted_first_name" text,
	"extracted_last_name" text,
	"extracted_date_of_birth" text,
	"extracted_document_number" text,
	"extracted_expiration_date" text,
	"extracted_address" text,
	"face_match_result" boolean,
	"face_match_confidence" integer,
	"liveness_score" integer,
	"errors" text[],
	"warnings" text[],
	"ip_address" text,
	"user_agent" text,
	"attempted_at" timestamp DEFAULT now() NOT NULL,
	"processing_time_ms" integer,
	"api_environment" text DEFAULT 'sandbox',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'client' NOT NULL,
	"privileges" text[],
	"created_at" timestamp DEFAULT now(),
	"first_name" text,
	"last_name" text,
	"full_name" text,
	"phone_number" text,
	"address_1" text,
	"address_2" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"address" text,
	"company_id" integer,
	"company_role" text,
	"title" text,
	"commission_number" text,
	"commission_expiration" text,
	"county_parish" text,
	"disclosure" text,
	"signature_data" text,
	"initial_data" text,
	"notary_type" text,
	"is_active" boolean DEFAULT true,
	"account_balance" integer DEFAULT 0,
	"minimum_balance" integer DEFAULT 2500,
	"available_balance" integer DEFAULT 0,
	"pending_balance" integer DEFAULT 0,
	"total_earnings" integer DEFAULT 0,
	"total_spent" integer DEFAULT 0,
	"stripe_customer_id" text,
	"is_notary_signing_agent" boolean DEFAULT false,
	"nsa_expiration_date" text,
	"is_spanish_speaking" boolean DEFAULT false,
	"foreign_languages" text[],
	"max_concurrent_jobs" integer DEFAULT 1,
	"name_on_commission" text,
	"commission_address_1" text,
	"commission_address_2" text,
	"commission_city" text,
	"commission_state" text,
	"commission_zip_code" text,
	"commission_county" text,
	"notary_commission_file" text,
	"eo_insurance_company" text,
	"eo_insurance_amount" integer,
	"eo_insurance_expiration" text,
	"eo_insurance_file" text,
	"public_certificate_expiration" text,
	"public_certificate_file" text,
	"public_certificate_password" text,
	"bond_company_name" text,
	"bond_amount" integer,
	"bond_expiration" text,
	"bond_file" text,
	"signing_agent_certified" boolean DEFAULT false,
	"signing_agent_expiration_date" text,
	"signing_agent_file" text,
	"id_type" text,
	"id_number" text,
	"id_expiration_date" text,
	"id_issue_date" text,
	"evs_transaction_id" text,
	"evs_verification_confidence" integer,
	"evs_verified_at" timestamp,
	"evs_extracted_first_name" text,
	"evs_extracted_last_name" text,
	"evs_extracted_full_name" text,
	"evs_extracted_date_of_birth" text,
	"evs_extracted_address" text,
	"evs_face_match_result" boolean,
	"evs_face_match_confidence" integer,
	"evs_liveness_score" integer,
	"evs_verification_errors" text[],
	"evs_verification_warnings" text[],
	"evs_document_type_detected" text,
	"evs_verification_method" text DEFAULT 'api',
	"verification_ip_address" text,
	"verification_user_agent" text,
	"verification_retry_count" integer DEFAULT 0,
	"digital_certificate_file" text,
	"digital_certificate_expiration" text,
	"approval_status" text DEFAULT 'pending',
	"approved_by" integer,
	"approved_at" timestamp,
	"last_profile_update" timestamp DEFAULT now(),
	"approval_notes" text,
	"is_notifications_enabled" boolean DEFAULT true,
	"last_login_at" timestamp,
	"mfa_enabled" boolean DEFAULT false,
	"mfa_secret" text,
	"google_id" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_trail" ADD CONSTRAINT "audit_trail_session_id_editor_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."editor_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_trail" ADD CONSTRAINT "audit_trail_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_trail" ADD CONSTRAINT "audit_trail_document_id_job_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."job_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_notary_id_users_id_fk" FOREIGN KEY ("notary_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_preferred_notary_id_users_id_fk" FOREIGN KEY ("preferred_notary_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_company_manager_id_users_id_fk" FOREIGN KEY ("company_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_last_modified_by_users_id_fk" FOREIGN KEY ("last_modified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_payments" ADD CONSTRAINT "contractor_payments_contractor_id_users_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_payments" ADD CONSTRAINT "contractor_payments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_document_id_job_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."job_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_session_id_editor_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."editor_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_original_document_id_job_documents_id_fk" FOREIGN KEY ("original_document_id") REFERENCES "public"."job_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_session_id_editor_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."editor_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editor_sessions" ADD CONSTRAINT "editor_sessions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editor_sessions" ADD CONSTRAINT "editor_sessions_notary_id_users_id_fk" FOREIGN KEY ("notary_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_notary_id_users_id_fk" FOREIGN KEY ("notary_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_fee_breakdowns" ADD CONSTRAINT "job_fee_breakdowns_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_fee_breakdowns" ADD CONSTRAINT "job_fee_breakdowns_subscriber_notary_id_users_id_fk" FOREIGN KEY ("subscriber_notary_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_notifications" ADD CONSTRAINT "job_notifications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_notifications" ADD CONSTRAINT "job_notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_participants" ADD CONSTRAINT "job_participants_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_participants" ADD CONSTRAINT "job_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_notary_id_users_id_fk" FOREIGN KEY ("notary_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notary_approval_queue" ADD CONSTRAINT "notary_approval_queue_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notary_approval_queue" ADD CONSTRAINT "notary_approval_queue_notary_id_users_id_fk" FOREIGN KEY ("notary_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notary_assignment_log" ADD CONSTRAINT "notary_assignment_log_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notary_assignment_log" ADD CONSTRAINT "notary_assignment_log_notary_id_users_id_fk" FOREIGN KEY ("notary_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notary_availability" ADD CONSTRAINT "notary_availability_notary_id_users_id_fk" FOREIGN KEY ("notary_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notary_log_entries" ADD CONSTRAINT "notary_log_entries_session_id_editor_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."editor_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notary_log_entries" ADD CONSTRAINT "notary_log_entries_notary_id_users_id_fk" FOREIGN KEY ("notary_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notary_log_entries" ADD CONSTRAINT "notary_log_entries_signer_id_users_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notary_log_entries" ADD CONSTRAINT "notary_log_entries_document_id_job_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."job_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notary_stamps" ADD CONSTRAINT "notary_stamps_notary_id_users_id_fk" FOREIGN KEY ("notary_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notary_time_slots" ADD CONSTRAINT "notary_time_slots_notary_id_users_id_fk" FOREIGN KEY ("notary_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notary_time_slots" ADD CONSTRAINT "notary_time_slots_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notary_working_hours" ADD CONSTRAINT "notary_working_hours_notary_id_users_id_fk" FOREIGN KEY ("notary_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_payments" ADD CONSTRAINT "participant_payments_participant_id_users_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_payments" ADD CONSTRAINT "participant_payments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payee_id_users_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_session_id_editor_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."editor_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_id_verified_by_users_id_fk" FOREIGN KEY ("id_verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_settings" ADD CONSTRAINT "session_settings_session_id_editor_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."editor_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signers" ADD CONSTRAINT "signers_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signers" ADD CONSTRAINT "signers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_webhook_events" ADD CONSTRAINT "stripe_webhook_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_webhook_events" ADD CONSTRAINT "stripe_webhook_events_transaction_id_account_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."account_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_companies" ADD CONSTRAINT "title_companies_preferred_notary_id_users_id_fk" FOREIGN KEY ("preferred_notary_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_verification_attempts" ADD CONSTRAINT "user_verification_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;