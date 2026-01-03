#!/bin/bash
set -e

echo "=== OLIVE BABY - DEPLOY INICIAL VPS ==="
echo "Executando em: $(pwd)"
echo "Usuario: $(whoami)"
echo ""

# Configuracoes
API_REPO="https://github.com/vtaotito/olive-baby-api.git"
WEB_REPO="https://github.com/vtaotito/olive-baby-web.git"
INSTALL_DIR="/opt/olivebaby"

echo "=== 1. Criando estrutura de diretorios ==="
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

echo "=== 2. Clonando repositorios do GitHub ==="
if [ ! -d "olive-baby-api" ]; then
    echo "Clonando API..."
    git clone $API_REPO
else
    echo "API ja existe, atualizando..."
    cd olive-baby-api && git pull origin master && cd ..
fi

if [ ! -d "olive-baby-web" ]; then
    echo "Clonando WEB..."
    git clone $WEB_REPO
else
    echo "WEB ja existe, atualizando..."
    cd olive-baby-web && git pull origin master && cd ..
fi

echo "=== 3. Configurando variaveis de ambiente API ==="
cd $INSTALL_DIR/olive-baby-api
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
# Database
DATABASE_URL="postgresql://postgres:postgres@db:5432/olivebaby"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"

# Server
PORT=3000
NODE_ENV=production

# CORS
FRONTEND_URL=https://oliecare.cloud

# Email (configure conforme seu provedor)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app
EMAIL_FROM=noreply@oliecare.cloud
EOF
    echo "⚠️  ATENCAO: Configure as variaveis de ambiente em .env"
else
    echo ".env da API ja existe"
fi

echo "=== 4. Configurando variaveis de ambiente WEB ==="
cd $INSTALL_DIR/olive-baby-web
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
VITE_API_URL=https://oliecare.cloud/api/v1
EOF
    echo ".env do WEB criado"
else
    echo ".env do WEB ja existe"
fi

echo "=== 5. Verificando Docker ==="
if ! command -v docker &> /dev/null; then
    echo "❌ Docker nao encontrado! Instale o Docker primeiro:"
    echo "curl -fsSL https://get.docker.com | sh"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose nao encontrado!"
    exit 1
fi

echo "✅ Docker OK: $(docker --version)"

echo "=== 6. Parando containers antigos ==="
cd $INSTALL_DIR/olive-baby-api
docker compose down 2>/dev/null || true

cd $INSTALL_DIR/olive-baby-web
docker compose down 2>/dev/null || true

echo "=== 7. Construindo e iniciando API ==="
cd $INSTALL_DIR/olive-baby-api
docker compose up -d --build

echo "=== 8. Construindo e iniciando WEB ==="
cd $INSTALL_DIR/olive-baby-web
docker compose up -d --build

echo "=== 9. Aguardando containers iniciarem ==="
sleep 10

echo "=== 10. Status dos containers ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=== 11. Verificando saude da API ==="
sleep 5
if curl -f http://localhost:3000/api/v1/health 2>/dev/null; then
    echo "✅ API respondendo corretamente!"
else
    echo "⚠️  API nao respondeu ao health check"
    echo "Logs da API:"
    docker logs $(docker ps -q --filter "name=api") --tail 50
fi

echo ""
echo "=== DEPLOY CONCLUIDO ==="
echo "API instalada em: $INSTALL_DIR/olive-baby-api"
echo "WEB instalada em: $INSTALL_DIR/olive-baby-web"
echo ""
echo "Proximos passos:"
echo "1. Configure as variaveis de ambiente em: $INSTALL_DIR/olive-baby-api/.env"
echo "2. Reinicie a API: cd $INSTALL_DIR/olive-baby-api && docker compose restart"
echo "3. Configure seu servidor web (nginx/apache) para fazer proxy para os containers"
echo "4. Configure SSL/TLS para https://oliecare.cloud"
echo ""
echo "Comandos uteis:"
echo "- Ver logs API: docker logs -f \$(docker ps -q --filter name=api)"
echo "- Ver logs WEB: docker logs -f \$(docker ps -q --filter name=web)"
echo "- Atualizar: cd $INSTALL_DIR/olive-baby-api && git pull && docker compose up -d --build"
