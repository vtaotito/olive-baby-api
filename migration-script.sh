#!/bin/bash
# Script para executar migração baby_cpf_hash no VPS
# Execute este script diretamente no servidor VPS

echo "========================================"
echo "Executando Migração baby_cpf_hash"
echo "========================================"
echo ""

# Executar migração SQL
docker exec -i olivebaby-db psql -U olivebaby -d olivebaby << 'EOF'
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

echo ""
echo "Verificando resultado..."
docker exec -i olivebaby-db psql -U olivebaby -d olivebaby -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'babies' AND column_name = 'baby_cpf_hash';"

echo ""
echo "========================================"
echo "Migração concluída!"
echo "========================================"
