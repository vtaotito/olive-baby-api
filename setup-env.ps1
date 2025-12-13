# Script para configurar .env com variaveis necessarias para AI Assistant
$envFile = ".env"
$openaiKey = "sk-proj-SUA_CHAVE_AQUI"

Write-Host "Configurando arquivo .env..." -ForegroundColor Cyan

# Ler arquivo .env existente
$envContent = @()
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile
    Write-Host "Arquivo .env encontrado" -ForegroundColor Green
} else {
    Write-Host "Arquivo .env nao encontrado, criando novo..." -ForegroundColor Yellow
}

# Variaveis AI para adicionar/atualizar
$aiVars = @(
    "OPENAI_API_KEY=$openaiKey",
    "OPENAI_MODEL=gpt-4o",
    "OPENAI_EMBEDDING_MODEL=text-embedding-3-small",
    "AI_MAX_TOKENS=2048",
    "AI_TEMPERATURE=0.7",
    "AI_RAG_TOP_K=6"
)

# Remover variaveis AI existentes
$newContent = @()
foreach ($line in $envContent) {
    $isAiVar = $false
    foreach ($aiVar in $aiVars) {
        $varName = $aiVar.Split('=')[0]
        if ($line -match "^$varName=") {
            $isAiVar = $true
            break
        }
    }
    if (-not $isAiVar) {
        $newContent += $line
    }
}

# Adicionar variaveis AI
$newContent += ""
$newContent += "# =========================================="
$newContent += "# OpenAI / AI Assistant"
$newContent += "# =========================================="
foreach ($aiVar in $aiVars) {
    $newContent += $aiVar
    $varName = $aiVar.Split('=')[0]
    Write-Host "  $varName configurado" -ForegroundColor Green
}

# Salvar arquivo
$newContent | Set-Content $envFile -Encoding UTF8
Write-Host ""
Write-Host "Arquivo .env atualizado com variaveis AI!" -ForegroundColor Green
