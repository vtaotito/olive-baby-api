# Script para executar migração baby_cpf_hash via SSH no VPS
# Requer: SSH configurado e acesso ao VPS

param(
    [string]$VpsHost = "",
    [string]$SshUser = "root"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Executar Migração baby_cpf_hash via SSH" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ler o arquivo SQL
$sqlFile = Join-Path $PSScriptRoot "add_baby_cpf_hash_column.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "ERRO: Arquivo SQL não encontrado: $sqlFile" -ForegroundColor Red
    exit 1
}

$sqlContent = Get-Content $sqlFile -Raw

# Criar comando SQL simplificado (apenas a parte DO $$)
$migrationSQL = @"
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

if ($VpsHost) {
    Write-Host "Tentando executar migração no VPS: $VpsHost" -ForegroundColor Yellow
    Write-Host ""
    
    # Criar comando SSH para executar docker exec
    $sshCommand = "docker exec -i olivebaby-db psql -U olivebaby -d olivebaby -c `"$migrationSQL`""
    
    Write-Host "Executando comando via SSH..." -ForegroundColor Cyan
    Write-Host "Comando: ssh $SshUser@$VpsHost '$sshCommand'" -ForegroundColor Gray
    
    try {
        $result = ssh "$SshUser@$VpsHost" $sshCommand 2>&1
        Write-Host $result -ForegroundColor White
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Migração executada com sucesso!" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "⚠️  Migração executada, mas verifique o resultado acima" -ForegroundColor Yellow
        }
    } catch {
        Write-Host ""
        Write-Host "❌ Erro ao executar via SSH: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Execute manualmente no VPS:" -ForegroundColor Yellow
        Write-Host $sshCommand -ForegroundColor White
    }
} else {
    Write-Host "Modo de uso:" -ForegroundColor Yellow
    Write-Host "  .\execute-migration-ssh.ps1 -VpsHost <ip-ou-hostname> [-SshUser <usuario>]" -ForegroundColor White
    Write-Host ""
    Write-Host "Exemplo:" -ForegroundColor Yellow
    Write-Host "  .\execute-migration-ssh.ps1 -VpsHost 192.168.1.100" -ForegroundColor White
    Write-Host "  .\execute-migration-ssh.ps1 -VpsHost vps.exemplo.com -SshUser root" -ForegroundColor White
    Write-Host ""
    Write-Host "OU execute manualmente no VPS:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "docker exec -i olivebaby-db psql -U olivebaby -d olivebaby << 'EOF'" -ForegroundColor White
    Write-Host $migrationSQL -ForegroundColor Gray
    Write-Host "EOF" -ForegroundColor White
}
