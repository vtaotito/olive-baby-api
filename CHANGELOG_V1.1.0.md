# 🚀 Changelog v1.1.0 - Stripe Billing & AI Admin

**Data:** 2026-01-03

## ✨ Novas Funcionalidades

### 🔵 Feature 1: Stripe Billing (Monetização)

**Backend:**
- Integração completa com Stripe API
- Checkout Sessions para iniciar assinaturas
- Customer Portal para gerenciamento
- Webhooks para sincronização de status
- Modelos: `BillingEvent`, campos Stripe em `Plan`/`Subscription`

**Endpoints:**
- `POST /api/v1/billing/checkout-session` - Criar sessão de checkout
- `POST /api/v1/billing/portal-session` - Abrir portal do cliente
- `POST /api/v1/billing/webhook` - Receber webhooks Stripe
- `GET /api/v1/billing/me` - Status do usuário
- `GET /api/v1/billing/plans` - Planos disponíveis
- `GET /api/v1/billing/status` - Verificar configuração Stripe

**Admin Endpoints:**
- `GET /api/v1/billing/admin/subscriptions` - Assinaturas recentes
- `GET /api/v1/billing/admin/events` - Eventos de billing
- `POST /api/v1/billing/admin/portal-session` - Portal de usuário específico
- `PATCH /api/v1/billing/admin/plans/:id` - Atualizar config Stripe do plano

**Frontend:**
- `/settings/billing` - Página de assinatura do usuário
- `/admin/billing` - Painel admin de billing

### 🤖 Feature 2: AI Assistant Admin

**Backend:**
- Modelo `AiAssistantConfig` com versionamento
- Modelo `KnowledgeBaseDocument` com tags e workflow
- CRUD completo para configs e documentos KB

**Endpoints Admin (protegidos por role ADMIN):**
- `GET /api/v1/admin/ai/config` - Listar configs
- `POST /api/v1/admin/ai/config` - Criar config
- `PATCH /api/v1/admin/ai/config/:id` - Editar config
- `POST /api/v1/admin/ai/config/:id/publish` - Publicar config
- `POST /api/v1/admin/ai/config/:id/duplicate` - Duplicar config
- `GET /api/v1/admin/ai/kb` - Listar documentos KB
- `POST /api/v1/admin/ai/kb` - Criar documento
- `PATCH /api/v1/admin/ai/kb/:id` - Editar documento
- `POST /api/v1/admin/ai/kb/:id/publish` - Publicar documento
- `POST /api/v1/admin/ai/kb/:id/archive` - Arquivar documento
- `GET /api/v1/admin/ai/kb/tags` - Listar tags
- `GET /api/v1/admin/ai/kb/stats` - Estatísticas KB
- `GET /api/v1/admin/ai/preview` - Preview do prompt

**Frontend:**
- `/admin/ai-assistant` - Painel admin do AI Assistant

---

## 📦 Deploy Instructions

### 1. Variáveis de Ambiente (adicionar ao .env)

```env
# Stripe Billing
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 2. Executar Migration

```bash
# Na VPS
cd /path/to/olive-baby-api

# Opção 1: Via Prisma
npx prisma migrate deploy

# Opção 2: SQL Direto
psql -U olivebaby -d olivebaby -f prisma/migrations/20260103_billing_and_ai_admin/migration.sql
```

### 3. Configurar Webhook no Stripe Dashboard

1. Acesse: https://dashboard.stripe.com/webhooks
2. Adicione endpoint: `https://api.seudominio.com/api/v1/billing/webhook`
3. Eventos necessários:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

### 4. Rebuild e Restart

```bash
# Backend
cd /path/to/olive-baby-api
git pull origin master
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Frontend
cd /path/to/olive-baby-web
git pull origin master
npm run build
# ou docker rebuild
```

### 5. Verificar Deploy

```bash
# Health check
curl https://api.seudominio.com/api/v1/health

# Stripe status
curl https://api.seudominio.com/api/v1/billing/status
```

---

## 🗃️ Database Changes

### Novos Enums
- `BillingInterval`: MONTHLY, YEARLY
- `AiConfigStatus`: DRAFT, PUBLISHED, ARCHIVED
- `KnowledgeBaseStatus`: DRAFT, PUBLISHED, ARCHIVED

### SubscriptionStatus (valores adicionados)
- INCOMPLETE
- INCOMPLETE_EXPIRED
- UNPAID
- TRIALING
- PAUSED

### Novas Colunas
**users:**
- `stripe_customer_id` (TEXT, unique)
- `current_period_end` (TIMESTAMP)

**plans:**
- `code` (VARCHAR(50), unique)
- `price_yearly` (DECIMAL)
- `stripe_product_id` (TEXT)
- `stripe_price_id_monthly` (TEXT)
- `stripe_price_id_yearly` (TEXT)

**subscriptions:**
- `stripe_subscription_id` (TEXT, unique)
- `stripe_price_id` (TEXT)
- `interval` (BillingInterval)
- `cancel_at_period_end` (BOOLEAN)

### Novas Tabelas
- `billing_events`
- `ai_assistant_configs`
- `knowledge_base_documents`

---

## ✅ Checklist Pós-Deploy

- [ ] Variáveis Stripe configuradas no .env
- [ ] Migration executada com sucesso
- [ ] Webhook configurado no Stripe Dashboard
- [ ] API respondendo em /billing/status
- [ ] Frontend /settings/billing carregando
- [ ] Admin /admin/billing funcionando
- [ ] Admin /admin/ai-assistant funcionando
