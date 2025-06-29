-- Migration to add notary calendar and availability system
-- Run this against your database to add the new calendar tables

-- Create notary_availability table for recurring availability patterns
CREATE TABLE IF NOT EXISTS notary_availability (
  id SERIAL PRIMARY KEY,
  notary_id INTEGER REFERENCES users(id) NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD format
  start_time TEXT NOT NULL, -- HH:MM format
  end_time TEXT NOT NULL, -- HH:MM format
  is_recurring BOOLEAN DEFAULT false,
  recurring_pattern TEXT, -- 'daily', 'weekly', 'monthly'
  recurring_days TEXT[], -- ['monday', 'tuesday', etc.]
  recurring_end_date TEXT, -- YYYY-MM-DD format
  timezone TEXT DEFAULT 'America/Los_Angeles',
  max_concurrent_jobs INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create notary_time_slots table for individual time slot management
CREATE TABLE IF NOT EXISTS notary_time_slots (
  id SERIAL PRIMARY KEY,
  notary_id INTEGER REFERENCES users(id) NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD format
  start_time TEXT NOT NULL, -- HH:MM format
  end_time TEXT NOT NULL, -- HH:MM format
  status TEXT DEFAULT 'available' NOT NULL, -- 'available', 'busy', 'blocked', 'booked'
  job_id INTEGER REFERENCES jobs(id), -- Reference to job if booked
  block_reason TEXT, -- Reason for manual block (vacation, personal, etc.)
  timezone TEXT DEFAULT 'America/Los_Angeles',
  is_manual_block BOOLEAN DEFAULT false, -- true if manually blocked by notary
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create notary_working_hours table for weekly schedule patterns
CREATE TABLE IF NOT EXISTS notary_working_hours (
  id SERIAL PRIMARY KEY,
  notary_id INTEGER REFERENCES users(id) NOT NULL,
  day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, etc.
  start_time TEXT NOT NULL, -- HH:MM format
  end_time TEXT NOT NULL, -- HH:MM format
  is_active BOOLEAN DEFAULT true,
  timezone TEXT DEFAULT 'America/Los_Angeles',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create calendar_events table for personal calendar tracking
CREATE TABLE IF NOT EXISTS calendar_events (
  id SERIAL PRIMARY KEY,
  notary_id INTEGER REFERENCES users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_date_time TIMESTAMP NOT NULL,
  end_date_time TIMESTAMP NOT NULL,
  location TEXT,
  event_type TEXT DEFAULT 'personal' NOT NULL, -- 'personal', 'job', 'appointment', 'vacation'
  is_all_day BOOLEAN DEFAULT false,
  job_id INTEGER REFERENCES jobs(id), -- If event is related to a job
  reminders JSONB, -- Array of reminder settings
  is_recurring BOOLEAN DEFAULT false,
  recurring_pattern JSONB, -- Recurring pattern details
  google_event_id TEXT, -- For future Google Calendar integration
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notary_availability_notary_id ON notary_availability(notary_id);
CREATE INDEX IF NOT EXISTS idx_notary_availability_date ON notary_availability(date);
CREATE INDEX IF NOT EXISTS idx_notary_availability_notary_date ON notary_availability(notary_id, date);

CREATE INDEX IF NOT EXISTS idx_notary_time_slots_notary_id ON notary_time_slots(notary_id);
CREATE INDEX IF NOT EXISTS idx_notary_time_slots_date ON notary_time_slots(date);
CREATE INDEX IF NOT EXISTS idx_notary_time_slots_status ON notary_time_slots(status);
CREATE INDEX IF NOT EXISTS idx_notary_time_slots_notary_date ON notary_time_slots(notary_id, date);
CREATE INDEX IF NOT EXISTS idx_notary_time_slots_job_id ON notary_time_slots(job_id);

CREATE INDEX IF NOT EXISTS idx_notary_working_hours_notary_id ON notary_working_hours(notary_id);
CREATE INDEX IF NOT EXISTS idx_notary_working_hours_day_of_week ON notary_working_hours(day_of_week);

CREATE INDEX IF NOT EXISTS idx_calendar_events_notary_id ON calendar_events(notary_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON calendar_events(start_date_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_type ON calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_calendar_events_job_id ON calendar_events(job_id);

-- Add check constraints
ALTER TABLE notary_time_slots ADD CONSTRAINT check_time_slot_status 
  CHECK (status IN ('available', 'busy', 'blocked', 'booked'));

ALTER TABLE notary_availability ADD CONSTRAINT check_recurring_pattern 
  CHECK (recurring_pattern IS NULL OR recurring_pattern IN ('daily', 'weekly', 'monthly'));

ALTER TABLE calendar_events ADD CONSTRAINT check_event_type 
  CHECK (event_type IN ('personal', 'job', 'appointment', 'vacation'));

ALTER TABLE notary_working_hours ADD CONSTRAINT check_day_of_week 
  CHECK (day_of_week >= 0 AND day_of_week <= 6);

-- Add constraint for time format validation (HH:MM)
ALTER TABLE notary_availability ADD CONSTRAINT check_start_time_format 
  CHECK (start_time ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE notary_availability ADD CONSTRAINT check_end_time_format 
  CHECK (end_time ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE notary_time_slots ADD CONSTRAINT check_start_time_format 
  CHECK (start_time ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE notary_time_slots ADD CONSTRAINT check_end_time_format 
  CHECK (end_time ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE notary_working_hours ADD CONSTRAINT check_start_time_format 
  CHECK (start_time ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE notary_working_hours ADD CONSTRAINT check_end_time_format 
  CHECK (end_time ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$');

-- Migration completed - calendar system tables created 