-- Migration: 20251211202000_add_password_reset_security
-- Aplicar migration de password reset manualmente

-- Verificar se tabela antiga existe e tem estrutura diferente
DO $$
BEGIN
  -- Se tabela existe mas não tem token_hash, recriar
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'password_resets'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'password_resets' 
    AND column_name = 'token_hash'
  ) THEN
    -- Deletar tabela antiga
    DROP TABLE IF EXISTS "password_resets" CASCADE;
  END IF;
END $$;

-- Criar nova tabela com estrutura segura (se não existir)
CREATE TABLE IF NOT EXISTS "password_resets" (
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

-- Criar índices (se não existirem)
CREATE UNIQUE INDEX IF NOT EXISTS "password_resets_token_hash_key" ON "password_resets"("token_hash");
CREATE INDEX IF NOT EXISTS "password_resets_user_id_idx" ON "password_resets"("user_id");
-- Nota: password_resets_token_hash_idx é redundante com o índice único acima, mas mantido para compatibilidade
CREATE INDEX IF NOT EXISTS "password_resets_token_hash_idx" ON "password_resets"("token_hash");
CREATE INDEX IF NOT EXISTS "password_resets_user_id_used_at_idx" ON "password_resets"("user_id", "used_at");
CREATE INDEX IF NOT EXISTS "password_resets_expires_at_idx" ON "password_resets"("expires_at");

-- Adicionar foreign key (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'password_resets_user_id_fkey'
  ) THEN
    ALTER TABLE "password_resets" 
    ADD CONSTRAINT "password_resets_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;


