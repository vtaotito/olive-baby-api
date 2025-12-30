#!/bin/bash
# Script para executar o fix da migração diretamente no PostgreSQL

PGPASSWORD="OliveBaby@2024Secure!" psql -h olivebaby-db -U olivebaby -d olivebaby <<'EOSQL'
-- AI Chat Sessions
CREATE TABLE IF NOT EXISTS "ai_chat_sessions" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "baby_id" INTEGER NOT NULL,
    "title" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "ai_chat_sessions_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "ai_chat_sessions_user_id_idx" ON "ai_chat_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "ai_chat_sessions_baby_id_idx" ON "ai_chat_sessions"("baby_id");
CREATE INDEX IF NOT EXISTS "ai_chat_sessions_user_baby_idx" ON "ai_chat_sessions"("user_id", "baby_id");

-- AI Message Role Type
DO $$ BEGIN
    CREATE TYPE "ai_message_role" AS ENUM ('user', 'assistant', 'tool', 'system');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AI Chat Messages
CREATE TABLE IF NOT EXISTS "ai_chat_messages" (
    "id" SERIAL PRIMARY KEY,
    "session_id" INTEGER NOT NULL,
    "role" "ai_message_role" NOT NULL,
    "content" TEXT NOT NULL,
    "tool_name" VARCHAR(100),
    "tool_payload" JSONB,
    "citations" JSONB DEFAULT '[]',
    "tokens_used" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_chat_sessions"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "ai_chat_messages_session_id_idx" ON "ai_chat_messages"("session_id");
CREATE INDEX IF NOT EXISTS "ai_chat_messages_session_created_idx" ON "ai_chat_messages"("session_id", "created_at");

-- AI Insight Types
DO $$ BEGIN
    CREATE TYPE "ai_insight_severity" AS ENUM ('info', 'warning', 'alert');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ai_insight_type" AS ENUM ('sleep_pattern', 'feeding_pattern', 'diaper_alert', 'cluster_feeding', 'breast_distribution', 'growth_trend', 'milestone_suggestion', 'routine_anomaly', 'general');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AI Insights
CREATE TABLE IF NOT EXISTS "ai_insights" (
    "id" SERIAL PRIMARY KEY,
    "baby_id" INTEGER NOT NULL,
    "type" "ai_insight_type" NOT NULL,
    "severity" "ai_insight_severity" NOT NULL DEFAULT 'info',
    "title" VARCHAR(255) NOT NULL,
    "explanation" TEXT NOT NULL,
    "recommendation" TEXT,
    "data" JSONB DEFAULT '{}',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_insights_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "ai_insights_baby_id_idx" ON "ai_insights"("baby_id");
CREATE INDEX IF NOT EXISTS "ai_insights_baby_type_idx" ON "ai_insights"("baby_id", "type");
CREATE INDEX IF NOT EXISTS "ai_insights_severity_idx" ON "ai_insights"("severity");
CREATE INDEX IF NOT EXISTS "ai_insights_created_idx" ON "ai_insights"("created_at");
EOSQL

echo "Tabelas AI criadas com sucesso!"
