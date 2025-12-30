# Script para preparar deploy do backend na VPS
$domain = "oliecare.cloud"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$archiveName = "olive-baby-api-ai_$timestamp.zip"

Write-Host "Preparando deploy do backend com AI Assistant..." -ForegroundColor Cyan

# Criar diretorio temporario
$tempDir = "deploy-temp"
if (Test-Path $tempDir) {
    Remove-Item -Recurse -Force $tempDir
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Copiar arquivos necessarios (excluindo node_modules, dist, etc)
Write-Host "Copiando arquivos..." -ForegroundColor Yellow

$excludePatterns = @(
    "node_modules",
    "dist",
    ".git",
    ".vscode",
    "*.log",
    "deploy-temp",
    "*.zip"
)

# Copiar estrutura
Get-ChildItem -Path . -Recurse | Where-Object {
    $shouldExclude = $false
    foreach ($pattern in $excludePatterns) {
        if ($_.FullName -like "*$pattern*") {
            $shouldExclude = $true
            break
        }
    }
    return -not $shouldExclude
} | ForEach-Object {
    $relativePath = $_.FullName.Substring((Get-Location).Path.Length + 1)
    $destPath = Join-Path $tempDir $relativePath
    $destDir = Split-Path $destPath -Parent
    
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    
    if (-not $_.PSIsContainer) {
        Copy-Item $_.FullName $destPath -Force
    }
}

# Criar arquivo .env.example na pasta temp (sem valores sensiveis)
$envExample = @"
# Database
DATABASE_URL=postgresql://olivebaby:PASSWORD@postgres:5432/olivebaby?schema=public
DB_USER=olivebaby
DB_PASSWORD=PASSWORD
DB_NAME=olivebaby

# Redis
REDIS_URL=redis://:PASSWORD@redis:6379
REDIS_PASSWORD=PASSWORD

# JWT
JWT_ACCESS_SECRET=CHANGE_THIS_MIN_32_CHARS
JWT_REFRESH_SECRET=CHANGE_THIS_MIN_32_CHARS

# OpenAI
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
AI_MAX_TOKENS=2048
AI_TEMPERATURE=0.7
AI_RAG_TOP_K=6

# Frontend
FRONTEND_URL=https://$domain
"@

$envExample | Out-File -FilePath "$tempDir\.env.example" -Encoding UTF8

# Criar zip
Write-Host "Criando arquivo ZIP..." -ForegroundColor Yellow
Compress-Archive -Path "$tempDir\*" -DestinationPath $archiveName -Force

$fileSize = (Get-Item $archiveName).Length / 1MB
Write-Host "Arquivo criado: $archiveName ($([math]::Round($fileSize, 2)) MB)" -ForegroundColor Green

# Limpar temp
Remove-Item -Recurse -Force $tempDir

Write-Host ""
Write-Host "Deploy package ready: $archiveName" -ForegroundColor Green
Write-Host "Domain: $domain" -ForegroundColor Cyan




