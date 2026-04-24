-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('INSTAGRAM', 'LINKEDIN', 'FACEBOOK', 'TWITTER', 'THREADS', 'TIKTOK', 'YOUTUBE', 'BLUESKY');

-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('IDEA', 'DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" SERIAL NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "external_data" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_posts" (
    "id" SERIAL NOT NULL,
    "caption" TEXT NOT NULL,
    "media_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SocialPostStatus" NOT NULL DEFAULT 'DRAFT',
    "audience" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scheduled_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "ai_prompt_used" TEXT,
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "author_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_post_platforms" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "account_id" INTEGER NOT NULL,
    "external_post_id" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "social_post_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_platform_account_id_key" ON "social_accounts"("platform", "account_id");
CREATE INDEX "social_accounts_platform_idx" ON "social_accounts"("platform");
CREATE INDEX "social_accounts_is_active_idx" ON "social_accounts"("is_active");

-- CreateIndex
CREATE INDEX "social_posts_status_idx" ON "social_posts"("status");
CREATE INDEX "social_posts_audience_idx" ON "social_posts"("audience");
CREATE INDEX "social_posts_scheduled_at_idx" ON "social_posts"("scheduled_at");
CREATE INDEX "social_posts_published_at_idx" ON "social_posts"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "social_post_platforms_post_id_account_id_key" ON "social_post_platforms"("post_id", "account_id");
CREATE INDEX "social_post_platforms_post_id_idx" ON "social_post_platforms"("post_id");
CREATE INDEX "social_post_platforms_account_id_idx" ON "social_post_platforms"("account_id");

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_post_platforms" ADD CONSTRAINT "social_post_platforms_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_post_platforms" ADD CONSTRAINT "social_post_platforms_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
