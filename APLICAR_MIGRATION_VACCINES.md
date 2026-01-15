# Aplicar Migração de Vacinas

## Pré-requisitos

1. Backend está rodando ou com acesso ao banco de dados
2. Prisma CLI instalado

## Passos para Aplicar

### 1. Gerar o cliente Prisma

```bash
npm run prisma:generate
```

### 2. Aplicar a migração

```bash
npm run prisma:migrate:deploy
```

Ou, se estiver em desenvolvimento:

```bash
npm run prisma:migrate
```

### 3. Atualizar os planos com a feature vaccines

Execute o script SQL no banco de dados:

```bash
psql -d olive_baby_db -f scripts/update-plans-vaccines.sql
```

Ou via Prisma Studio ou outro cliente SQL:

```sql
-- Atualizar plano FREE para incluir vaccines: false
UPDATE plans
SET features = jsonb_set(features::jsonb, '{vaccines}', 'false'::jsonb)
WHERE type = 'FREE' AND NOT (features::jsonb ? 'vaccines');

-- Atualizar plano PREMIUM para incluir vaccines: true
UPDATE plans
SET features = jsonb_set(features::jsonb, '{vaccines}', 'true'::jsonb)
WHERE type = 'PREMIUM' AND NOT (features::jsonb ? 'vaccines');
```

### 4. Popular o calendário de vacinas PNI

```bash
npm run seed:vaccines
```

## Verificação

### Verificar se as tabelas foram criadas:

```sql
SELECT * FROM vaccine_definitions LIMIT 5;
SELECT * FROM baby_vaccine_records LIMIT 5;
```

### Verificar se os planos foram atualizados:

```sql
SELECT name, type, features->'vaccines' as vaccines_feature FROM plans;
```

## Em caso de erro

### Rollback da migração:

```bash
npx prisma migrate resolve --rolled-back 20260115_add_vaccines
```

### Limpar e recriar:

```bash
npx prisma migrate reset --force
```

**ATENÇÃO**: Este comando apaga todos os dados do banco!

## Logs

Após aplicar, teste os endpoints:

```bash
# Testar listagem de calendários (não requer premium)
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:4000/api/v1/vaccines/calendars

# Testar sincronização de vacinas (requer premium)
curl -X POST -H "Authorization: Bearer <TOKEN>" \
  http://localhost:4000/api/v1/babies/1/vaccines/sync
```
