# Olive Baby API - Prepare Deploy Script (Baby Sharing Feature)
# PowerShell script para preparar deploy com nova feature de compartilhamento

param(
    [string]$VPS_ID = "1188492"
)

$ErrorActionPreference = "Stop"

Write-Host "`nOlive Baby API - Prepare Deploy (Baby Sharing)" -ForegroundColor Green
Write-Host "==================================================`n" -ForegroundColor Green

# Step 1: Verificar ambiente
Write-Host "Step 1/5: Verificando ambiente..." -ForegroundColor Cyan

if (-not (Test-Path "package.json")) {
    Write-Host "Erro: Execute este script na raiz do projeto olive-baby-api" -ForegroundColor Red
    exit 1
}

# Verificar se .env existe
if (-not (Test-Path ".env")) {
    Write-Host "Aviso: Arquivo .env nao encontrado" -ForegroundColor Yellow
    Write-Host "   Certifique-se de configurar as variaveis de ambiente na VPS" -ForegroundColor Yellow
}

Write-Host "Projeto encontrado" -ForegroundColor Green

# Step 2: Verificar migrations
Write-Host "`nStep 2/5: Verificando migrations..." -ForegroundColor Cyan

$migrationFile = "prisma\migrations\20251214000001_add_baby_sharing\migration.sql"
if (Test-Path $migrationFile) {
    Write-Host "Migration de baby sharing encontrada" -ForegroundColor Green
} else {
    Write-Host "Migration de baby sharing nao encontrada" -ForegroundColor Yellow
}

# Step 3: Build TypeScript
Write-Host "`nStep 3/5: Compilando TypeScript..." -ForegroundColor Cyan

npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro no build" -ForegroundColor Red
    exit 1
}

Write-Host "Build concluido" -ForegroundColor Green

# Step 4: Criar diretorio temporario
Write-Host "`nStep 4/5: Preparando arquivos..." -ForegroundColor Cyan

$tempDir = "deploy-temp"
if (Test-Path $tempDir) {
    Remove-Item -Recurse -Force $tempDir
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Copiar arquivos necessarios
$filesToCopy = @(
    "dist",
    "prisma",
    "package.json",
    "package-lock.json",
    "Dockerfile",
    "docker-compose.vps.ai.yml",
    "nginx"
)

foreach ($item in $filesToCopy) {
    if (Test-Path $item) {
        Copy-Item -Path $item -Destination "$tempDir/$item" -Recurse -Force
        Write-Host "  OK: $item" -ForegroundColor Gray
    }
}

Write-Host "Arquivos preparados" -ForegroundColor Green

# Step 5: Criar ZIP
Write-Host "`nStep 5/5: Criando pacote de deploy..." -ForegroundColor Cyan

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$archiveName = "olive-baby-api-baby-sharing_$timestamp.zip"

# Criar ZIP excluindo arquivos desnecessarios
Get-ChildItem -Path . -Recurse | 
    Where-Object { 
        $_.FullName -notmatch "node_modules" -and 
        $_.FullName -notmatch "\.git" -and
        $_.FullName -notmatch "deploy-temp" -and
        $_.FullName -notmatch "\.log" -and
        $_.FullName -notmatch "\.env" -and
        $_.FullName -notmatch "\.zip" -and
        $_.FullName -notmatch "\.tar\.gz" -and
        $_.FullName -notmatch "test-results" -and
        $_.FullName -notmatch "logs"
    } |
    Compress-Archive -DestinationPath $archiveName -Force -ErrorAction SilentlyContinue

$archiveSizeMB = [math]::Round((Get-Item $archiveName).Length / 1MB, 2)
Write-Host "Pacote criado: $archiveName ($archiveSizeMB MB)" -ForegroundColor Green

# Informacoes finais
Write-Host "`nInformacoes de deploy" -ForegroundColor Cyan
Write-Host "`nArquivo pronto: $archiveName" -ForegroundColor Yellow
Write-Host "VPS ID: $VPS_ID" -ForegroundColor Yellow
Write-Host "`nIMPORTANTE: Certifique-se de que:" -ForegroundColor Yellow
Write-Host "  1. CPF_SALT esta configurado no .env da VPS" -ForegroundColor White
Write-Host "  2. Migration foi aplicada (20251214000001_add_baby_sharing)" -ForegroundColor White
Write-Host "  3. Cliente Prisma foi gerado (npx prisma generate)" -ForegroundColor White
Write-Host "`nPara fazer o deploy, use:" -ForegroundColor Cyan
Write-Host "  Deploy olive-baby-api usando o arquivo $archiveName" -ForegroundColor White

# Limpeza
Write-Host "`nLimpando arquivos temporarios..." -ForegroundColor Cyan
Remove-Item -Recurse -Force $tempDir

Write-Host "`nDeploy preparado com sucesso!" -ForegroundColor Green
