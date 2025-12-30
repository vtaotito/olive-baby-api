# Script para aplicar migration de password reset
# Uso: .\apply-migration.ps1

$ErrorActionPreference = "Stop"

Write-Host "🔧 Aplicando migration de password reset..." -ForegroundColor Cyan

# Verificar se docker está disponível
$dockerAvailable = Get-Command docker -ErrorAction SilentlyContinue

if ($dockerAvailable) {
    Write-Host "✓ Docker encontrado" -ForegroundColor Green
    
    # Verificar se container está rodando
    $containerStatus = docker ps --filter "name=olivebaby-db" --format "{{.Names}}" 2>&1
    
    if ($containerStatus -eq "olivebaby-db") {
        Write-Host "✓ Container olivebaby-db está rodando" -ForegroundColor Green
        
        # Executar SQL via docker exec
        Write-Host "Executando SQL no container..." -ForegroundColor Yellow
        
        Get-Content "apply_password_reset_migration.sql" | docker exec -i olivebaby-db psql -U olivebaby -d olivebaby
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Migration aplicada com sucesso!" -ForegroundColor Green
        } else {
            Write-Host "✗ Erro ao aplicar migration" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "✗ Container olivebaby-db não está rodando" -ForegroundColor Red
        Write-Host "Execute: docker-compose up -d postgres" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "⚠ Docker não encontrado no PATH" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Opções para aplicar a migration:" -ForegroundColor Cyan
    Write-Host "1. Via Docker (quando disponível):" -ForegroundColor White
    Write-Host "   docker exec -i olivebaby-db psql -U olivebaby -d olivebaby < apply_password_reset_migration.sql" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Via psql local (se PostgreSQL estiver instalado):" -ForegroundColor White
    Write-Host "   psql -h localhost -U olivebaby -d olivebaby -f apply_password_reset_migration.sql" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Copie o conteúdo de apply_password_reset_migration.sql e execute diretamente no banco" -ForegroundColor White
    exit 1
}


