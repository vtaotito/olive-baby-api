# ✅ Checklist de Deploy - Olive Assistant

## Antes do Deploy

- [ ] **Variáveis de ambiente configuradas** (`.env`)
  - [ ] `OPENAI_API_KEY` válida
  - [ ] `JWT_ACCESS_SECRET` (mínimo 32 caracteres)
  - [ ] `JWT_REFRESH_SECRET` (mínimo 32 caracteres)
  - [ ] `DATABASE_URL` configurada
  - [ ] `REDIS_URL` configurada
  - [ ] `FRONTEND_URL` configurada

- [ ] **Docker e Docker Compose** instalados e funcionando
- [ ] **Portas disponíveis**: 80, 443, 4000, 5432, 6379
- [ ] **Base de conhecimento** preparada em `knowledge/`

## Durante o Deploy

- [ ] Executar script de deploy: `./deploy-ai.sh --ingest` ou `.\deploy-ai.ps1 -Ingest`
- [ ] Verificar se containers iniciaram: `docker-compose -f docker-compose.vps.ai.yml ps`
- [ ] Verificar logs sem erros: `docker-compose -f docker-compose.vps.ai.yml logs`

## Após o Deploy

### Verificações Básicas

- [ ] **Health Check API**: `curl http://localhost/health`
  - Deve retornar: `{"status":"ok",...}`

- [ ] **Health Check AI**: `curl http://localhost/api/v1/ai/health`
  - Deve retornar: `{"success":true,"data":{"openaiConfigured":true,...}}`

- [ ] **Frontend acessível**: Abrir `http://localhost` no navegador
  - Deve carregar a aplicação React

### Verificações de Banco

- [ ] **Migrations aplicadas**:
  ```sql
  SELECT * FROM _prisma_migrations WHERE name LIKE '%ai_assistant%';
  ```

- [ ] **Tabelas AI criadas**:
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name LIKE 'ai_%';
  ```
  - Deve retornar: `ai_documents`, `ai_chunks`, `ai_chat_sessions`, `ai_chat_messages`, `ai_insights`

- [ ] **Extensão pgvector ativa**:
  ```sql
  SELECT * FROM pg_extension WHERE extname = 'vector';
  ```

- [ ] **Base de conhecimento indexada**:
  ```sql
  SELECT COUNT(*) FROM ai_documents;
  SELECT COUNT(*) FROM ai_chunks WHERE embedding IS NOT NULL;
  ```
  - Deve ter pelo menos 4 documentos e vários chunks

### Testes Funcionais

- [ ] **Login no frontend** funciona
- [ ] **Acessar `/assistant`** carrega a página
- [ ] **Criar sessão de chat** funciona
- [ ] **Enviar mensagem** recebe resposta da IA
- [ ] **Insights aparecem** na sidebar (se houver dados do bebê)
- [ ] **Quick Actions** funcionam

### Testes de API (Postman)

- [ ] `POST /api/v1/ai/chat/sessions` - Criar sessão
- [ ] `POST /api/v1/ai/chat/sessions/:id/messages` - Enviar mensagem
- [ ] `GET /api/v1/ai/insights/:babyId` - Listar insights
- [ ] `GET /api/v1/ai/documents` - Listar documentos indexados

## Problemas Comuns

### ❌ "OpenAI API key not configured"
**Solução**: Verificar se `OPENAI_API_KEY` está no `.env` e foi carregado

### ❌ "pgvector extension not found"
**Solução**: Usar imagem `pgvector/pgvector:pg16` no docker-compose

### ❌ "No documents found"
**Solução**: Executar `npm run ai:ingest` ou via Docker

### ❌ "Connection refused" no banco
**Solução**: Aguardar mais tempo ou verificar se o container postgres está rodando

### ❌ Frontend não carrega
**Solução**: Verificar logs do nginx e se o container web está rodando

## Comandos Úteis

```bash
# Ver status dos containers
docker-compose -f docker-compose.vps.ai.yml ps

# Ver logs em tempo real
docker-compose -f docker-compose.vps.ai.yml logs -f

# Reiniciar um serviço específico
docker-compose -f docker-compose.vps.ai.yml restart api

# Parar tudo
docker-compose -f docker-compose.vps.ai.yml down

# Reindexar base de conhecimento
docker-compose -f docker-compose.vps.ai.yml --profile ingest run --rm ai-ingest

# Acessar banco de dados
docker-compose -f docker-compose.vps.ai.yml exec postgres psql -U olivebaby -d olivebaby
```

## Próximos Passos Pós-Deploy

1. ⚠️ Configurar SSL/TLS (Let's Encrypt)
2. ⚠️ Configurar backup automático do banco
3. ⚠️ Configurar monitoramento (Sentry, DataDog)
4. ⚠️ Configurar alertas (email, webhook)
5. ⚠️ Otimizar índices do banco (se necessário)
6. ⚠️ Configurar CDN para assets estáticos
