# Script para aplicar migração da coluna baby_cpf_hash
# Execute este script para adicionar a coluna faltante no banco de dados

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Aplicar Migração: baby_cpf_hash" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ler o arquivo SQL
$sqlFile = Join-Path $PSScriptRoot "add_baby_cpf_hash_column.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "ERRO: Arquivo SQL não encontrado: $sqlFile" -ForegroundColor Red
    exit 1
}

$sqlContent = Get-Content $sqlFile -Raw

Write-Host "Arquivo SQL encontrado: $sqlFile" -ForegroundColor Green
Write-Host ""
Write-Host "Para aplicar esta migração no VPS, você pode:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Via Docker Exec (recomendado):" -ForegroundColor Cyan
Write-Host "   docker exec -i olivebaby-db psql -U olivebaby -d olivebaby < add_baby_cpf_hash_column.sql" -ForegroundColor White
Write-Host ""
Write-Host "2. Ou conectar diretamente ao PostgreSQL:" -ForegroundColor Cyan
Write-Host "   docker exec -it olivebaby-db psql -U olivebaby -d olivebaby" -ForegroundColor White
Write-Host "   E então executar o conteúdo do arquivo SQL acima" -ForegroundColor White
Write-Host ""
Write-Host "3. Ou usar o MCP Hostinger para executar SQL no VPS" -ForegroundColor Cyan
Write-Host ""
Write-Host "Conteúdo do SQL:" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host $sqlContent -ForegroundColor White
Write-Host "----------------------------------------" -ForegroundColor Gray
