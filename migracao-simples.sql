-- Migração simples: adicionar coluna baby_cpf_hash
-- Execute este arquivo diretamente no PostgreSQL

-- Adicionar coluna (se não existir)
ALTER TABLE babies ADD COLUMN IF NOT EXISTS baby_cpf_hash VARCHAR(64) NULL;

-- Criar índice único (se não existir)
CREATE UNIQUE INDEX IF NOT EXISTS babies_baby_cpf_hash_key 
ON babies(baby_cpf_hash) 
WHERE baby_cpf_hash IS NOT NULL;

-- Verificar se foi criado
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'babies' 
AND column_name = 'baby_cpf_hash';
