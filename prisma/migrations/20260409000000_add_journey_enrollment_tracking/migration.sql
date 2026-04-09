-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PAUSED', 'EXITED');

-- CreateTable
CREATE TABLE "journey_enrollments" (
    "id" SERIAL NOT NULL,
    "journey_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "last_step_at" TIMESTAMP(3),
    "next_step_at" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "journey_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_step_executions" (
    "id" SERIAL NOT NULL,
    "enrollment_id" INTEGER NOT NULL,
    "step_id" INTEGER NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'sent',
    "error_message" TEXT,

    CONSTRAINT "journey_step_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "journey_enrollments_journey_id_user_id_key" ON "journey_enrollments"("journey_id", "user_id");

-- CreateIndex
CREATE INDEX "journey_enrollments_journey_id_status_idx" ON "journey_enrollments"("journey_id", "status");

-- CreateIndex
CREATE INDEX "journey_enrollments_user_id_idx" ON "journey_enrollments"("user_id");

-- CreateIndex
CREATE INDEX "journey_enrollments_status_next_step_at_idx" ON "journey_enrollments"("status", "next_step_at");

-- CreateIndex
CREATE INDEX "journey_step_executions_enrollment_id_idx" ON "journey_step_executions"("enrollment_id");

-- CreateIndex
CREATE INDEX "journey_step_executions_step_id_idx" ON "journey_step_executions"("step_id");

-- CreateIndex
CREATE INDEX "journey_step_executions_enrollment_id_step_id_idx" ON "journey_step_executions"("enrollment_id", "step_id");

-- AddForeignKey
ALTER TABLE "journey_enrollments" ADD CONSTRAINT "journey_enrollments_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_enrollments" ADD CONSTRAINT "journey_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_step_executions" ADD CONSTRAINT "journey_step_executions_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "journey_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_step_executions" ADD CONSTRAINT "journey_step_executions_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "journey_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
