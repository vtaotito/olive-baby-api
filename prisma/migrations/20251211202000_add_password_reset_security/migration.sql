-- AlterTable: password_resets
-- Migração para melhorar segurança do reset de senha

-- Primeiro, deletar tabela antiga se existir (dados serão perdidos, mas é desenvolvimento)
DROP TABLE IF EXISTS "password_resets";

-- Criar nova tabela com estrutura segura
CREATE TABLE "password_resets" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "request_ip" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- Criar índices
CREATE UNIQUE INDEX "password_resets_token_hash_key" ON "password_resets"("token_hash");
CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id");
CREATE INDEX "password_resets_token_hash_idx" ON "password_resets"("token_hash");
CREATE INDEX "password_resets_user_id_used_at_idx" ON "password_resets"("user_id", "used_at");
CREATE INDEX "password_resets_expires_at_idx" ON "password_resets"("expires_at");

-- Adicionar foreign key
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
