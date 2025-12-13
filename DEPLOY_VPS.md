# ðŸš€ Guia de Deploy na VPS - Olive Assistant

## âœ… Status da ConfiguraÃ§Ã£o

O arquivo `.env` foi configurado localmente com as variÃ¡veis necessÃ¡rias para o AI Assistant:
- âœ… `OPENAI_API_KEY` configurada
- âœ… `OPENAI_MODEL=gpt-4o`
- âœ… `OPENAI_EMBEDDING_MODEL=text-embedding-3-small`
- âœ… `AI_MAX_TOKENS=2048`
- âœ… `AI_TEMPERATURE=0.7`
- âœ… `AI_RAG_TOP_K=6`

## ðŸ“‹ Passos para Deploy na VPS

### 1. Conectar na VPS

```bash
ssh usuario@seu-servidor.com
```

### 2. Clonar/Atualizar RepositÃ³rios

```bash
# Backend
cd /caminho/para/olive-baby-api
git pull origin master

# Frontend (se necessÃ¡rio)
cd /caminho/para/olive-baby-web
git pull origin master
```

### 3. Configurar .env na VPS

Copie o arquivo `.env` local para a VPS ou crie um novo com as variÃ¡veis:

```bash
# Na VPS
cd /caminho/para/olive-baby-api
nano .env
```

**VariÃ¡veis obrigatÃ³rias:**
```env
# Database
DATABASE_URL=postgresql://olivebaby:SUA_SENHA@postgres:5432/olivebaby?schema=public
DB_USER=olivebaby
DB_PASSWORD=SUA_SENHA_SEGURA
DB_NAME=olivebaby

# Redis
REDIS_URL=redis://:SUA_SENHA_REDIS@redis:6379
REDIS_PASSWORD=SUA_SENHA_REDIS

# JWT (OBRIGATÃ“RIO - mÃ­nimo 32 caracteres)
JWT_ACCESS_SECRET=SUA_CHAVE_SECRETA_ACESSO_MIN_32_CARACTERES
JWT_REFRESH_SECRET=SUA_CHAVE_SECRETA_REFRESH_MIN_32_CARACTERES

# OpenAI (OBRIGATÃ“RIO para AI Assistant)
OPENAI_API_KEY=sk-proj-SUA_CHAVE_AQUI
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
AI_MAX_TOKENS=2048
AI_TEMPERATURE=0.7
AI_RAG_TOP_K=6

# Frontend
FRONTEND_URL=https://app.olivebaby.com.br
VITE_API_URL=/api/v1

# SMTP (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app
```

### 4. Executar Deploy

**OpÃ§Ã£o A: Script Automatizado (Linux)**
```bash
cd /caminho/para/olive-baby-api
chmod +x deploy-ai.sh
./deploy-ai.sh --ingest
```

**OpÃ§Ã£o B: Manual**
```bash
cd /caminho/para/olive-baby-api

# 1. Build e start
docker compose -f docker-compose.vps.ai.yml up -d --build

# 2. Aguardar banco estar pronto
sleep 15

# 3. Rodar migrations
docker compose -f docker-compose.vps.ai.yml exec -T api npm run prisma:migrate:deploy

# 4. Indexar base de conhecimento
docker compose -f docker-compose.vps.ai.yml --profile ingest run --rm ai-ingest
```

### 5. Verificar Deploy

```bash
# Verificar containers
docker compose -f docker-compose.vps.ai.yml ps

# Verificar logs
docker compose -f docker-compose.vps.ai.yml logs -f api

# Health checks
curl http://localhost/health
curl http://localhost/api/v1/ai/health
```

### 6. Verificar Base de Conhecimento

```bash
# Conectar ao banco
docker compose -f docker-compose.vps.ai.yml exec postgres psql -U olivebaby -d olivebaby

# Verificar documentos indexados
SELECT COUNT(*) FROM ai_documents;
SELECT COUNT(*) FROM ai_chunks WHERE embedding IS NOT NULL;

# Deve retornar pelo menos 4 documentos e vÃ¡rios chunks
```

## ðŸ”§ Troubleshooting

### Erro: "docker compose" nÃ£o encontrado

Se estiver usando versÃ£o antiga do Docker:
```bash
# Use docker-compose (com hÃ­fen)
docker-compose -f docker-compose.vps.ai.yml up -d
```

### Erro: "pgvector extension not found"

Verifique se a imagem estÃ¡ correta:
```yaml
# No docker-compose.vps.ai.yml
postgres:
  image: pgvector/pgvector:pg16  # Deve ser esta imagem
```

### Erro: "OpenAI API key not configured"

Verifique se a variÃ¡vel estÃ¡ no `.env`:
```bash
grep OPENAI_API_KEY .env
```

### Erro: "No documents found" na ingestÃ£o

Verifique se os arquivos estÃ£o no lugar:
```bash
ls -la knowledge/
ls -la docs/
```

### Containers nÃ£o iniciam

Verifique logs:
```bash
docker compose -f docker-compose.vps.ai.yml logs
```

## ðŸ“Š VerificaÃ§Ã£o PÃ³s-Deploy

### Checklist

- [ ] Containers rodando: `docker compose ps`
- [ ] API responde: `curl http://localhost/health`
- [ ] AI Health OK: `curl http://localhost/api/v1/ai/health`
- [ ] Frontend acessÃ­vel: Abrir no navegador
- [ ] Base de conhecimento indexada: Verificar no banco
- [ ] Chat funciona: Testar em `/assistant`
- [ ] Insights aparecem: Verificar sidebar

## ðŸŽ¯ PrÃ³ximos Passos

1. âœ… Deploy completo
2. âœ… Base de conhecimento indexada
3. âš ï¸ Configurar SSL/TLS (Let's Encrypt)
4. âš ï¸ Configurar backup automÃ¡tico
5. âš ï¸ Monitoramento (Sentry, DataDog)
6. âš ï¸ Rate limiting ajustado conforme trÃ¡fego

## ðŸ“ Notas

- O deploy pode levar 5-10 minutos na primeira vez (build das imagens)
- A ingestÃ£o da base de conhecimento pode levar 2-5 minutos
- Certifique-se de que as portas 80 e 443 estÃ£o abertas no firewall
- Para produÃ§Ã£o, configure SSL/TLS antes de expor publicamente
