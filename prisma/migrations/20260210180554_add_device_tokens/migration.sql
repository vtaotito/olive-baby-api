-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('WEB', 'ANDROID', 'IOS', 'EXPO');

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "device_name" VARCHAR(100),
    "device_model" VARCHAR(100),
    "os_version" VARCHAR(50),
    "app_version" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "device_tokens_user_id_idx" ON "device_tokens"("user_id");

-- CreateIndex
CREATE INDEX "device_tokens_user_id_is_active_idx" ON "device_tokens"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "device_tokens_platform_idx" ON "device_tokens"("platform");

-- CreateIndex
CREATE INDEX "device_tokens_token_idx" ON "device_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_user_id_token_key" ON "device_tokens"("user_id", "token");

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
