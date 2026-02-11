-- AlterEnum: Add new PlanType values
ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'PROFESSIONAL_BASIC';
ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'PROFESSIONAL_ADVANCED';
ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'PROFESSIONAL_PRO';
ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'CLINIC_STARTER';
ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'CLINIC_GROWTH';
ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'CLINIC_ENTERPRISE';

-- Add gender to Baby
ALTER TABLE "babies" ADD COLUMN IF NOT EXISTS "gender" "Gender" DEFAULT 'NOT_INFORMED';

-- Create new enums
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED');
CREATE TYPE "AppointmentType" AS ENUM ('CONSULTA_ROTINA', 'RETORNO', 'VACINA', 'URGENCIA', 'TELEMEDICINA', 'OUTRO');
CREATE TYPE "VisitType" AS ENUM ('CONSULTA_ROTINA', 'RETORNO', 'URGENCIA', 'VACINA', 'OUTRO');

-- CreateTable: clinics
CREATE TABLE "clinics" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "cnpj" VARCHAR(18),
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" CHAR(2),
    "country" CHAR(2) NOT NULL DEFAULT 'BR',
    "logo_url" VARCHAR(500),
    "primary_color" VARCHAR(7),
    "favicon_url" VARCHAR(500),
    "support_email" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "stripe_customer_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "clinics_slug_key" ON "clinics"("slug");
CREATE UNIQUE INDEX "clinics_cnpj_key" ON "clinics"("cnpj");
CREATE INDEX "clinics_slug_idx" ON "clinics"("slug");

-- CreateTable: clinic_professionals
CREATE TABLE "clinic_professionals" (
    "id" SERIAL NOT NULL,
    "clinic_id" INTEGER NOT NULL,
    "professional_id" INTEGER NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_professionals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "clinic_professionals_clinic_id_professional_id_key" ON "clinic_professionals"("clinic_id", "professional_id");
CREATE INDEX "clinic_professionals_clinic_id_idx" ON "clinic_professionals"("clinic_id");
CREATE INDEX "clinic_professionals_professional_id_idx" ON "clinic_professionals"("professional_id");

-- CreateTable: baby_clinical_info
CREATE TABLE "baby_clinical_info" (
    "id" SERIAL NOT NULL,
    "baby_id" INTEGER NOT NULL,
    "allergies" JSONB DEFAULT '[]',
    "chronic_conditions" JSONB DEFAULT '[]',
    "medications" JSONB DEFAULT '[]',
    "family_history" TEXT,
    "feeding_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "baby_clinical_info_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "baby_clinical_info_baby_id_key" ON "baby_clinical_info"("baby_id");

-- CreateTable: clinical_visits
CREATE TABLE "clinical_visits" (
    "id" SERIAL NOT NULL,
    "baby_id" INTEGER NOT NULL,
    "professional_id" INTEGER NOT NULL,
    "clinic_id" INTEGER,
    "visit_date" TIMESTAMP(3) NOT NULL,
    "visit_type" "VisitType" NOT NULL,
    "chief_complaint" TEXT,
    "history" TEXT,
    "physical_exam" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "weight_kg" DECIMAL(5,2),
    "height_cm" DECIMAL(5,2),
    "head_circumference_cm" DECIMAL(5,2),
    "next_visit_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_visits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "clinical_visits_baby_id_idx" ON "clinical_visits"("baby_id");
CREATE INDEX "clinical_visits_professional_id_idx" ON "clinical_visits"("professional_id");
CREATE INDEX "clinical_visits_clinic_id_idx" ON "clinical_visits"("clinic_id");
CREATE INDEX "clinical_visits_visit_date_idx" ON "clinical_visits"("visit_date");

-- CreateTable: professional_schedules
CREATE TABLE "professional_schedules" (
    "id" SERIAL NOT NULL,
    "professional_id" INTEGER NOT NULL,
    "clinic_id" INTEGER,
    "day_of_week" INTEGER NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "slot_duration" INTEGER NOT NULL DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" DATE,
    "valid_until" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_schedules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "professional_schedules_professional_id_idx" ON "professional_schedules"("professional_id");
CREATE INDEX "professional_schedules_clinic_id_idx" ON "professional_schedules"("clinic_id");
CREATE INDEX "professional_schedules_day_of_week_idx" ON "professional_schedules"("day_of_week");

-- CreateTable: schedule_exceptions
CREATE TABLE "schedule_exceptions" (
    "id" SERIAL NOT NULL,
    "professional_id" INTEGER NOT NULL,
    "clinic_id" INTEGER,
    "exception_date" DATE NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "start_time" VARCHAR(5),
    "end_time" VARCHAR(5),
    "reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_exceptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "schedule_exceptions_professional_id_idx" ON "schedule_exceptions"("professional_id");
CREATE INDEX "schedule_exceptions_clinic_id_idx" ON "schedule_exceptions"("clinic_id");
CREATE INDEX "schedule_exceptions_exception_date_idx" ON "schedule_exceptions"("exception_date");

-- CreateTable: appointments
CREATE TABLE "appointments" (
    "id" SERIAL NOT NULL,
    "baby_id" INTEGER NOT NULL,
    "professional_id" INTEGER NOT NULL,
    "clinic_id" INTEGER,
    "visit_id" INTEGER,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "type" "AppointmentType" NOT NULL DEFAULT 'CONSULTA_ROTINA',
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "title" VARCHAR(255),
    "notes" TEXT,
    "cancellation_reason" VARCHAR(255),
    "cancelled_at" TIMESTAMP(3),
    "booked_by_user_id" INTEGER,
    "source" VARCHAR(50),
    "reminder_sent_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "appointments_baby_id_idx" ON "appointments"("baby_id");
CREATE INDEX "appointments_professional_id_idx" ON "appointments"("professional_id");
CREATE INDEX "appointments_clinic_id_idx" ON "appointments"("clinic_id");
CREATE INDEX "appointments_start_at_idx" ON "appointments"("start_at");
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateTable: prescriptions
CREATE TABLE "prescriptions" (
    "id" SERIAL NOT NULL,
    "baby_id" INTEGER NOT NULL,
    "professional_id" INTEGER NOT NULL,
    "visit_id" INTEGER,
    "prescription_date" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3),
    "items" JSONB NOT NULL,
    "instructions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "prescriptions_baby_id_idx" ON "prescriptions"("baby_id");
CREATE INDEX "prescriptions_professional_id_idx" ON "prescriptions"("professional_id");

-- CreateTable: medical_certificates
CREATE TABLE "medical_certificates" (
    "id" SERIAL NOT NULL,
    "baby_id" INTEGER NOT NULL,
    "professional_id" INTEGER NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "content" TEXT NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_certificates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "medical_certificates_baby_id_idx" ON "medical_certificates"("baby_id");
CREATE INDEX "medical_certificates_professional_id_idx" ON "medical_certificates"("professional_id");

-- CreateTable: clinic_subscriptions
CREATE TABLE "clinic_subscriptions" (
    "id" SERIAL NOT NULL,
    "clinic_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripe_subscription_id" VARCHAR(255),
    "stripe_price_id" VARCHAR(255),
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "trial_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "clinic_subscriptions_clinic_id_key" ON "clinic_subscriptions"("clinic_id");
CREATE UNIQUE INDEX "clinic_subscriptions_stripe_subscription_id_key" ON "clinic_subscriptions"("stripe_subscription_id");

-- AddForeignKey
ALTER TABLE "clinic_professionals" ADD CONSTRAINT "clinic_professionals_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_professionals" ADD CONSTRAINT "clinic_professionals_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "baby_clinical_info" ADD CONSTRAINT "baby_clinical_info_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clinical_visits" ADD CONSTRAINT "clinical_visits_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinical_visits" ADD CONSTRAINT "clinical_visits_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinical_visits" ADD CONSTRAINT "clinical_visits_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "professional_schedules" ADD CONSTRAINT "professional_schedules_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "professional_schedules" ADD CONSTRAINT "professional_schedules_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "clinical_visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "clinical_visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "medical_certificates" ADD CONSTRAINT "medical_certificates_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "medical_certificates" ADD CONSTRAINT "medical_certificates_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clinic_subscriptions" ADD CONSTRAINT "clinic_subscriptions_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_subscriptions" ADD CONSTRAINT "clinic_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
