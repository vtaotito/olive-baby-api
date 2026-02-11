-- Create PatientInviteStatus enum
DO $$ BEGIN
  CREATE TYPE "PatientInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create patient_invites table
CREATE TABLE IF NOT EXISTS "patient_invites" (
  "id" SERIAL PRIMARY KEY,
  "professional_id" INTEGER NOT NULL,
  "patient_name" VARCHAR(255) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "phone" VARCHAR(50),
  "baby_name" VARCHAR(255),
  "message" TEXT,
  "token" VARCHAR(64) UNIQUE NOT NULL,
  "status" "PatientInviteStatus" NOT NULL DEFAULT 'PENDING',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "accepted_at" TIMESTAMP(3),
  CONSTRAINT "patient_invites_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "patient_invites_professional_id_idx" ON "patient_invites"("professional_id");
CREATE INDEX IF NOT EXISTS "patient_invites_email_idx" ON "patient_invites"("email");
CREATE INDEX IF NOT EXISTS "patient_invites_token_idx" ON "patient_invites"("token");
