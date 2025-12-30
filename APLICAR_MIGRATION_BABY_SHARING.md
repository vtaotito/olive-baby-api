# Aplicar Migração Baby Sharing no VPS

## Problema
A tabela `baby_members` não existe no banco de dados de produção, causando erro 500 no endpoint `/api/v1/babies/7/members`.

## Solução
Aplicar a migração SQL que cria as tabelas `baby_members` e `baby_invites`.

## Método 1: Comando Único (RECOMENDADO)

Após conectar via SSH (`ssh root@srv1188492.hstgr.cloud`), execute:

```bash
docker exec -i olivebaby-db psql -U olivebaby -d olivebaby < /dev/stdin << 'EOF'
-- Aplicar migração baby sharing
ALTER TABLE "babies" ADD COLUMN IF NOT EXISTS "baby_cpf_hash" VARCHAR(64) NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'babies_baby_cpf_hash_key') THEN CREATE UNIQUE INDEX "babies_baby_cpf_hash_key" ON "babies"("baby_cpf_hash") WHERE "baby_cpf_hash" IS NOT NULL; END IF; END $$;
CREATE INDEX IF NOT EXISTS "babies_baby_cpf_hash_idx" ON "babies"("baby_cpf_hash");
DO $$ BEGIN CREATE TYPE "BabyMemberType" AS ENUM ('PARENT', 'FAMILY', 'PROFESSIONAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "BabyMemberRole" AS ENUM ('OWNER_PARENT_1', 'OWNER_PARENT_2', 'FAMILY_VIEWER', 'FAMILY_EDITOR', 'PEDIATRICIAN', 'OBGYN', 'LACTATION_CONSULTANT', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "BabyMemberStatus" AS ENUM ('ACTIVE', 'PENDING', 'REVOKED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "BabyInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE TABLE IF NOT EXISTS "baby_members" ("id" SERIAL PRIMARY KEY, "baby_id" INTEGER NOT NULL, "user_id" INTEGER NOT NULL, "member_type" "BabyMemberType" NOT NULL, "role" "BabyMemberRole" NOT NULL, "status" "BabyMemberStatus" NOT NULL DEFAULT 'ACTIVE', "permissions" JSONB, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revoked_at" TIMESTAMP(3), "revoked_by_user_id" INTEGER, CONSTRAINT "baby_members_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "baby_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "baby_members_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE, CONSTRAINT "baby_members_baby_id_user_id_key" UNIQUE ("baby_id", "user_id"));
CREATE INDEX IF NOT EXISTS "baby_members_baby_id_idx" ON "baby_members"("baby_id");
CREATE INDEX IF NOT EXISTS "baby_members_user_id_idx" ON "baby_members"("user_id");
CREATE INDEX IF NOT EXISTS "baby_members_baby_status_idx" ON "baby_members"("baby_id", "status");
CREATE TABLE IF NOT EXISTS "baby_invites" ("id" SERIAL PRIMARY KEY, "baby_id" INTEGER NOT NULL, "email_invited" VARCHAR(255) NOT NULL, "member_type" "BabyMemberType" NOT NULL, "role" "BabyMemberRole" NOT NULL, "token_hash" VARCHAR(64) NOT NULL UNIQUE, "expires_at" TIMESTAMP(3) NOT NULL, "status" "BabyInviteStatus" NOT NULL DEFAULT 'PENDING', "invited_name" VARCHAR(255), "message" TEXT, "created_by_user_id" INTEGER NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "accepted_at" TIMESTAMP(3), CONSTRAINT "baby_invites_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "baby_invites_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX IF NOT EXISTS "baby_invites_baby_id_idx" ON "baby_invites"("baby_id");
CREATE INDEX IF NOT EXISTS "baby_invites_email_invited_idx" ON "baby_invites"("email_invited");
CREATE INDEX IF NOT EXISTS "baby_invites_token_hash_idx" ON "baby_invites"("token_hash");
CREATE INDEX IF NOT EXISTS "baby_invites_status_idx" ON "baby_invites"("status");
CREATE INDEX IF NOT EXISTS "baby_invites_baby_status_idx" ON "baby_invites"("baby_id", "status");
EOF
```

## Método 2: Usar Arquivo SQL

1. No seu computador local, copie o arquivo para o VPS:
   ```bash
   scp apply-baby-sharing-migration.sql root@srv1188492.hstgr.cloud:/tmp/
   ```

2. No VPS, execute:
   ```bash
   docker exec -i olivebaby-db psql -U olivebaby -d olivebaby < /tmp/apply-baby-sharing-migration.sql
   ```

## Método 3: Entrar no PostgreSQL e Executar

1. Entre no container do PostgreSQL:
   ```bash
   docker exec -it olivebaby-db psql -U olivebaby -d olivebaby
   ```

2. Execute o conteúdo do arquivo `apply-baby-sharing-migration.sql` linha por linha.

## Verificação

Após aplicar a migração, verifique se as tabelas foram criadas:

```bash
docker exec -i olivebaby-db psql -U olivebaby -d olivebaby -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('baby_members', 'baby_invites');"
```

Deve retornar:
```
 table_name   
--------------
 baby_members
 baby_invites
```

## Teste

Após aplicar a migração, teste o endpoint:

```bash
curl "https://oliecare.cloud/api/v1/babies/7/members" \
  -H "authorization: Bearer SEU_TOKEN_AQUI"
```

Deve retornar uma lista vazia `[]` ou os membros existentes, mas não mais erro 500.
