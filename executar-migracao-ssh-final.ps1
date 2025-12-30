# Script para executar migração baby_cpf_hash via SSH
# Hostname: srv1188492.hstgr.cloud
# Usuário: root
# Senha: @VWFusca1978@

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Executando Migração baby_cpf_hash" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Hostname: srv1188492.hstgr.cloud" -ForegroundColor Yellow
Write-Host "Usuário: root" -ForegroundColor Yellow
Write-Host ""

# Criar arquivo SQL temporário no VPS via here-document
$sqlCommand = @'
docker exec -i olivebaby-db psql -U olivebaby -d olivebaby << 'EOFMIGRATION'
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
EOFMIGRATION
'@

# Tentar usar plink se disponível
if (Get-Command plink.exe -ErrorAction SilentlyContinue) {
    Write-Host "Usando plink (PuTTY)..." -ForegroundColor Green
    Write-Host ""
    
    # Criar arquivo temporário com o comando
    $tempCmdFile = "$env:TEMP\migration_cmd.sh"
    $sqlCommand | Out-File -FilePath $tempCmdFile -Encoding ASCII -NoNewline
    
    Write-Host "Executando migração no VPS..." -ForegroundColor Yellow
    plink.exe -ssh -pw "@VWFusca1978@" root@srv1188492.hstgr.cloud -m $tempCmdFile
    
    Write-Host ""
    Write-Host "Verificando resultado..." -ForegroundColor Yellow
    plink.exe -ssh -pw "@VWFusca1978@" root@srv1188492.hstgr.cloud "docker exec -i olivebaby-db psql -U olivebaby -d olivebaby -c `"SELECT column_name FROM information_schema.columns WHERE table_name = 'babies' AND column_name = 'baby_cpf_hash';`""
    
    # Limpar arquivo temporário
    Remove-Item $tempCmdFile -Force -ErrorAction SilentlyContinue
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Migração concluída!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
} else {
    Write-Host "plink (PuTTY) não encontrado." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Execute manualmente via SSH:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Conecte-se ao VPS:" -ForegroundColor Yellow
    Write-Host "   ssh root@srv1188492.hstgr.cloud" -ForegroundColor White
    Write-Host "   Senha: @VWFusca1978@" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Execute o comando SQL:" -ForegroundColor Yellow
    Write-Host $sqlCommand -ForegroundColor White
    Write-Host ""
    Write-Host "3. Verifique:" -ForegroundColor Yellow
    Write-Host '   docker exec -i olivebaby-db psql -U olivebaby -d olivebaby -c "SELECT column_name FROM information_schema.columns WHERE table_name = ''babies'' AND column_name = ''baby_cpf_hash'';"' -ForegroundColor White
}
