# Olive Baby - Deploy Script with AI Assistant (PowerShell)
# Usage: .\deploy-ai.ps1 [-Ingest]

param(
    [switch]$Ingest
)

Write-Host "Olive Baby - Deploy with AI Assistant" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Check if .env exists
if (-not (Test-Path .env)) {
    Write-Host ".env file not found!" -ForegroundColor Red
    Write-Host "Please create .env file with required variables."
    exit 1
}

# Load environment variables
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

# Check required variables
function Check-Variable {
    param([string]$Name)
    $value = [Environment]::GetEnvironmentVariable($Name, "Process")
    if ([string]::IsNullOrEmpty($value)) {
        Write-Host "Missing required variable: $Name" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Checking required variables..." -ForegroundColor Yellow
Check-Variable "JWT_ACCESS_SECRET"
Check-Variable "JWT_REFRESH_SECRET"
Check-Variable "OPENAI_API_KEY"
Write-Host "All required variables present" -ForegroundColor Green

# Pull latest changes
Write-Host ""
Write-Host "Pulling latest changes..." -ForegroundColor Yellow
git pull origin master

# Detect docker compose command
$dockerCompose = "docker compose"
if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
    Write-Host "Docker nao encontrado. Por favor, instale o Docker Desktop." -ForegroundColor Red
    exit 1
}

# Build and start services
Write-Host ""
Write-Host "Building Docker images..." -ForegroundColor Yellow
docker compose -f docker-compose.vps.ai.yml build

# Stop existing containers
Write-Host ""
Write-Host "Stopping existing containers..." -ForegroundColor Yellow
docker compose -f docker-compose.vps.ai.yml down

# Start new containers
Write-Host ""
Write-Host "Starting services..." -ForegroundColor Yellow
docker compose -f docker-compose.vps.ai.yml up -d

# Wait for database to be ready
Write-Host ""
Write-Host "Waiting for database..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Run migrations
Write-Host ""
Write-Host "Running database migrations..." -ForegroundColor Yellow
docker compose -f docker-compose.vps.ai.yml exec -T api npm run prisma:migrate:deploy

# Run AI ingest if flag is set
if ($Ingest) {
    Write-Host ""
    Write-Host "Running AI knowledge base ingestion..." -ForegroundColor Yellow
    docker compose -f docker-compose.vps.ai.yml --profile ingest run --rm ai-ingest
}

# Health check
Write-Host ""
Write-Host "Running health checks..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    $apiHealth = Invoke-WebRequest -Uri "http://localhost/health" -UseBasicParsing -ErrorAction SilentlyContinue
    if ($apiHealth.Content -match "ok") {
        Write-Host "API is healthy" -ForegroundColor Green
    } else {
        Write-Host "API health check failed" -ForegroundColor Red
    }
} catch {
    Write-Host "API health check failed" -ForegroundColor Red
}

# Show running containers
Write-Host ""
Write-Host "Running containers:" -ForegroundColor Yellow
docker compose -f docker-compose.vps.ai.yml ps

# Show logs (last 20 lines)
Write-Host ""
Write-Host "Recent API logs:" -ForegroundColor Yellow
docker compose -f docker-compose.vps.ai.yml logs --tail=20 api

Write-Host ""
Write-Host "Deploy completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "   - Check application at: https://app.olivebaby.com.br"
Write-Host "   - View logs: docker compose -f docker-compose.vps.ai.yml logs -f"
Write-Host "   - Run AI ingest: .\deploy-ai.ps1 -Ingest"
Write-Host ""




