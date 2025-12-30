# Script PowerShell para copiar arquivo de migração para o VPS
# Execute: .\copiar-migracao-vps.ps1

$arquivo = "apply-baby-sharing-migration.sql"
$destino = "root@srv1188492.hstgr.cloud:/tmp/"

Write-Host "Copiando arquivo $arquivo para o VPS..." -ForegroundColor Cyan

# Verificar se o arquivo existe
if (-not (Test-Path $arquivo)) {
    Write-Host "ERRO: Arquivo $arquivo não encontrado!" -ForegroundColor Red
    Write-Host "Certifique-se de estar no diretório correto:" -ForegroundColor Yellow
    Write-Host "C:\Users\Vitor A. Tito\Documents\GPTO\OliverBaby\olive-baby-api" -ForegroundColor Yellow
    exit 1
}

# Copiar arquivo
try {
    scp $arquivo $destino
    Write-Host "`n✅ Arquivo copiado com sucesso!" -ForegroundColor Green
    Write-Host "`nAgora conecte via SSH e execute:" -ForegroundColor Yellow
    Write-Host "ssh root@srv1188492.hstgr.cloud" -ForegroundColor White
    Write-Host "docker exec -i olivebaby-db psql -U olivebaby -d olivebaby < /tmp/apply-baby-sharing-migration.sql" -ForegroundColor White
} catch {
    Write-Host "`n❌ Erro ao copiar arquivo: $_" -ForegroundColor Red
    Write-Host "`nAlternativa: Use o método direto descrito em EXECUTAR_MIGRACAO_SIMPLES.txt" -ForegroundColor Yellow
}
