-- Olive Baby API - AI Assistant Migration
-- Add pgvector extension and AI tables

-- ==========================================
-- Enable pgvector extension
-- ==========================================
CREATE EXTENSION IF NOT EXISTS vector;

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

CREATE INDEX IF NOT EXISTS "ai_chunks_document_id_idx" ON "ai_chunks"("document_id");
-- IVFFlat index for vector similarity search (adjust lists based on data size)
CREATE INDEX IF NOT EXISTS "ai_chunks_embedding_idx" ON "ai_chunks" 
    USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

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
CREATE TYPE "ai_message_role" AS ENUM ('user', 'assistant', 'tool', 'system');

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
CREATE TYPE "ai_insight_severity" AS ENUM ('info', 'warning', 'alert');
CREATE TYPE "ai_insight_type" AS ENUM (
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

-- ==========================================
-- Helper function for vector similarity search
-- ==========================================
CREATE OR REPLACE FUNCTION search_ai_chunks(
    query_embedding vector(1536),
    match_count INT DEFAULT 6,
    filter_tags TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    id INT,
    document_id INT,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.document_id,
        c.content,
        c.metadata,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM ai_chunks c
    JOIN ai_documents d ON c.document_id = d.id
    WHERE 
        c.embedding IS NOT NULL
        AND (filter_tags IS NULL OR d.tags && filter_tags)
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
