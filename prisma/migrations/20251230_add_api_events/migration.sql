-- Migration: Add api_events table for request logging
-- This table stores API request events for error tracking and analytics

-- Create api_events table
CREATE TABLE IF NOT EXISTS "api_events" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER,
    "route" VARCHAR(255) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "status_code" INTEGER NOT NULL,
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "user_agent" VARCHAR(500),
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "api_events_user_id_fkey" FOREIGN KEY ("user_id") 
        REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "api_events_user_id_idx" ON "api_events"("user_id");
CREATE INDEX IF NOT EXISTS "api_events_route_idx" ON "api_events"("route");
CREATE INDEX IF NOT EXISTS "api_events_status_code_idx" ON "api_events"("status_code");
CREATE INDEX IF NOT EXISTS "api_events_created_at_idx" ON "api_events"("created_at");
CREATE INDEX IF NOT EXISTS "api_events_route_status_idx" ON "api_events"("route", "status_code");

