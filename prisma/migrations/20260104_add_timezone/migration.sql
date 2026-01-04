-- Add timezone column to user_settings table
-- Default to America/Sao_Paulo (Brasília timezone)

ALTER TABLE "user_settings" 
ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(50) NOT NULL DEFAULT 'America/Sao_Paulo';

-- Create index for faster timezone lookups
CREATE INDEX IF NOT EXISTS "user_settings_timezone_idx" ON "user_settings" ("timezone");
