-- Olive Baby API - AI Assistant Migration (Fixed)
-- Add pgvector extension and AI tables
-- This version handles the case where pgvector might not be available initially

-- ==========================================
-- Enable pgvector extension (if available)
-- ==========================================
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pgvector extension not available, continuing without it';
END $$;

-- ==========================================
-- AI Documents (fontes de conhecimento)
-- ==========================================
CREATE TABLE IF NOT EXISTS "ai_documents" (
    "id" SERIAL PRIMARY KEY,
    "source" VARCHAR(500) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "tags" TEXT[] DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "content_hash" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ai_documents_source_idx" ON "ai_documents"("source");
CREATE INDEX IF NOT EXISTS "ai_documents_tags_idx" ON "ai_documents" USING GIN ("tags");

-- ==========================================
-- AI Chunks (pedaços de documentos com embeddings)
-- ==========================================
-- Note: embedding column type depends on pgvector availability
DO $$
BEGIN
    CREATE TABLE IF NOT EXISTS "ai_chunks" (
        "id" SERIAL PRIMARY KEY,
        "document_id" INTEGER NOT NULL,
        "chunk_index" INTEGER NOT NULL,
        "content" TEXT NOT NULL,
        "embedding" vector(1536),
        "metadata" JSONB DEFAULT '{}',
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT "ai_chunks_document_id_fkey" FOREIGN KEY ("document_id") 
            REFERENCES "ai_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
EXCEPTION
    WHEN OTHERS THEN
        -- Fallback: create without vector type
        CREATE TABLE IF NOT EXISTS "ai_chunks" (
            "id" SERIAL PRIMARY KEY,
            "document_id" INTEGER NOT NULL,
            "chunk_index" INTEGER NOT NULL,
            "content" TEXT NOT NULL,
            "embedding" BYTEA,
            "metadata" JSONB DEFAULT '{}',
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            
            CONSTRAINT "ai_chunks_document_id_fkey" FOREIGN KEY ("document_id") 
                REFERENCES "ai_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
END $$;

CREATE INDEX IF NOT EXISTS "ai_chunks_document_id_idx" ON "ai_chunks"("document_id");

-- ==========================================
-- AI Chat Sessions (sessões de chat)
-- ==========================================
CREATE TABLE IF NOT EXISTS "ai_chat_sessions" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "baby_id" INTEGER NOT NULL,
    "title" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "ai_chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") 
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ai_chat_sessions_baby_id_fkey" FOREIGN KEY ("baby_id") 
        REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ai_chat_sessions_user_id_idx" ON "ai_chat_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "ai_chat_sessions_baby_id_idx" ON "ai_chat_sessions"("baby_id");
CREATE INDEX IF NOT EXISTS "ai_chat_sessions_user_baby_idx" ON "ai_chat_sessions"("user_id", "baby_id");

-- ==========================================
-- AI Chat Messages (mensagens do chat)
-- ==========================================
CREATE TYPE IF NOT EXISTS "ai_message_role" AS ENUM ('user', 'assistant', 'tool', 'system');

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
    
    CONSTRAINT "ai_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") 
        REFERENCES "ai_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ai_chat_messages_session_id_idx" ON "ai_chat_messages"("session_id");
CREATE INDEX IF NOT EXISTS "ai_chat_messages_session_created_idx" ON "ai_chat_messages"("session_id", "created_at");

-- ==========================================
-- AI Insights (insights gerados automaticamente)
-- ==========================================
CREATE TYPE IF NOT EXISTS "ai_insight_severity" AS ENUM ('info', 'warning', 'alert');
CREATE TYPE IF NOT EXISTS "ai_insight_type" AS ENUM (
    'sleep_pattern',
    'feeding_pattern', 
    'diaper_alert',
    'cluster_feeding',
    'breast_distribution',
    'growth_trend',
    'milestone_suggestion',
    'routine_anomaly',
    'general'
);

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
    
    CONSTRAINT "ai_insights_baby_id_fkey" FOREIGN KEY ("baby_id") 
        REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ai_insights_baby_id_idx" ON "ai_insights"("baby_id");
CREATE INDEX IF NOT EXISTS "ai_insights_baby_type_idx" ON "ai_insights"("baby_id", "type");
CREATE INDEX IF NOT EXISTS "ai_insights_severity_idx" ON "ai_insights"("severity");
CREATE INDEX IF NOT EXISTS "ai_insights_created_idx" ON "ai_insights"("created_at");
