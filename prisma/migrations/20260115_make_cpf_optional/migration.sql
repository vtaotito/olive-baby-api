-- AlterTable: Make CPF optional in caregivers table
-- This allows users to register via invite without providing CPF initially
ALTER TABLE "caregivers" ALTER COLUMN "cpf" DROP NOT NULL;
