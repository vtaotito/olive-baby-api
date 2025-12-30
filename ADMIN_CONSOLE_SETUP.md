# Olive Baby - Admin Console Setup

Este documento descreve como configurar e usar o Painel Administrativo do Olive Baby.

## 📋 Pré-requisitos

- PostgreSQL rodando
- Node.js 18+
- API e Web configurados

## 🚀 Aplicando a Migration

### 1. Aplicar via SQL direto (Recomendado para produção)

Copie o conteúdo do arquivo de migration e execute no seu banco:

```bash
# Via psql
psql -h <host> -U <user> -d olivebaby -f prisma/migrations/20251230000001_add_plan_subscription_audit/migration.sql

# Ou via Docker
docker exec -i postgres psql -U olivebaby -d olivebaby < prisma/migrations/20251230000001_add_plan_subscription_audit/migration.sql
```

### 2. Aplicar via Prisma (Desenvolvimento)

```bash
cd olive-baby-api
npx prisma migrate deploy
```

### 3. Gerar o Prisma Client

Após a migration, gere o client atualizado:

```bash
npx prisma generate
```

## 👤 Promovendo um Usuário a ADMIN

### Via SQL direto

```sql
-- Promover usuário por email
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@example.com';

-- Verificar usuários admin
SELECT id, email, role FROM users WHERE role = 'ADMIN';
```

### Via Script Node.js

Crie um arquivo `scripts/promote-admin.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function promoteToAdmin(email: string) {
  const user = await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN' },
  });
  
  console.log(`✅ Usuário ${user.email} promovido a ADMIN`);
}

// Executar
promoteToAdmin('seu-email@example.com')
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
```

Execute com:

```bash
npx ts-node scripts/promote-admin.ts
```

## 🔒 Endpoints do Admin

Todos os endpoints requerem autenticação e role `ADMIN`:

### Endpoints Básicos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/admin/metrics?range=7d\|30d` | Dashboard KPIs |
| GET | `/admin/usage?range=7d\|30d\|90d` | Analytics detalhados |
| GET | `/admin/plans` | Listar planos disponíveis |
| GET | `/admin/users` | Listar usuários (paginado) |
| GET | `/admin/users/:id` | Detalhes do usuário |
| PATCH | `/admin/users/:id/plan` | Alterar plano do usuário |
| PATCH | `/admin/users/:id/status` | Bloquear/Desbloquear usuário |
| POST | `/admin/users/:id/impersonate` | Impersonar usuário (suporte) |
| GET | `/admin/babies` | Listar bebês (paginado) |

### Endpoints Avançados (Analytics)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/admin/funnel?range=7d\|30d` | Funil de ativação (cadastro → bebê → rotina) |
| GET | `/admin/cohorts?unit=week&lookback=12` | Cohorts semanais com retenção D1/D7/D30 |
| GET | `/admin/paywall?range=7d\|30d` | Paywall hits por feature + conversão |
| GET | `/admin/upgrade-candidates` | Lead scoring para upgrade premium |
| GET | `/admin/data-quality` | Completude de metadados por tipo de rotina |
| GET | `/admin/errors?range=7d\|30d` | Error analytics (4xx/5xx) + fricção |

### Exemplos de Request

#### Alterar plano de usuário

```bash
curl -X PATCH http://localhost:4000/api/v1/admin/users/123/plan \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"planType": "PREMIUM"}'
```

#### Bloquear usuário

```bash
curl -X PATCH http://localhost:4000/api/v1/admin/users/123/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "BLOCKED", "reason": "Violação dos termos"}'
```

## 🎨 Acessando o Admin Console (Frontend)

1. Faça login com um usuário ADMIN
2. No menu lateral, aparecerá o link "Admin Console"
3. Ou acesse diretamente: `https://app.oliecare.cloud/admin`

### Páginas disponíveis:

- `/admin` - Dashboard com KPIs e gráficos
- `/admin/users` - Gerenciamento de usuários
- `/admin/babies` - Visualização de bebês
- `/admin/usage` - Métricas de uso detalhadas
- `/admin/activation` - Funil de ativação + Cohorts (retenção D1/D7/D30)
- `/admin/monetization` - Paywall analytics + Upgrade candidates (lead scoring)
- `/admin/quality` - Data quality por tipo de rotina
- `/admin/errors` - Error analytics e fricção

## 📊 Sistema de Planos e Entitlements

### Planos Padrão

| Plano | Preço | Bebês | Profissionais | Export | AI Chat |
|-------|-------|-------|---------------|--------|---------|
| FREE | R$ 0 | 1 | 0 | ❌ | ❌ |
| PREMIUM | R$ 29,90/mês | 5 | 10 | ✅ | ✅ |

### Features por Plano

**Free:**
- 1 bebê
- 0 profissionais
- 7 dias de histórico
- Sem exportação

**Premium:**
- 5 bebês
- 10 profissionais
- Histórico ilimitado
- Exportação PDF/CSV
- Assistente IA
- Insights avançados
- Suporte prioritário

## 🛡️ Auditoria

Todas as ações administrativas são registradas na tabela `audit_events`:

```sql
SELECT 
  ae.*,
  u.email as user_email
FROM audit_events ae
LEFT JOIN users u ON ae.user_id = u.id
WHERE ae.action IN ('ADMIN_PLAN_CHANGED', 'ADMIN_USER_BLOCKED', 'ADMIN_USER_UNBLOCKED')
ORDER BY ae.created_at DESC
LIMIT 50;
```

### Eventos de Paywall

```sql
SELECT 
  metadata->>'feature' as feature,
  COUNT(*) as hits,
  DATE(created_at) as date
FROM audit_events
WHERE action = 'PAYWALL_HIT'
GROUP BY metadata->>'feature', DATE(created_at)
ORDER BY date DESC, hits DESC;
```

## 🐛 Troubleshooting

### Erro: "Role 'X' não tem acesso a este recurso"

O usuário não tem role ADMIN. Promova-o via SQL:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'seu-email@example.com';
```

### Erro: "Token inválido ou expirado"

Faça logout e login novamente para obter um novo token.

### Migration falhou

Se a migration automática falhar por causa do pgvector:

1. Aplique o SQL manualmente (sem as partes do pgvector)
2. Marque a migration como aplicada:

```bash
npx prisma migrate resolve --applied 20251230000001_add_plan_subscription_audit
```

## 📝 Checklist de Deploy

- [ ] Aplicar migration `20251230000001_add_plan_subscription_audit` no banco de dados
- [ ] Aplicar migration `20251230_add_api_events` no banco de dados (para error tracking)
- [ ] Gerar Prisma Client (`npx prisma generate`)
- [ ] Reiniciar API para carregar novos endpoints
- [ ] Promover pelo menos 1 usuário a ADMIN
- [ ] Testar acesso ao `/admin` no frontend
- [ ] Verificar KPIs e gráficos carregando
- [ ] Testar alteração de plano de usuário
- [ ] Verificar funil de ativação `/admin/activation`
- [ ] Verificar paywall analytics `/admin/monetization`
- [ ] Verificar data quality `/admin/quality`
- [ ] Verificar error analytics `/admin/errors`
- [ ] Verificar auditoria de eventos

## 🗄️ Migrations Necessárias

### 1. Plans, Subscriptions e Audit Events
```bash
psql -h <host> -U <user> -d olivebaby -f prisma/migrations/20251230000001_add_plan_subscription_audit/migration.sql
```

### 2. API Events (Error Tracking)
```bash
psql -h <host> -U <user> -d olivebaby -f prisma/migrations/20251230_add_api_events/migration.sql
```

### Via Docker (produção)
```bash
# Plans/Subscriptions/Audit
docker exec -i postgres psql -U olivebaby -d olivebaby < prisma/migrations/20251230000001_add_plan_subscription_audit/migration.sql

# API Events
docker exec -i postgres psql -U olivebaby -d olivebaby < prisma/migrations/20251230_add_api_events/migration.sql
```

---

**Data de criação:** 30/12/2025
**Última atualização:** 30/12/2025
**Versão:** 2.0.0

