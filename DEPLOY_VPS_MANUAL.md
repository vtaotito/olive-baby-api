# ðŸš€ Deploy Manual na VPS - Olive Assistant

## ðŸ“‹ Status

âœ… **Arquivos preparados:**
- Backend: `olive-baby-api-ai_20251213_082547.zip`
- Frontend: `olivebaby-web-ai-deploy-20251213_082629.zip`
- DomÃ­nio: `oliecare.cloud`

## ðŸ”§ Passos para Deploy na VPS

### 1. Conectar na VPS via SSH

```bash
ssh usuario@oliecare.cloud
# ou
ssh usuario@IP_DA_VPS
```

### 2. Criar DiretÃ³rio de Trabalho

```bash
# Criar diretÃ³rio para o projeto
mkdir -p /docker/olive-baby
cd /docker/olive-baby
```

### 3. Upload dos Arquivos

**OpÃ§Ã£o A: Via SCP (do seu computador local)**

```powershell
# Backend
scp "C:\Users\Vitor A. Tito\Documents\GPTO\OliverBaby\olive-baby-api\olive-baby-api-ai_20251213_082547.zip" usuario@oliecare.cloud:/docker/olive-baby/

# Frontend
scp "C:\Users\Vitor A. Tito\Documents\GPTO\OliverBaby\olive-baby-web\olivebaby-web-ai-deploy-20251213_082629.zip" usuario@oliecare.cloud:/docker/olive-baby/
```

**OpÃ§Ã£o B: Via SFTP/FTP Client**

Use um cliente como FileZilla, WinSCP ou similar para fazer upload dos arquivos.

### 4. Na VPS - Extrair e Configurar Backend

```bash
cd /docker/olive-baby

# Extrair backend
unzip olive-baby-api-ai_20251213_082547.zip -d api/
cd api/

# Criar arquivo .env
nano .env
```

**ConteÃºdo do .env (copie e ajuste):**
```env
NODE_ENV=production
PORT=4000
API_PREFIX=/api/v1

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
JWT_ACCESS_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# SMTP (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app

# Frontend
FRONTEND_URL=https://oliecare.cloud

# OpenAI / AI Assistant
OPENAI_API_KEY=sk-proj-SUA_CHAVE_AQUI
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
AI_MAX_TOKENS=2048
AI_TEMPERATURE=0.7
AI_RAG_TOP_K=6
```

### 5. Deploy do Backend

```bash
cd /docker/olive-baby/api

# Executar deploy
chmod +x deploy-ai.sh
./deploy-ai.sh --ingest

# OU manualmente:
docker compose -f docker-compose.vps.ai.yml up -d --build
sleep 15
docker compose -f docker-compose.vps.ai.yml exec -T api npm run prisma:migrate:deploy
docker compose -f docker-compose.vps.ai.yml --profile ingest run --rm ai-ingest
```

### 6. Deploy do Frontend

```bash
cd /docker/olive-baby

# Extrair frontend
unzip olivebaby-web-ai-deploy-20251213_082629.zip -d web/
cd web/

# Build e deploy (se necessÃ¡rio)
docker compose -f docker-compose.yml up -d --build
```

### 7. Verificar Deploy

```bash
# Verificar containers
docker compose -f docker-compose.vps.ai.yml ps

# Verificar logs
docker compose -f docker-compose.vps.ai.yml logs -f api

# Health checks
curl http://localhost/health
curl http://localhost/api/v1/ai/health

# Verificar base de conhecimento
docker compose -f docker-compose.vps.ai.yml exec postgres psql -U olivebaby -d olivebaby -c "SELECT COUNT(*) FROM ai_documents;"
```

## ðŸ” Troubleshooting

### Erro: "docker compose" nÃ£o encontrado

```bash
# Use docker-compose (com hÃ­fen) se necessÃ¡rio
docker-compose -f docker-compose.vps.ai.yml up -d
```

### Erro: Portas jÃ¡ em uso

```bash
# Verificar portas em uso
netstat -tulpn | grep :80
netstat -tulpn | grep :4000

# Parar containers conflitantes
docker ps
docker stop CONTAINER_ID
```

### Erro: PermissÃµes

```bash
# Dar permissÃµes ao diretÃ³rio
sudo chown -R $USER:$USER /docker/olive-baby
chmod +x deploy-ai.sh
```

## ðŸ“ Notas Importantes

1. **Primeira vez**: O deploy pode levar 10-15 minutos (build das imagens)
2. **IngestÃ£o**: A base de conhecimento pode levar 2-5 minutos
3. **Portas**: Certifique-se de que 80, 443, 4000 estÃ£o abertas no firewall
4. **SSL**: Configure SSL/TLS apÃ³s o deploy funcionar

## âœ… Checklist PÃ³s-Deploy

- [ ] Containers rodando
- [ ] API responde em `/health`
- [ ] AI Health OK em `/api/v1/ai/health`
- [ ] Frontend acessÃ­vel
- [ ] Base de conhecimento indexada (4+ documentos)
- [ ] Chat funciona em `/assistant`
- [ ] Insights aparecem

## ðŸŽ¯ PrÃ³ximos Passos

1. âš ï¸ Configurar SSL/TLS (Let's Encrypt)
2. âš ï¸ Configurar backup automÃ¡tico
3. âš ï¸ Monitoramento
4. âš ï¸ Rate limiting ajustado
