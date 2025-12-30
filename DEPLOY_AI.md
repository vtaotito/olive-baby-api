# 🚀 Guia de Deploy - Olive Assistant

## Pré-requisitos

1. **Docker e Docker Compose** instalados
2. **PostgreSQL com pgvector** (ou usar a imagem do docker-compose)
3. **OpenAI API Key** válida
4. **Variáveis de ambiente** configuradas

## Configuração Inicial

### 1. Criar arquivo `.env`

Copie o exemplo e preencha as variáveis:

```bash
cp .env.example .env
```

**Variáveis obrigatórias:**
```env
# Database
DATABASE_URL=postgresql://user:password@postgres:5432/olivebaby?schema=public
DB_USER=olivebaby
DB_PASSWORD=your_secure_password
DB_NAME=olivebaby

# JWT
JWT_ACCESS_SECRET=your-super-secret-jwt-access-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-jwt-refresh-key-min-32-chars

# OpenAI
OPENAI_API_KEY=sk-proj-your-openai-api-key-here
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Frontend
FRONTEND_URL=https://app.olivebaby.com.br
VITE_API_URL=/api/v1
```

### 2. Preparar Base de Conhecimento

Os documentos em `knowledge/` serão indexados automaticamente. Você pode adicionar mais documentos em Markdown.

## Deploy

### Opção 1: Script Automatizado (Recomendado)

**Linux/Mac:**
```bash
chmod +x deploy-ai.sh
./deploy-ai.sh --ingest
```

**Windows (PowerShell):**
```powershell
.\deploy-ai.ps1 -Ingest
```

### Opção 2: Manual

```bash
# 1. Build e start
docker-compose -f docker-compose.vps.ai.yml up -d --build

# 2. Aguardar banco estar pronto
sleep 10

# 3. Rodar migrations
docker-compose -f docker-compose.vps.ai.yml exec api npm run prisma:migrate:deploy

# 4. Indexar base de conhecimento
docker-compose -f docker-compose.vps.ai.yml --profile ingest run --rm ai-ingest
```

## Verificação

### Health Checks

```bash
# API Health
curl http://localhost/health

# AI Health
curl http://localhost/api/v1/ai/health
```

### Logs

```bash
# Todos os serviços
docker-compose -f docker-compose.vps.ai.yml logs -f

# Apenas API
docker-compose -f docker-compose.vps.ai.yml logs -f api

# Apenas Nginx
docker-compose -f docker-compose.vps.ai.yml logs -f nginx
```

## Atualização da Base de Conhecimento

Para reindexar documentos:

```bash
# Via script
./deploy-ai.sh --ingest

# Ou manualmente
docker-compose -f docker-compose.vps.ai.yml --profile ingest run --rm ai-ingest
```

## Troubleshooting

### Erro: "pgvector extension not found"

Certifique-se de usar a imagem `pgvector/pgvector:pg16` no docker-compose.

### Erro: "OpenAI API key not configured"

Verifique se `OPENAI_API_KEY` está no `.env` e foi carregado corretamente.

### Erro: "No documents found"

Execute a ingestão: `npm run ai:ingest` ou via Docker.

### Containers não iniciam

Verifique os logs:
```bash
docker-compose -f docker-compose.vps.ai.yml logs
```

### Nginx não roteia corretamente

Verifique se o `nginx.conf` está montado corretamente e se as rotas estão configuradas.

## Estrutura de Serviços

```
┌─────────────┐
│   Nginx     │ :80, :443
│ (Reverse    │
│   Proxy)    │
└──────┬──────┘
       │
   ┌───┴───┐
   │       │
┌──▼──┐ ┌─▼───┐
│ API │ │ Web │
│:4000│ │ :80 │
└──┬──┘ └─────┘
   │
┌───▼────┐  ┌────────┐
│Postgres│  │ Redis  │
│:5432   │  │ :6379  │
└────────┘  └────────┘
```

## Próximos Passos

1. ✅ Deploy completo
2. ✅ Base de conhecimento indexada
3. ✅ Testar chat no frontend
4. ✅ Verificar insights automáticos
5. ⚠️ Configurar SSL/TLS (Let's Encrypt)
6. ⚠️ Configurar backup automático
7. ⚠️ Monitoramento (Sentry, DataDog, etc.)




