# Script para executar migração baby_cpf_hash no VPS via Docker Exec
# Este script executa o script TypeScript dentro do container da API

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Executar Migração baby_cpf_hash no VPS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Comando para executar dentro do container da API
$dockerCommand = @"
docker exec -i olivebaby-api npx ts-node /app/src/scripts/apply-baby-cpf-hash-migration.ts
"@

Write-Host "Comando a ser executado no VPS:" -ForegroundColor Yellow
Write-Host $dockerCommand -ForegroundColor White
Write-Host ""

Write-Host "Para executar este comando no VPS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Conecte-se ao VPS via SSH" -ForegroundColor Yellow
Write-Host "2. Execute o comando acima" -ForegroundColor Yellow
Write-Host ""
Write-Host "OU" -ForegroundColor Cyan
Write-Host ""
Write-Host "Execute diretamente via SSH em uma linha:" -ForegroundColor Yellow
Write-Host "ssh user@vps 'docker exec -i olivebaby-api npx ts-node /app/src/scripts/apply-baby-cpf-hash-migration.ts'" -ForegroundColor White
Write-Host ""

# Alternativa: Executar SQL diretamente
Write-Host "Alternativa: Executar SQL diretamente no banco de dados" -ForegroundColor Cyan
Write-Host ""
$sqlCommand = @"
docker exec -i olivebaby-db psql -U olivebaby -d olivebaby << 'EOF'
DO `$`$
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
END `$`$;
EOF
"@

Write-Host "Comando SQL direto:" -ForegroundColor Yellow
Write-Host $sqlCommand -ForegroundColor White
