-- Olive Baby API - Billing and AI Admin Migration
-- Created: 2026-01-03

-- ===========================================
-- ALTER ENUMS
-- ===========================================

-- Add new subscription statuses
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'INCOMPLETE';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'INCOMPLETE_EXPIRED';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'UNPAID';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'TRIALING';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PAUSED';

-- Create billing interval enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BillingInterval') THEN
    CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');
  END IF;
END $$;

-- Create AI config status enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AiConfigStatus') THEN
    CREATE TYPE "AiConfigStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
  END IF;
END $$;

-- Create Knowledge Base status enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'KnowledgeBaseStatus') THEN
    CREATE TYPE "KnowledgeBaseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
  END IF;
END $$;

-- ===========================================
-- ALTER USER TABLE
-- ===========================================

-- Add Stripe fields to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" TEXT UNIQUE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "current_period_end" TIMESTAMP;

-- Create index on stripe_customer_id
CREATE INDEX IF NOT EXISTS "users_stripe_customer_id_idx" ON "users"("stripe_customer_id");

-- ===========================================
-- ALTER PLANS TABLE
-- ===========================================

-- Add code column if not exists
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "code" VARCHAR(50);

-- Make code unique (update existing rows first)
UPDATE "plans" SET "code" = "name" WHERE "code" IS NULL;
ALTER TABLE "plans" ALTER COLUMN "code" SET NOT NULL;

-- Add price_yearly column
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "price_yearly" DECIMAL(10, 2);

-- Add Stripe integration fields
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "stripe_product_id" TEXT;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "stripe_price_id_monthly" TEXT;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "stripe_price_id_yearly" TEXT;

-- Create index on stripe_product_id
CREATE INDEX IF NOT EXISTS "plans_stripe_product_id_idx" ON "plans"("stripe_product_id");

-- Create unique constraint on code
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_code_key') THEN
    ALTER TABLE "plans" ADD CONSTRAINT "plans_code_key" UNIQUE ("code");
  END IF;
END $$;

-- ===========================================
-- ALTER SUBSCRIPTIONS TABLE
-- ===========================================

-- Add Stripe subscription fields
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" TEXT UNIQUE;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "stripe_price_id" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "interval" "BillingInterval" DEFAULT 'MONTHLY';
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "cancel_at_period_end" BOOLEAN DEFAULT FALSE;

-- Create index on stripe_subscription_id
CREATE INDEX IF NOT EXISTS "subscriptions_stripe_subscription_id_idx" ON "subscriptions"("stripe_subscription_id");

-- ===========================================
-- CREATE BILLING EVENTS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS "billing_events" (
  "id" SERIAL PRIMARY KEY,
  "stripe_event_id" TEXT UNIQUE NOT NULL,
  "type" VARCHAR(100) NOT NULL,
  "payload" JSONB NOT NULL,
  "processed" BOOLEAN DEFAULT FALSE,
  "processed_at" TIMESTAMP,
  "error_message" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "billing_events_type_idx" ON "billing_events"("type");
CREATE INDEX IF NOT EXISTS "billing_events_processed_idx" ON "billing_events"("processed");
CREATE INDEX IF NOT EXISTS "billing_events_created_at_idx" ON "billing_events"("created_at");

-- ===========================================
-- CREATE AI ASSISTANT CONFIGS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS "ai_assistant_configs" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL,
  "system_prompt" TEXT NOT NULL,
  "guardrails" JSONB DEFAULT '{}',
  "model" VARCHAR(50) DEFAULT 'gpt-4o',
  "temperature" DECIMAL(3, 2) DEFAULT 0.7,
  "max_tokens" INTEGER DEFAULT 2048,
  "status" "AiConfigStatus" DEFAULT 'DRAFT',
  "version" INTEGER DEFAULT 1,
  "is_published" BOOLEAN DEFAULT FALSE,
  "published_at" TIMESTAMP,
  "created_by_id" INTEGER,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ai_assistant_configs_status_idx" ON "ai_assistant_configs"("status");
CREATE INDEX IF NOT EXISTS "ai_assistant_configs_is_published_idx" ON "ai_assistant_configs"("is_published");
CREATE INDEX IF NOT EXISTS "ai_assistant_configs_version_idx" ON "ai_assistant_configs"("version");

-- ===========================================
-- CREATE KNOWLEDGE BASE DOCUMENTS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS "knowledge_base_documents" (
  "id" SERIAL PRIMARY KEY,
  "title" VARCHAR(255) NOT NULL,
  "source_type" VARCHAR(50) NOT NULL,
  "content" TEXT NOT NULL,
  "tags" TEXT[] DEFAULT '{}',
  "status" "KnowledgeBaseStatus" DEFAULT 'DRAFT',
  "version" INTEGER DEFAULT 1,
  "published_at" TIMESTAMP,
  "archived_at" TIMESTAMP,
  "created_by_id" INTEGER,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "knowledge_base_documents_status_idx" ON "knowledge_base_documents"("status");
CREATE INDEX IF NOT EXISTS "knowledge_base_documents_tags_idx" ON "knowledge_base_documents" USING GIN ("tags");
CREATE INDEX IF NOT EXISTS "knowledge_base_documents_source_type_idx" ON "knowledge_base_documents"("source_type");

-- ===========================================
-- SEED DATA
-- ===========================================

-- Update existing plans with code if needed
UPDATE "plans" SET "code" = 'FREE' WHERE "type" = 'FREE' AND ("code" IS NULL OR "code" = '');
UPDATE "plans" SET "code" = 'PREMIUM' WHERE "type" = 'PREMIUM' AND ("code" IS NULL OR "code" = '');

-- Ensure FREE plan exists
INSERT INTO "plans" ("name", "code", "type", "description", "price", "currency", "limits", "features", "is_active", "created_at", "updated_at")
SELECT 'Gratuito', 'FREE', 'FREE', 'Plano gratuito com recursos básicos', 0, 'BRL', 
  '{"maxBabies":1,"maxProfessionals":0,"maxExportsPerMonth":0,"historyDays":7}'::jsonb,
  '{"exportPdf":false,"exportCsv":false,"advancedInsights":false,"aiChat":false,"multiCaregivers":false,"prioritySupport":false}'::jsonb,
  true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE "type" = 'FREE');

-- Ensure PREMIUM plan exists
INSERT INTO "plans" ("name", "code", "type", "description", "price", "price_yearly", "currency", "limits", "features", "is_active", "created_at", "updated_at")
SELECT 'Premium', 'PREMIUM', 'PREMIUM', 'Plano premium com todos os recursos', 29.99, 299.90, 'BRL',
  '{"maxBabies":5,"maxProfessionals":10,"maxExportsPerMonth":100,"historyDays":365}'::jsonb,
  '{"exportPdf":true,"exportCsv":true,"advancedInsights":true,"aiChat":true,"multiCaregivers":true,"prioritySupport":true}'::jsonb,
  true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE "type" = 'PREMIUM');

-- Create default AI config
INSERT INTO "ai_assistant_configs" ("name", "system_prompt", "guardrails", "model", "temperature", "max_tokens", "status", "is_published", "published_at", "version", "created_at", "updated_at")
SELECT 
  'Assistente Materno Padrão',
  'Você é um assistente especializado em cuidados com bebês para o aplicativo Olive Baby.

Seu papel é:
1. Ajudar pais e cuidadores com dúvidas sobre rotinas de bebês
2. Fornecer informações baseadas em evidências sobre amamentação, sono, fraldas e desenvolvimento infantil
3. Analisar padrões nas rotinas registradas e fornecer insights úteis
4. Sempre recomendar consulta com profissional de saúde para questões médicas

Diretrizes:
- Seja empático e acolhedor
- Use linguagem clara e acessível
- Baseie suas respostas em fontes confiáveis
- Nunca dê diagnósticos médicos
- Sempre sugira consulta profissional quando apropriado',
  '{"maxResponseLength":1000,"blockedTopics":["medicamentos_sem_receita","diagnosticos_medicos"],"requiredDisclaimer":true}'::jsonb,
  'gpt-4o',
  0.7,
  2048,
  'PUBLISHED',
  true,
  NOW(),
  1,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "ai_assistant_configs" WHERE "is_published" = true);
