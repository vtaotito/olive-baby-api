-- Adicionar coluna baby_cpf_hash à tabela babies
-- Esta coluna é opcional e única, usada para identificar bebês por CPF hash

-- Verificar se a coluna já existe antes de adicionar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'babies' 
    AND column_name = 'baby_cpf_hash'
  ) THEN
    -- Adicionar a coluna
    ALTER TABLE "babies" 
    ADD COLUMN "baby_cpf_hash" VARCHAR(64) NULL;
    
    -- Criar índice único (constraint unique)
    CREATE UNIQUE INDEX IF NOT EXISTS "babies_baby_cpf_hash_key" 
    ON "babies"("baby_cpf_hash") 
    WHERE "baby_cpf_hash" IS NOT NULL;
    
    RAISE NOTICE 'Coluna baby_cpf_hash adicionada com sucesso!';
  ELSE
    RAISE NOTICE 'Coluna baby_cpf_hash já existe na tabela babies.';
  END IF;
END $$;

-- Verificar a estrutura da tabela após aplicação
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable,
    column_default
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
