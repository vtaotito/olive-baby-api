# 🔧 Aplicar Migration: baby_cpf_hash

## Problema Identificado

A API está retornando erro 500 com a mensagem:
```
The column `babies.baby_cpf_hash` does not exist in the current database.
```

Isso ocorre porque o schema do Prisma define a coluna `baby_cpf_hash` na tabela `babies`, mas essa coluna não existe no banco de dados de produção.

## ✅ Solução: Aplicar Migração SQL

Execute o SQL abaixo no banco de dados PostgreSQL do VPS:

### Método 1: Via Docker Exec (Recomendado)

```bash
# Copiar o arquivo SQL para o VPS primeiro, ou executar diretamente:
docker exec -i olivebaby-db psql -U olivebaby -d olivebaby << 'EOF'
-- Adicionar coluna baby_cpf_hash à tabela babies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'babies' 
    AND column_name = 'baby_cpf_hash'
  ) THEN
    ALTER TABLE "babies" 
    ADD COLUMN "baby_cpf_hash" VARCHAR(64) NULL;
    
    CREATE UNIQUE INDEX IF NOT EXISTS "babies_baby_cpf_hash_key" 
    ON "babies"("baby_cpf_hash") 
    WHERE "baby_cpf_hash" IS NOT NULL;
    
    RAISE NOTICE 'Coluna baby_cpf_hash adicionada com sucesso!';
  ELSE
    RAISE NOTICE 'Coluna baby_cpf_hash já existe.';
  END IF;
END $$;
EOF
```

### Método 2: Conectar ao PostgreSQL e Executar

```bash
# Conectar ao container do banco
docker exec -it olivebaby-db psql -U olivebaby -d olivebaby

# Executar o SQL:
```

```sql
-- Adicionar coluna baby_cpf_hash à tabela babies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'babies' 
    AND column_name = 'baby_cpf_hash'
  ) THEN
    ALTER TABLE "babies" 
    ADD COLUMN "baby_cpf_hash" VARCHAR(64) NULL;
    
    CREATE UNIQUE INDEX IF NOT EXISTS "babies_baby_cpf_hash_key" 
    ON "babies"("baby_cpf_hash") 
    WHERE "baby_cpf_hash" IS NOT NULL;
    
    RAISE NOTICE 'Coluna baby_cpf_hash adicionada com sucesso!';
  ELSE
    RAISE NOTICE 'Coluna baby_cpf_hash já existe.';
  END IF;
END $$;
```

### Método 3: Usar Arquivo SQL Local

Se você tiver acesso SSH ao VPS:

```bash
# Copiar arquivo para o VPS
scp add_baby_cpf_hash_column.sql user@vps:/tmp/

# Conectar ao VPS e executar
ssh user@vps
docker exec -i olivebaby-db psql -U olivebaby -d olivebaby < /tmp/add_baby_cpf_hash_column.sql
```

## Verificar Aplicação

Após executar a migração, verifique se a coluna foi criada:

```sql
-- Verificar estrutura da tabela
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'babies'
  AND column_name = 'baby_cpf_hash';

-- Verificar índices criados
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'babies'
  AND indexname LIKE '%baby_cpf_hash%';
```

## Após Aplicar a Migração

1. ✅ A API deve parar de retornar erro 500
2. ✅ Endpoints como `/api/v1/routines/feeding/open?babyId=7` devem funcionar
3. ✅ Endpoints como `/api/v1/babies` devem funcionar
4. ✅ Endpoints como `/api/v1/stats/7?range=24h` devem funcionar

## Arquivos Criados

- `add_baby_cpf_hash_column.sql` - Script SQL completo
- `apply_baby_cpf_hash_migration.ps1` - Script PowerShell com instruções

## Nota Importante

Esta coluna é **opcional** (`NULL` permitido) e **única** quando preenchida. Ela é usada para identificar bebês por CPF hash, mas não é obrigatória para o funcionamento básico da aplicação.
