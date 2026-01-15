-- CreateEnum
CREATE TYPE "VaccineStatus" AS ENUM ('PENDING', 'APPLIED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "VaccineCalendarSource" AS ENUM ('PNI', 'SBIM');

-- CreateTable: Definições de vacinas (template/seed)
CREATE TABLE "vaccine_definitions" (
    "id" SERIAL NOT NULL,
    "vaccine_key" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "dose_label" VARCHAR(50) NOT NULL,
    "dose_number" INTEGER NOT NULL DEFAULT 1,
    "age_months" INTEGER NOT NULL,
    "age_days" INTEGER,
    "age_max_months" INTEGER,
    "source" "VaccineCalendarSource" NOT NULL DEFAULT 'PNI',
    "notes" VARCHAR(500),
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaccine_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Registros de vacinas do bebê
CREATE TABLE "baby_vaccine_records" (
    "id" SERIAL NOT NULL,
    "baby_id" INTEGER NOT NULL,
    "vaccine_key" VARCHAR(50) NOT NULL,
    "vaccine_name" VARCHAR(100) NOT NULL,
    "dose_label" VARCHAR(50) NOT NULL,
    "dose_number" INTEGER NOT NULL DEFAULT 1,
    "recommended_at" DATE NOT NULL,
    "applied_at" DATE,
    "status" "VaccineStatus" NOT NULL DEFAULT 'PENDING',
    "source" "VaccineCalendarSource" NOT NULL DEFAULT 'PNI',
    "lot_number" VARCHAR(50),
    "clinic_name" VARCHAR(200),
    "professional_name" VARCHAR(200),
    "notes" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "baby_vaccine_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint para vaccine_definitions
CREATE UNIQUE INDEX "vaccine_definitions_vaccine_key_dose_label_source_key" ON "vaccine_definitions"("vaccine_key", "dose_label", "source");

-- CreateIndex: Índices para vaccine_definitions
CREATE INDEX "vaccine_definitions_source_idx" ON "vaccine_definitions"("source");
CREATE INDEX "vaccine_definitions_age_months_idx" ON "vaccine_definitions"("age_months");
CREATE INDEX "vaccine_definitions_sort_order_idx" ON "vaccine_definitions"("sort_order");

-- CreateIndex: Unique constraint para baby_vaccine_records
CREATE UNIQUE INDEX "baby_vaccine_records_baby_id_vaccine_key_dose_label_source_key" ON "baby_vaccine_records"("baby_id", "vaccine_key", "dose_label", "source");

-- CreateIndex: Índices para baby_vaccine_records
CREATE INDEX "baby_vaccine_records_baby_id_recommended_at_idx" ON "baby_vaccine_records"("baby_id", "recommended_at");
CREATE INDEX "baby_vaccine_records_baby_id_vaccine_key_idx" ON "baby_vaccine_records"("baby_id", "vaccine_key");
CREATE INDEX "baby_vaccine_records_baby_id_status_idx" ON "baby_vaccine_records"("baby_id", "status");

-- AddForeignKey
ALTER TABLE "baby_vaccine_records" ADD CONSTRAINT "baby_vaccine_records_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
