-- Create enums for notifications
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');
CREATE TYPE "NotificationType" AS ENUM ('INSIGHT', 'ALERT', 'REMINDER', 'SYSTEM', 'ACHIEVEMENT');
CREATE TYPE "NotificationSeverity" AS ENUM ('info', 'warning', 'alert', 'success');

-- Create notifications table
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "baby_id" INTEGER,
    "type" "NotificationType" NOT NULL DEFAULT 'INSIGHT',
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'info',
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "cta_label" VARCHAR(100),
    "cta_url" VARCHAR(500),
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "source_key" VARCHAR(255),
    "meta" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");
CREATE INDEX "notifications_user_id_status_idx" ON "notifications"("user_id", "status");
CREATE INDEX "notifications_user_id_type_idx" ON "notifications"("user_id", "type");
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- Create unique constraint for source_key (for deduplication)
CREATE UNIQUE INDEX "notifications_user_id_source_key_key" ON "notifications"("user_id", "source_key");

-- Add foreign key
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
