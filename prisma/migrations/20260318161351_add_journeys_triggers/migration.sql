-- CreateEnum
CREATE TYPE "JourneyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateTable
CREATE TABLE "journeys" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "category" VARCHAR(30) NOT NULL,
    "audience" VARCHAR(30) NOT NULL,
    "status" "JourneyStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "total_sent" INTEGER NOT NULL DEFAULT 0,
    "total_delivered" INTEGER NOT NULL DEFAULT 0,
    "total_failed" INTEGER NOT NULL DEFAULT 0,
    "total_converted" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "activated_at" TIMESTAMP(3),

    CONSTRAINT "journeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_steps" (
    "id" SERIAL NOT NULL,
    "journey_id" INTEGER NOT NULL,
    "step_order" INTEGER NOT NULL DEFAULT 0,
    "type" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "variables" JSONB DEFAULT '[]',
    "sent" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "opened" INTEGER NOT NULL DEFAULT 0,
    "clicked" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journey_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trigger_configs" (
    "trigger_id" VARCHAR(50) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trigger_configs_pkey" PRIMARY KEY ("trigger_id")
);

-- CreateIndex
CREATE INDEX "journeys_category_idx" ON "journeys"("category");
CREATE INDEX "journeys_status_idx" ON "journeys"("status");
CREATE INDEX "journeys_audience_idx" ON "journeys"("audience");

-- CreateIndex
CREATE INDEX "journey_steps_journey_id_idx" ON "journey_steps"("journey_id");
CREATE INDEX "journey_steps_journey_id_step_order_idx" ON "journey_steps"("journey_id", "step_order");

-- AddForeignKey
ALTER TABLE "journey_steps" ADD CONSTRAINT "journey_steps_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
