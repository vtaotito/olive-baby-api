-- Add onboarding_completed_at field to users table
ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);

-- Create index for querying users by onboarding status
CREATE INDEX "users_onboarding_completed_at_idx" ON "users"("onboarding_completed_at");
