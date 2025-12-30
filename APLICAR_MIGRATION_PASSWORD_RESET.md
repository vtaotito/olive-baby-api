# 🔧 Aplicar Migration de Password Reset Manualmente

A migration precisa ser aplicada manualmente no banco de dados devido ao problema com extensão `vector`.

## ✅ Método Recomendado: Script TypeScript

Execute o script TypeScript que aplica a migration automaticamente:

```bash
npx ts-node src/scripts/apply-password-reset-migration.ts
```

Ou adicione ao `package.json` e execute:
```bash
npm run migrate:password-reset
```

O script irá:
- ✅ Aplicar todos os comandos SQL necessários
- ✅ Verificar a estrutura da tabela após aplicação
- ✅ Verificar índices criados
- ✅ Verificar foreign keys

## Método Alternativo: SQL Manual

Se preferir executar manualmente, use o arquivo `apply_password_reset_migration.sql` ou execute este SQL diretamente no PostgreSQL:

```sql
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
```

## Via Docker Exec

```bash
# Conectar ao container do banco
docker exec -it olivebaby-db psql -U olivebaby -d olivebaby

# Executar SQL acima
```

## Verificar Aplicação

```sql
-- Verificar estrutura da tabela
\d password_resets

-- Verificar índices
\di password_resets*

-- Verificar foreign keys
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE constraint_type = 'FOREIGN KEY' 
  AND tc.table_name='password_resets';
```

