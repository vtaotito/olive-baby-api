#!/usr/bin/env pwsh
# Deploy Inicial Automatizado - Olive Baby VPS
# Copia e executa script de setup inicial no VPS

$VPS = "srv1188492.hstgr.cloud"
$USER = "u1188492"
$SCRIPT = "deploy-vps-initial-setup.sh"

Write-Host "=== OLIVE BABY - DEPLOY INICIAL AUTOMATIZADO ===" -ForegroundColor Cyan
Write-Host ""

# Verifica se o script existe
if (-not (Test-Path $SCRIPT)) {
    Write-Host "❌ Script $SCRIPT nao encontrado!" -ForegroundColor Red
    exit 1
}

Write-Host "Script a ser executado:" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor DarkGray
Get-Content $SCRIPT | Select-Object -First 20
$lineCount = (Get-Content $SCRIPT).Count
Write-Host "... ($lineCount linhas no total)" -ForegroundColor DarkGray
Write-Host "----------------------------------------" -ForegroundColor DarkGray
Write-Host ""

Write-Host "Conectando ao VPS: $USER@$VPS" -ForegroundColor Cyan
Write-Host ""
Write-Host "INSTRUCOES:" -ForegroundColor Yellow
Write-Host "1. Uma janela SSH vai abrir e pedir a senha" -ForegroundColor White
Write-Host "2. Digite a senha: @Oliver14102025@" -ForegroundColor White  
Write-Host "3. O script sera copiado e executado automaticamente" -ForegroundColor White
Write-Host "4. Aguarde a conclusao (pode levar 5-10 minutos)" -ForegroundColor White
Write-Host ""
Write-Host "Pressione ENTER para continuar..." -ForegroundColor Green
$null = Read-Host

Write-Host "Copiando script para VPS..." -ForegroundColor Cyan
scp $SCRIPT ${USER}@${VPS}:/root/

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Falha ao copiar script!" -ForegroundColor Red
    Write-Host ""
    Write-Host "SOLUCAO MANUAL:" -ForegroundColor Yellow
    Write-Host "1. Acesse: https://hpanel.hostinger.com" -ForegroundColor White
    Write-Host "2. Abra o terminal SSH" -ForegroundColor White
    Write-Host "3. Execute:" -ForegroundColor White
    Write-Host ""
    Get-Content $SCRIPT | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    exit 1
}

Write-Host "✅ Script copiado com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "Executando deploy inicial no VPS..." -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor DarkGray

ssh ${USER}@${VPS} "chmod +x /root/$SCRIPT && /root/$SCRIPT"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "DEPLOY INICIAL CONCLUIDO COM SUCESSO!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Proximos passos:" -ForegroundColor Yellow
    Write-Host "1. Configure /opt/olivebaby/olive-baby-api/.env com suas credenciais" -ForegroundColor White
    Write-Host "2. Reinicie a API: ssh ${USER}@${VPS} 'cd /opt/olivebaby/olive-baby-api && docker compose restart'" -ForegroundColor White
    Write-Host "3. Configure nginx/apache para proxy reverso" -ForegroundColor White
    Write-Host "4. Configure SSL para https://oliecare.cloud" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Erro durante execucao do deploy!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Para diagnosticar, conecte via SSH:" -ForegroundColor Yellow
    Write-Host "ssh ${USER}@${VPS}" -ForegroundColor White
    Write-Host ""
    Write-Host "E verifique os logs:" -ForegroundColor Yellow
    Write-Host "cat /root/$SCRIPT" -ForegroundColor White
    Write-Host "docker ps -a" -ForegroundColor White
    $cmd = 'docker logs $(docker ps -q --filter name=api)'
    Write-Host $cmd -ForegroundColor White
}
