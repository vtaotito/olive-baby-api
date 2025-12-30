# Guia de Teste - Sistema de Compartilhamento de Bebês

## Pré-requisitos

1. API rodando na porta 4000 (ou configurada no `.env`)
2. Banco de dados configurado e migrations aplicadas
3. Usuário de teste criado ou capacidade de criar um

## Endpoints Implementados

### 1. Criar Bebê com CPF
**POST** `/api/v1/babies`

```json
{
  "name": "João Silva",
  "birthDate": "2024-01-15T00:00:00Z",
  "city": "São Paulo",
  "state": "SP",
  "country": "BR",
  "birthWeightGrams": 3200,
  "birthLengthCm": 50,
  "relationship": "MOTHER",
  "babyCpf": "12345678901"
}
```

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Resposta esperada:**
- Status: 201
- Bebê criado com `babyCpfHash` calculado
- Vínculo `BabyMember` criado automaticamente como `OWNER_PARENT_1`

---

### 2. Listar Membros do Bebê
**GET** `/api/v1/babies/:babyId/members`

**Headers:**
```
Authorization: Bearer {token}
```

**Resposta esperada:**
- Status: 200
- Lista de membros com roles e status

---

### 3. Criar Convite
**POST** `/api/v1/babies/:babyId/invites`

```json
{
  "emailInvited": "pai@example.com",
  "memberType": "PARENT",
  "role": "OWNER_PARENT_2",
  "invitedName": "Nome do Pai",
  "message": "Convite para acompanhar nosso bebê!",
  "expiresInHours": 72
}
```

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Resposta esperada:**
- Status: 201
- Convite criado
- Email enviado (se SMTP configurado)

**Validações:**
- Apenas owners podem criar convites
- Máximo 2 owners por bebê
- Não pode criar convite duplicado pendente

---

### 4. Listar Convites
**GET** `/api/v1/babies/:babyId/invites`

**Headers:**
```
Authorization: Bearer {token}
```

**Resposta esperada:**
- Status: 200
- Lista de convites com status e datas

---

### 5. Verificar Token de Convite (Público)
**POST** `/api/v1/invites/verify-token`

```json
{
  "token": "token_do_email"
}
```

**Resposta esperada:**
- Status: 200
- Dados do convite e do bebê

**Validações:**
- Token válido e não expirado
- Status deve ser PENDING

---

### 6. Aceitar Convite
**POST** `/api/v1/invites/accept`

```json
{
  "token": "token_do_email"
}
```

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Resposta esperada:**
- Status: 200
- Vínculo `BabyMember` criado

**Validações:**
- Email do usuário deve corresponder ao convite
- Token válido e não expirado
- Não pode aceitar se já está vinculado

---

### 7. Reenviar Convite
**POST** `/api/v1/babies/:babyId/invites/:inviteId/resend`

**Headers:**
```
Authorization: Bearer {token}
```

**Resposta esperada:**
- Status: 200
- Novo token gerado e email enviado

---

### 8. Revogar Convite
**DELETE** `/api/v1/babies/:babyId/invites/:inviteId`

**Headers:**
```
Authorization: Bearer {token}
```

**Resposta esperada:**
- Status: 200
- Convite marcado como REVOKED

---

### 9. Atualizar Membro
**PATCH** `/api/v1/babies/:babyId/members/:memberId`

```json
{
  "role": "FAMILY_EDITOR",
  "permissions": {
    "canViewGrowth": true,
    "canEditRoutines": true,
    "canExport": false
  }
}
```

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Resposta esperada:**
- Status: 200
- Membro atualizado

---

### 10. Revogar Acesso de Membro
**DELETE** `/api/v1/babies/:babyId/members/:memberId`

**Headers:**
```
Authorization: Bearer {token}
```

**Resposta esperada:**
- Status: 200
- Membro marcado como REVOKED

**Validações:**
- Não pode revogar o único owner
- Não pode revogar a si mesmo se for o único owner

---

## Fluxo de Teste Completo

### Cenário 1: Pai e Mãe compartilhando bebê

1. **Mãe cria conta e bebê**
   - POST `/auth/register` (mãe)
   - POST `/auth/login` (mãe)
   - POST `/babies` com CPF do bebê
   - ✅ Mãe vira `OWNER_PARENT_1` automaticamente

2. **Mãe convida pai**
   - POST `/babies/:babyId/invites` com email do pai
   - ✅ Email enviado com token

3. **Pai recebe email e aceita**
   - POST `/auth/register` (pai, se não tiver conta)
   - POST `/auth/login` (pai)
   - POST `/invites/verify-token` (verificar token)
   - POST `/invites/accept` (aceitar convite)
   - ✅ Pai vira `OWNER_PARENT_2`

4. **Verificar membros**
   - GET `/babies/:babyId/members`
   - ✅ Deve mostrar mãe e pai como owners

### Cenário 2: Convidar familiar

1. **Owner convida avó**
   - POST `/babies/:babyId/invites`
   ```json
   {
     "emailInvited": "avo@example.com",
     "memberType": "FAMILY",
     "role": "FAMILY_VIEWER"
   }
   ```

2. **Avó aceita convite**
   - POST `/invites/accept` com token

3. **Verificar acesso limitado**
   - Avó pode ver dados mas não pode editar (dependendo das permissões)

### Cenário 3: Convidar profissional

1. **Owner convida pediatra**
   - POST `/babies/:babyId/invites`
   ```json
   {
     "emailInvited": "pediatra@example.com",
     "memberType": "PROFESSIONAL",
     "role": "PEDIATRICIAN"
   }
   ```

---

## Testes de Validação

### Teste 1: CPF Duplicado
- Tentar criar segundo bebê com mesmo CPF
- ✅ Deve retornar erro 409 (Conflict)

### Teste 2: Limite de Owners
- Tentar convidar terceiro owner
- ✅ Deve retornar erro 409 (Conflict)

### Teste 3: Permissões
- Tentar criar convite sem ser owner
- ✅ Deve retornar erro 403 (Forbidden)

### Teste 4: Token Expirado
- Aguardar 72 horas ou alterar `expiresAt` no banco
- Tentar aceitar convite
- ✅ Deve retornar erro 400 (Bad Request)

### Teste 5: Email Inválido
- Tentar aceitar convite com email diferente
- ✅ Deve retornar erro 403 (Forbidden)

---

## Script de Teste Automatizado

Execute o script `test-baby-sharing.js` quando a API estiver rodando:

```bash
# Iniciar API em outro terminal
npm run dev

# Em outro terminal, executar testes
node test-baby-sharing.js
```

Ou configure a URL da API:
```bash
API_URL=http://localhost:4000/api/v1 node test-baby-sharing.js
```

---

## Verificação no Banco de Dados

### Verificar CPF Hash
```sql
SELECT id, name, baby_cpf_hash 
FROM babies 
WHERE baby_cpf_hash IS NOT NULL;
```

### Verificar Membros
```sql
SELECT 
  bm.id,
  b.name as baby_name,
  u.email,
  bm.role,
  bm.status
FROM baby_members bm
JOIN babies b ON b.id = bm.baby_id
JOIN users u ON u.id = bm.user_id;
```

### Verificar Convites
```sql
SELECT 
  bi.id,
  b.name as baby_name,
  bi.email_invited,
  bi.role,
  bi.status,
  bi.expires_at,
  bi.created_at
FROM baby_invites bi
JOIN babies b ON b.id = bi.baby_id
ORDER BY bi.created_at DESC;
```

### Obter Token de Convite (para testes)
```sql
-- Isso não funciona porque o token é hashado
-- Mas você pode criar um convite de teste e verificar o hash
SELECT 
  id,
  email_invited,
  token_hash,
  expires_at,
  status
FROM baby_invites
WHERE status = 'PENDING'
ORDER BY created_at DESC
LIMIT 1;
```

---

## Troubleshooting

### Erro: "Token de convite inválido"
- Verificar se o token está correto
- Verificar se não expirou
- Verificar se o status é PENDING

### Erro: "Já existem 2 responsáveis principais"
- Verificar quantos owners ativos existem
- Revogar um owner antes de adicionar outro

### Erro: "CPF já cadastrado"
- Verificar se já existe bebê com mesmo CPF hash
- O CPF é hashado, então mesmo CPF gera mesmo hash

### Email não enviado
- Verificar configuração SMTP no `.env`
- Verificar logs do servidor
- O convite é criado mesmo se email falhar

---

## Próximos Passos

1. ✅ Migration aplicada
2. ✅ Cliente Prisma gerado
3. ✅ CPF_SALT configurado
4. ⏳ Testar endpoints (este guia)
5. ⏳ Implementar UI no frontend
6. ⏳ Adicionar testes unitários
7. ⏳ Adicionar testes de integração
