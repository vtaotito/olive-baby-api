# Script para executar migração baby_cpf_hash via SSH
# Usa arquivo SQL temporário e executa via SSH

param(
    [string]$VpsHost = "72.62.11.30",
    [string]$SshUser = "root",
    [string]$SshPassword = "@VWFusca1978@"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Executando Migração baby_cpf_hash" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Criar arquivo SQL temporário
$tempSqlFile = [System.IO.Path]::GetTempFileName() + ".sql"
$sqlContent = @"
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
"@

$sqlContent | Out-File -FilePath $tempSqlFile -Encoding UTF8 -NoNewline

Write-Host "Arquivo SQL temporário criado: $tempSqlFile" -ForegroundColor Green
Write-Host ""

# Tentar usar plink (PuTTY) se disponível
$plinkPath = "plink.exe"
if (Get-Command $plinkPath -ErrorAction SilentlyContinue) {
    Write-Host "Usando plink (PuTTY)..." -ForegroundColor Yellow
    
    # Criar arquivo de comando para plink
    $plinkCommands = @"
docker exec -i olivebaby-db psql -U olivebaby -d olivebaby < /tmp/migration.sql
"@
    
    $plinkCommands | Out-File -FilePath "$env:TEMP\plink_cmds.txt" -Encoding ASCII
    
    # Copiar arquivo SQL para o VPS
    Write-Host "Copiando arquivo SQL para o VPS..." -ForegroundColor Yellow
    $scpCommand = "echo y | pscp.exe -pw `"$SshPassword`" `"$tempSqlFile`" ${SshUser}@${VpsHost}:/tmp/migration.sql"
    Invoke-Expression $scpCommand
    
    # Executar comando no VPS
    Write-Host "Executando migração no VPS..." -ForegroundColor Yellow
    $sshCommand = "echo y | plink.exe -ssh -pw `"$SshPassword`" ${SshUser}@${VpsHost} -m `"$env:TEMP\plink_cmds.txt`""
    Invoke-Expression $sshCommand
    
    Write-Host ""
    Write-Host "✅ Migração executada!" -ForegroundColor Green
    
} else {
    Write-Host "plink (PuTTY) não encontrado." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Para executar manualmente:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Copie o arquivo SQL para o VPS:" -ForegroundColor Yellow
    Write-Host "   scp `"$tempSqlFile`" ${SshUser}@${VpsHost}:/tmp/migration.sql" -ForegroundColor White
    Write-Host ""
    Write-Host "2. Conecte-se ao VPS e execute:" -ForegroundColor Yellow
    Write-Host "   ssh ${SshUser}@${VpsHost}" -ForegroundColor White
    Write-Host "   docker exec -i olivebaby-db psql -U olivebaby -d olivebaby < /tmp/migration.sql" -ForegroundColor White
    Write-Host ""
    Write-Host "OU execute diretamente:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "ssh ${SshUser}@${VpsHost} 'docker exec -i olivebaby-db psql -U olivebaby -d olivebaby << \"EOF\"" -ForegroundColor White
    Write-Host $sqlContent -ForegroundColor Gray
    Write-Host "EOF'" -ForegroundColor White
}

# Limpar arquivo temporário
Start-Sleep -Seconds 2
if (Test-Path $tempSqlFile) {
    Remove-Item $tempSqlFile -Force
    Write-Host ""
    Write-Host "Arquivo temporário removido." -ForegroundColor Gray
}
