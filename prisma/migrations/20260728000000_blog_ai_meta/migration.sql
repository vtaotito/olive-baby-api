-- AlterTable: persist AI metadata on blog posts (Content Studio)
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "audience" VARCHAR(40);
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "quality_score" INTEGER;
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "sources" JSONB;
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "review_summary" TEXT;

CREATE INDEX IF NOT EXISTS "blog_posts_audience_idx" ON "blog_posts"("audience");
