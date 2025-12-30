-- Olive Baby API - Baby Sharing Migration
-- Adiciona suporte para compartilhamento de bebês com múltiplos responsáveis
-- Baseado no sistema de convites tokenizados similar ao de profissionais

-- ==========================================
-- Adicionar campo babyCpfHash ao Baby
-- ==========================================
ALTER TABLE "babies" 
ADD COLUMN IF NOT EXISTS "baby_cpf_hash" VARCHAR(64) UNIQUE;

CREATE INDEX IF NOT EXISTS "babies_baby_cpf_hash_idx" ON "babies"("baby_cpf_hash");

-- ==========================================
-- Criar ENUMs para Baby Sharing
-- ==========================================
DO $$ BEGIN
  CREATE TYPE "BabyMemberType" AS ENUM ('PARENT', 'FAMILY', 'PROFESSIONAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BabyMemberRole" AS ENUM (
    'OWNER_PARENT_1',
    'OWNER_PARENT_2',
    'FAMILY_VIEWER',
    'FAMILY_EDITOR',
    'PEDIATRICIAN',
    'OBGYN',
    'LACTATION_CONSULTANT',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BabyMemberStatus" AS ENUM ('ACTIVE', 'PENDING', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BabyInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- Tabela BabyMember (vínculos de membros)
-- ==========================================
CREATE TABLE "baby_members" (
  "id" SERIAL PRIMARY KEY,
  "baby_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "member_type" "BabyMemberType" NOT NULL,
  "role" "BabyMemberRole" NOT NULL,
  "status" "BabyMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "permissions" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  "revoked_by_user_id" INTEGER,
  
  CONSTRAINT "baby_members_baby_id_fkey" FOREIGN KEY ("baby_id") 
    REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "baby_members_user_id_fkey" FOREIGN KEY ("user_id") 
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "baby_members_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") 
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  
  CONSTRAINT "baby_members_baby_id_user_id_key" UNIQUE ("baby_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "baby_members_baby_id_idx" ON "baby_members"("baby_id");
CREATE INDEX IF NOT EXISTS "baby_members_user_id_idx" ON "baby_members"("user_id");
CREATE INDEX IF NOT EXISTS "baby_members_baby_status_idx" ON "baby_members"("baby_id", "status");

-- ==========================================
-- Tabela BabyInvite (convites tokenizados)
-- ==========================================
CREATE TABLE "baby_invites" (
  "id" SERIAL PRIMARY KEY,
  "baby_id" INTEGER NOT NULL,
  "email_invited" VARCHAR(255) NOT NULL,
  "member_type" "BabyMemberType" NOT NULL,
  "role" "BabyMemberRole" NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL UNIQUE,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "status" "BabyInviteStatus" NOT NULL DEFAULT 'PENDING',
  "invited_name" VARCHAR(255),
  "message" TEXT,
  "created_by_user_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "accepted_at" TIMESTAMP(3),
  
  CONSTRAINT "baby_invites_baby_id_fkey" FOREIGN KEY ("baby_id") 
    REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "baby_invites_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") 
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "baby_invites_baby_id_idx" ON "baby_invites"("baby_id");
CREATE INDEX IF NOT EXISTS "baby_invites_email_invited_idx" ON "baby_invites"("email_invited");
CREATE INDEX IF NOT EXISTS "baby_invites_token_hash_idx" ON "baby_invites"("token_hash");
CREATE INDEX IF NOT EXISTS "baby_invites_status_idx" ON "baby_invites"("status");
CREATE INDEX IF NOT EXISTS "baby_invites_baby_status_idx" ON "baby_invites"("baby_id", "status");

-- ==========================================
-- Migrar dados existentes (opcional)
-- ==========================================
-- Criar vínculos BabyMember para cuidadores existentes que são primários
-- Isso garante compatibilidade com o sistema antigo
INSERT INTO "baby_members" ("baby_id", "user_id", "member_type", "role", "status", "created_at")
SELECT DISTINCT
  cb."baby_id",
  c."user_id",
  'PARENT'::"BabyMemberType",
  CASE 
    WHEN ROW_NUMBER() OVER (PARTITION BY cb."baby_id" ORDER BY cb."created_at") = 1 
    THEN 'OWNER_PARENT_1'::"BabyMemberRole"
    ELSE 'OWNER_PARENT_2'::"BabyMemberRole"
  END,
  'ACTIVE'::"BabyMemberStatus",
  cb."created_at"
FROM "caregiver_babies" cb
INNER JOIN "caregivers" c ON c."id" = cb."caregiver_id"
WHERE cb."is_primary" = true
ON CONFLICT ("baby_id", "user_id") DO NOTHING;
