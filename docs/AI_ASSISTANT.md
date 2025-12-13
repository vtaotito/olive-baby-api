# 🫒 Olive Assistant - Documentação Técnica

## Visão Geral

O Olive Assistant é um assistente de IA integrado ao Olive Baby que ajuda mães, pais e cuidadores com informações sobre sono, amamentação, rotinas e desenvolvimento infantil. Ele usa RAG (Retrieval-Augmented Generation) para fornecer respostas baseadas em uma base de conhecimento curada e pode acessar dados reais do bebê para personalizar orientações.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                             │
├─────────────────────────────────────────────────────────────────────┤
│  AssistantPage  │  AssistantChat  │  InsightCards  │  QuickActions  │
└────────┬────────┴────────┬────────┴───────┬────────┴───────┬────────┘
         │                 │                │                │
         └────────────────┼────────────────┴────────────────┘
                          │ REST API
┌─────────────────────────┴───────────────────────────────────────────┐
│                         Backend (Express)                            │
├─────────────────────────────────────────────────────────────────────┤
│                      AI Controller / Routes                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  OpenAI  │  │   RAG    │  │  Tools   │  │ Insight  │            │
│  │ Service  │  │ Service  │  │ Service  │  │ Engine   │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│       │             │             │             │                   │
│       └─────────────┼─────────────┼─────────────┘                   │
│                     │             │                                 │
│              ┌──────┴──────┐  ┌───┴───┐                            │
│              │  pgvector   │  │Prisma │                            │
│              │  (chunks)   │  │(data) │                            │
│              └─────────────┘  └───────┘                            │
└─────────────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────────┐
│                      PostgreSQL + pgvector                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ ai_documents │  │  ai_chunks   │  │ai_chat_msgs  │               │
│  │              │  │ (embeddings) │  │              │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

## Componentes

### Backend

#### 1. OpenAI Service (`services/ai/openai.service.ts`)
- Gerencia comunicação com a API da OpenAI
- Gera embeddings para busca vetorial
- Executa chat completions com suporte a tool calling

#### 2. RAG Service (`services/ai/rag.service.ts`)
- Indexa documentos na base de conhecimento
- Divide conteúdo em chunks com overlap
- Busca chunks relevantes via similaridade vetorial
- Extrai metadados e tags dos documentos

#### 3. AI Tools Service (`services/ai/tools.service.ts`)
- Implementa ferramentas que o LLM pode chamar:
  - `getBabyProfile`: Obtém perfil do bebê
  - `getBabyStats`: Obtém estatísticas (sono, alimentação, fraldas)
  - `listRoutines`: Lista registros de rotina
  - `getLatestGrowth`: Obtém medidas de crescimento
  - `listMilestones`: Lista marcos de desenvolvimento
  - `createRoutine`: Registra novas rotinas

#### 4. Chat Service (`services/ai/chat.service.ts`)
- Orquestra sessões de chat
- Monta contexto (RAG + histórico + dados do bebê)
- Executa loop de tool calling
- Adiciona disclaimers de segurança
- Persiste mensagens

#### 5. Insight Service (`services/ai/insight.service.ts`)
- Analisa dados do bebê e gera insights automáticos
- Regras implementadas:
  - `sleep_pattern`: Sono abaixo/acima do esperado
  - `cluster_feeding`: Mamadas em cluster
  - `diaper_alert`: Poucas fraldas molhadas
  - `breast_distribution`: Preferência de seio
  - `feeding_pattern`: Intervalo longo sem mamada

### Frontend

#### 1. AI Store (`stores/aiStore.ts`)
- Gerencia estado das sessões de chat
- Controla mensagens e citações
- Gerencia insights

#### 2. AssistantChat (`components/assistant/AssistantChat.tsx`)
- Interface de chat com a Olive
- Suporte a markdown nas respostas
- Sugestões de perguntas iniciais

#### 3. InsightCards (`components/assistant/InsightCards.tsx`)
- Exibe cards de insights por severidade
- Permite marcar como lido ou dispensar

#### 4. QuickActions (`components/assistant/QuickActions.tsx`)
- Ações rápidas para registrar rotinas via chat

#### 5. CitationsDrawer (`components/assistant/CitationsDrawer.tsx`)
- Mostra fontes consultadas pelo RAG

## Configuração

### Variáveis de Ambiente

```env
# OpenAI
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# AI Configuration
AI_MAX_TOKENS=2048
AI_TEMPERATURE=0.7
AI_RAG_TOP_K=6
```

### Banco de Dados

A migration cria:
- Extensão pgvector
- Tabelas: `ai_documents`, `ai_chunks`, `ai_chat_sessions`, `ai_chat_messages`, `ai_insights`
- Índice IVFFlat para busca vetorial

```bash
# Rodar migrations
npm run prisma:migrate:deploy
```

## Ingestão da Base de Conhecimento

### Estrutura de Diretórios

```
olive-baby-api/
├── knowledge/           # Documentos curados
│   ├── sono-infantil.md
│   ├── amamentacao.md
│   ├── fraldas-sinais.md
│   └── desenvolvimento-marcos.md
└── docs/               # Documentação adicional
```

### Executar Ingestão

```bash
# Desenvolvimento
npm run ai:ingest

# Produção (Docker)
docker-compose -f docker-compose.vps.ai.yml --profile ingest run --rm ai-ingest
```

### Formato dos Documentos

Os documentos devem ser em Markdown com:
- Títulos bem definidos (`#`, `##`, `###`)
- Conteúdo organizado em seções
- Listas para informações estruturadas
- Destaques com **negrito** para pontos importantes

## Endpoints da API

### Chat Sessions

```
POST   /api/v1/ai/chat/sessions           # Criar sessão
GET    /api/v1/ai/chat/sessions           # Listar sessões
GET    /api/v1/ai/chat/sessions/:id       # Obter sessão
POST   /api/v1/ai/chat/sessions/:id/messages  # Enviar mensagem
DELETE /api/v1/ai/chat/sessions/:id       # Deletar sessão
PATCH  /api/v1/ai/chat/sessions/:id/archive   # Arquivar sessão
```

### Insights

```
GET    /api/v1/ai/insights/:babyId        # Listar insights
POST   /api/v1/ai/insights/:babyId/generate   # Gerar insights
PATCH  /api/v1/ai/insights/:id/read       # Marcar como lido
PATCH  /api/v1/ai/insights/:id/dismiss    # Dispensar insight
```

### Knowledge Base

```
GET    /api/v1/ai/documents               # Listar documentos
POST   /api/v1/ai/documents/ingest        # Indexar documento
DELETE /api/v1/ai/documents/:id           # Remover documento
POST   /api/v1/ai/search                  # Buscar na base
```

### Health Check

```
GET    /api/v1/ai/health                  # Status do serviço
```

## Regras de Segurança

O assistente segue regras rígidas de segurança:

1. **Nunca faz diagnóstico médico**
2. **Nunca prescreve medicamentos ou doses**
3. **Sempre adiciona disclaimers apropriados**
4. **Alerta para sinais de emergência**:
   - Febre alta
   - Dificuldade respiratória
   - Pouco xixi/desidratação
   - Letargia extrema
   - Recusa alimentar persistente

## Deploy

### Docker Compose

```bash
# Build e start
docker-compose -f docker-compose.vps.ai.yml up -d

# Com ingestão
./deploy-ai.sh --ingest

# Ver logs
docker-compose -f docker-compose.vps.ai.yml logs -f api
```

### Checklist de Produção

- [ ] OPENAI_API_KEY configurado
- [ ] Rate limiting ativo no Nginx
- [ ] SSL/TLS configurado
- [ ] Backup do banco configurado
- [ ] Monitoramento de erros (logs)
- [ ] Base de conhecimento indexada
- [ ] Health checks funcionando

## Troubleshooting

### Erro: "OpenAI API key not configured"

Verifique se `OPENAI_API_KEY` está definido no `.env`.

### Erro: "No documents found"

Execute a ingestão: `npm run ai:ingest`

### Respostas lentas

1. Verifique a conectividade com a OpenAI
2. Reduza `AI_RAG_TOP_K` se necessário
3. Use modelo mais rápido (gpt-4o-mini)

### Busca vetorial não funciona

1. Verifique se a extensão pgvector está ativa
2. Verifique se há embeddings nos chunks:
   ```sql
   SELECT COUNT(*) FROM ai_chunks WHERE embedding IS NOT NULL;
   ```

### Insights não aparecem

1. Verifique se há dados suficientes do bebê
2. Execute geração manual:
   ```bash
   curl -X POST /api/v1/ai/insights/:babyId/generate
   ```

## Exemplos de Uso

### Criar sessão e enviar mensagem

```javascript
// Criar sessão
const session = await aiService.createSession(babyId, 'Dúvidas sobre sono');

// Enviar mensagem
const response = await aiService.sendMessage(session.id, 'Meu bebê de 3 meses está dormindo muito pouco, isso é normal?');

console.log(response.data.assistantMessage.content);
```

### Buscar insights

```javascript
const insights = await aiService.getInsights(babyId, { refresh: true });

insights.data.forEach(insight => {
  console.log(`[${insight.severity}] ${insight.title}`);
  console.log(insight.explanation);
});
```

## Custos Estimados (OpenAI)

| Operação | Modelo | Custo Aproximado |
|----------|--------|------------------|
| Embedding | text-embedding-3-small | ~$0.02 / 1M tokens |
| Chat | gpt-4o | ~$5 / 1M input tokens |
| Chat | gpt-4o-mini | ~$0.15 / 1M input tokens |

**Estimativa mensal** (1000 usuários, 10 msgs/dia):
- Embeddings: ~$1-2
- Chat (gpt-4o): ~$50-100
- Chat (gpt-4o-mini): ~$5-10

## Roadmap Futuro

- [ ] Streaming de respostas (SSE)
- [ ] Histórico de busca semântica
- [ ] Insights proativos via push notification
- [ ] Integração com curvas de crescimento OMS
- [ ] Suporte a áudio (transcrição)
- [ ] Análise de fotos (desenvolvimento motor)
