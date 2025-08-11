-- Normalize existing emails to lowercase and enforce case-insensitive uniqueness
-- 1) Update existing rows
UPDATE users SET email = LOWER(TRIM(email)) WHERE email IS NOT NULL;
UPDATE users SET username = LOWER(TRIM(username)) WHERE username IS NOT NULL;

-- 2) Drop existing unique constraint on email if it exists (case-sensitive)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name='users' AND constraint_type='UNIQUE' AND constraint_name ILIKE '%email%'
  ) THEN
    -- Find exact constraint name
    EXECUTE (
      SELECT 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(tc.constraint_name)
      FROM information_schema.table_constraints tc
      WHERE tc.table_name='users' AND tc.constraint_type='UNIQUE' AND tc.constraint_name ILIKE '%email%'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN others THEN
  -- ignore if cannot drop (e.g., different name); we'll create a functional unique index next
  NULL;
END$$;

-- 3) Create a unique index on lower(email) for case-insensitive uniqueness
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename='users' AND indexname='users_email_lower_unique'
  ) THEN
    CREATE UNIQUE INDEX users_email_lower_unique ON users ((LOWER(email)));
  END IF;
END$$;


