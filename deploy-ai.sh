#!/bin/bash
# Olive Baby - Deploy Script with AI Assistant
# Usage: ./deploy-ai.sh [--ingest]

set -e

echo "🫒 Olive Baby - Deploy with AI Assistant"
echo "========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Please create .env file with required variables."
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check required variables
check_var() {
    if [ -z "${!1}" ]; then
        echo -e "${RED}❌ Missing required variable: $1${NC}"
        exit 1
    fi
}

echo -e "\n${YELLOW}📋 Checking required variables...${NC}"
check_var "JWT_ACCESS_SECRET"
check_var "JWT_REFRESH_SECRET"
check_var "OPENAI_API_KEY"
echo -e "${GREEN}✅ All required variables present${NC}"

# Pull latest changes
echo -e "\n${YELLOW}📥 Pulling latest changes...${NC}"
git pull origin master

# Build and start services
echo -e "\n${YELLOW}🔨 Building Docker images...${NC}"
docker-compose -f docker-compose.vps.ai.yml build

# Stop existing containers
echo -e "\n${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose -f docker-compose.vps.ai.yml down

# Start new containers
echo -e "\n${YELLOW}🚀 Starting services...${NC}"
docker-compose -f docker-compose.vps.ai.yml up -d

# Wait for database to be ready
echo -e "\n${YELLOW}⏳ Waiting for database...${NC}"
sleep 10

# Run migrations
echo -e "\n${YELLOW}📊 Running database migrations...${NC}"
docker-compose -f docker-compose.vps.ai.yml exec -T api npm run prisma:migrate:deploy

# Run AI ingest if flag is set
if [ "$1" == "--ingest" ]; then
    echo -e "\n${YELLOW}🤖 Running AI knowledge base ingestion...${NC}"
    docker-compose -f docker-compose.vps.ai.yml --profile ingest run --rm ai-ingest
fi

# Health check
echo -e "\n${YELLOW}🏥 Running health checks...${NC}"
sleep 5

API_HEALTH=$(curl -s http://localhost/health || echo "error")
if [[ $API_HEALTH == *"ok"* ]]; then
    echo -e "${GREEN}✅ API is healthy${NC}"
else
    echo -e "${RED}⚠️ API health check failed${NC}"
fi

AI_HEALTH=$(curl -s http://localhost/api/v1/ai/health -H "Authorization: Bearer test" || echo "error")
echo -e "AI Service status: ${AI_HEALTH}"

# Show running containers
echo -e "\n${YELLOW}📦 Running containers:${NC}"
docker-compose -f docker-compose.vps.ai.yml ps

# Show logs (last 20 lines)
echo -e "\n${YELLOW}📜 Recent API logs:${NC}"
docker-compose -f docker-compose.vps.ai.yml logs --tail=20 api

echo -e "\n${GREEN}🎉 Deploy completed!${NC}"
echo ""
echo "📌 Next steps:"
echo "   - Check application at: https://app.olivebaby.com.br"
echo "   - View logs: docker-compose -f docker-compose.vps.ai.yml logs -f"
echo "   - Run AI ingest: ./deploy-ai.sh --ingest"
echo ""
