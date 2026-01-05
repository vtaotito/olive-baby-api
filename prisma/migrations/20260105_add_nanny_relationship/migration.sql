-- Migration: Add NANNY to Relationship enum
-- Date: 2026-01-05
-- Description: Adds NANNY value to Relationship enum for babysitters

-- Add NANNY value to Relationship enum
-- Note: PostgreSQL allows adding values to enums without recreating the type
ALTER TYPE "Relationship" ADD VALUE IF NOT EXISTS 'NANNY';
