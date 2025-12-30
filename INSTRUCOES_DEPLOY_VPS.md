# ðŸ“‹ InstruÃ§Ãµes de Deploy na VPS - Passo a Passo

## âœ… Arquivos Preparados

Os seguintes arquivos foram criados e estÃ£o prontos para deploy:

1. **Backend (API)**: `olive-baby-api-ai_20251213_082547.zip`
   - LocalizaÃ§Ã£o: `C:\Users\Vitor A. Tito\Documents\GPTO\OliverBaby\olive-baby-api\`
   - ContÃ©m: Todo o cÃ³digo backend + AI Assistant + docker-compose

2. **Frontend (Web)**: `olivebaby-web-ai-deploy-20251213_082629.zip`
   - LocalizaÃ§Ã£o: `C:\Users\Vitor A. Tito\Documents\GPTO\OliverBaby\olive-baby-web\`
   - ContÃ©m: Todo o cÃ³digo frontend + AI Assistant + docker-compose

## ðŸš€ Como Fazer o Deploy

### MÃ©todo 1: Via SSH (Recomendado)

#### Passo 1: Conectar na VPS

```bash
ssh usuario@oliecare.cloud
# ou use o IP da VPS
```

#### Passo 2: Preparar Ambiente

```bash
# Criar diretÃ³rio
mkdir -p /docker/olive-baby
cd /docker/olive-baby
```

#### Passo 3: Upload dos Arquivos

**Do seu computador Windows (PowerShell):**

```powershell
# Backend
scp "C:\Users\Vitor A. Tito\Documents\GPTO\OliverBaby\olive-baby-api\olive-baby-api-ai_20251213_082547.zip" usuario@oliecare.cloud:/docker/olive-baby/

# Frontend  
scp "C:\Users\Vitor A. Tito\Documents\GPTO\OliverBaby\olive-baby-web\olivebaby-web-ai-deploy-20251213_082629.zip" usuario@oliecare.cloud:/docker/olive-baby/
```

#### Passo 4: Na VPS - Extrair Backend

```bash
cd /docker/olive-baby
unzip olive-baby-api-ai_20251213_082547.zip -d api/
cd api/
```

#### Passo 5: Configurar .env

```bash
nano .env
```

**Cole o conteÃºdo abaixo e ajuste as senhas:**

```env
NODE_ENV=production
PORT=4000
API_PREFIX=/api/v1

DATABASE_URL=postgresql://olivebaby:SUA_SENHA@postgres:5432/olivebaby?schema=public
DB_USER=olivebaby
DB_PASSWORD=SUA_SENHA_SEGURA
DB_NAME=olivebaby

REDIS_URL=redis://:SUA_SENHA_REDIS@redis:6379
REDIS_PASSWORD=SUA_SENHA_REDIS

JWT_ACCESS_SECRET=SUA_CHAVE_SECRETA_ACESSO_MIN_32_CARACTERES_AQUI
JWT_REFRESH_SECRET=SUA_CHAVE_SECRETA_REFRESH_MIN_32_CARACTERES_AQUI
JWT_ACCESS_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

FRONTEND_URL=https://oliecare.cloud

OPENAI_API_KEY=sk-proj-SUA_CHAVE_AQUI
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
AI_MAX_TOKENS=2048
AI_TEMPERATURE=0.7
AI_RAG_TOP_K=6
```

**Salve com Ctrl+O, Enter, Ctrl+X**

#### Passo 6: Executar Deploy do Backend

```bash
# Dar permissÃ£o de execuÃ§Ã£o
chmod +x deploy-ai.sh

# Executar deploy com ingestÃ£o
./deploy-ai.sh --ingest
```

**Isso vai:**
1. Build das imagens Docker
2. Iniciar containers (postgres, redis, api, web, nginx)
3. Rodar migrations
4. Indexar base de conhecimento

#### Passo 7: Deploy do Frontend

```bash
cd /docker/olive-baby
unzip olivebaby-web-ai-deploy-20251213_082629.zip -d web/
cd web/

# Se necessÃ¡rio, build e deploy
docker compose -f docker-compose.yml up -d --build
```

#### Passo 8: Verificar

```bash
# Ver containers
docker compose -f docker-compose.vps.ai.yml ps

# Ver logs
docker compose -f docker-compose.vps.ai.yml logs -f

# Health check
curl http://localhost/health
curl http://localhost/api/v1/ai/health
```

### MÃ©todo 2: Via SFTP/FTP

1. Use FileZilla, WinSCP ou similar
2. Conecte na VPS
3. FaÃ§a upload dos arquivos ZIP para `/docker/olive-baby/`
4. Siga os passos 4-8 acima

## ðŸ”§ Comandos Ãšteis

```bash
# Ver status dos containers
docker compose -f docker-compose.vps.ai.yml ps

# Ver logs em tempo real
docker compose -f docker-compose.vps.ai.yml logs -f api

# Reiniciar um serviÃ§o
docker compose -f docker-compose.vps.ai.yml restart api

# Parar tudo
docker compose -f docker-compose.vps.ai.yml down

# Reindexar base de conhecimento
docker compose -f docker-compose.vps.ai.yml --profile ingest run --rm ai-ingest

# Acessar banco
docker compose -f docker-compose.vps.ai.yml exec postgres psql -U olivebaby -d olivebaby
```

## âš ï¸ Importante

- **Senhas**: Altere todas as senhas no `.env` antes do deploy
- **JWT Secrets**: Use strings aleatÃ³rias de pelo menos 32 caracteres
- **Firewall**: Certifique-se de que as portas 80, 443 estÃ£o abertas
- **SSL**: Configure SSL/TLS apÃ³s o deploy funcionar

## ðŸŽ‰ ApÃ³s o Deploy

Acesse:
- Frontend: `https://oliecare.cloud`
- API: `https://oliecare.cloud/api/v1`
- Assistant: `https://oliecare.cloud/assistant`




