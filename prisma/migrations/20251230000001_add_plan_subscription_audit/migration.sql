-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIAL');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM (
  'PAYWALL_HIT',
  'PLAN_UPGRADED',
  'PLAN_DOWNGRADED',
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_CANCELED',
  'ADMIN_PLAN_CHANGED',
  'ADMIN_USER_BLOCKED',
  'ADMIN_USER_UNBLOCKED',
  'ADMIN_IMPERSONATE_START',
  'ADMIN_IMPERSONATE_END',
  'USER_LOGIN',
  'USER_LOGOUT',
  'USER_REGISTERED',
  'USER_PASSWORD_CHANGED',
  'USER_PROFILE_UPDATED',
  'FEATURE_EXPORT_PDF',
  'FEATURE_EXPORT_CSV',
  'FEATURE_AI_CHAT',
  'FEATURE_BABY_CREATED',
  'FEATURE_PROFESSIONAL_INVITED'
);

-- CreateTable
CREATE TABLE "plans" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "type" "PlanType" NOT NULL,
    "description" VARCHAR(500),
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "limits" JSONB NOT NULL DEFAULT '{"maxBabies":1,"maxProfessionals":0,"maxExportsPerMonth":0,"historyDays":7}',
    "features" JSONB NOT NULL DEFAULT '{"exportPdf":false,"exportCsv":false,"advancedInsights":false,"aiChat":false,"multiCaregivers":false,"prioritySupport":false}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "provider" VARCHAR(50),
    "external_id" VARCHAR(255),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "trial_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" "AuditAction" NOT NULL,
    "target_type" VARCHAR(50),
    "target_id" INTEGER,
    "metadata" JSONB DEFAULT '{}',
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add new columns to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan_id" INTEGER;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_activity_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");
CREATE UNIQUE INDEX "plans_type_key" ON "plans"("type");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX "subscriptions_external_id_idx" ON "subscriptions"("external_id");

-- CreateIndex
CREATE INDEX "audit_events_user_id_idx" ON "audit_events"("user_id");
CREATE INDEX "audit_events_action_idx" ON "audit_events"("action");
CREATE INDEX "audit_events_target_type_target_id_idx" ON "audit_events"("target_type", "target_id");
CREATE INDEX "audit_events_created_at_idx" ON "audit_events"("created_at");

-- CreateIndex (users)
CREATE INDEX IF NOT EXISTS "users_plan_id_idx" ON "users"("plan_id");
CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users"("status");
CREATE INDEX IF NOT EXISTS "users_last_activity_at_idx" ON "users"("last_activity_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Insert default plans
INSERT INTO "plans" ("name", "type", "description", "price", "limits", "features", "is_active", "updated_at")
VALUES 
(
  'Free',
  'FREE',
  'Plano gratuito com recursos básicos',
  0,
  '{"maxBabies": 1, "maxProfessionals": 0, "maxExportsPerMonth": 0, "historyDays": 7}',
  '{"exportPdf": false, "exportCsv": false, "advancedInsights": false, "aiChat": false, "multiCaregivers": false, "prioritySupport": false}',
  true,
  CURRENT_TIMESTAMP
),
(
  'Premium',
  'PREMIUM',
  'Plano premium com todos os recursos',
  29.90,
  '{"maxBabies": 5, "maxProfessionals": 10, "maxExportsPerMonth": -1, "historyDays": -1}',
  '{"exportPdf": true, "exportCsv": true, "advancedInsights": true, "aiChat": true, "multiCaregivers": true, "prioritySupport": true}',
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

-- Set default plan for existing users (FREE plan)
UPDATE "users" SET "plan_id" = (SELECT id FROM "plans" WHERE "type" = 'FREE') WHERE "plan_id" IS NULL;

