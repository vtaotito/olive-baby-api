# 🚀 Executar Migração baby_cpf_hash AGORA

## Informações do VPS
- **IP:** 72.62.11.30
- **Hostname:** srv1188492.hstgr.cloud
- **Container DB:** olivebaby-db
- **Container API:** olivebaby-api

## ⚡ Método Rápido: Executar SQL Diretamente

Conecte-se ao VPS via SSH e execute:

```bash
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
```

## 🔍 Verificar se Funcionou

Após executar, verifique:

```bash
docker exec -i olivebaby-db psql -U olivebaby -d olivebaby -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'babies' AND column_name = 'baby_cpf_hash';"
```

Você deve ver:
```
 column_name   | data_type | is_nullable 
---------------+-----------+-------------
 baby_cpf_hash | character varying | YES
```

## ✅ Testar API

Após aplicar a migração, teste o endpoint:

```bash
curl "https://oliecare.cloud/api/v1/routines/feeding/open?babyId=7" \
  -H "authorization: Bearer SEU_TOKEN_AQUI"
```

Deve retornar sucesso (não mais erro 500).

## 📝 Alternativa: Via Script TypeScript

Se preferir usar o script TypeScript:

```bash
# Conectar ao VPS
ssh root@72.62.11.30

# Executar dentro do container da API
docker exec -i olivebaby-api npx ts-node /app/src/scripts/apply-baby-cpf-hash-migration.ts
```

**Nota:** O script TypeScript precisa estar no container. Se não estiver, use o método SQL direto acima.
