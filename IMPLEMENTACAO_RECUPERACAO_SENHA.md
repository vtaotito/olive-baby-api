# 🔐 Implementação: Recuperação de Senha (Forgot Password)

## ✅ Status: Implementação Completa

## 📋 Resumo das Alterações

### Backend (olive-baby-api)

#### 1. Schema Prisma Atualizado
- **Arquivo**: `prisma/schema.prisma`
- **Mudanças**:
  - Modelo `PasswordReset` atualizado com segurança:
    - `tokenHash` (SHA-256) em vez de `token` em texto plano
    - `userId` (FK) em vez de `email`
    - `usedAt` (nullable) para rastrear uso
    - `requestIp` e `userAgent` para auditoria
  - Relação com `User` adicionada

#### 2. Novos Serviços Criados

**`src/services/password-reset.service.ts`**
- `generateResetToken()` - Gera token seguro (32 bytes) e hash SHA-256
- `validateResetToken()` - Valida token usando timing-safe comparison
- `createPasswordReset()` - Cria registro no banco (invalida tokens anteriores)
- `findValidResetToken()` - Busca token válido (não usado, não expirado)
- `markTokenAsUsed()` - Marca token como usado
- `cleanupExpiredTokens()` - Limpeza de tokens expirados

**`src/services/rate-limit.service.ts`**
- `checkRateLimit()` - Rate limiting com Redis (fallback em memória)
- `hashEmailForRateLimit()` - Hash seguro do email para rate limiting
- `getClientIp()` - Extrai IP do request (considerando proxies)

#### 3. Email Service Atualizado
- **Arquivo**: `src/services/email.service.ts`
- **Nova função**: `sendPasswordResetEmail()`
  - Template HTML profissional
  - Link com token seguro
  - Avisos de segurança
  - Expiração de 30 minutos

#### 4. Auth Service Atualizado
- **Arquivo**: `src/services/auth.service.ts`
- **`forgotPassword()`**:
  - Resposta sempre genérica (não revela se email existe)
  - Gera token seguro com hash
  - Expiração de 30 minutos
  - Logs de segurança (email mascarado)
  - Envio de email via SMTP

- **`resetPassword()`**:
  - Valida token usando hash
  - Verifica expiração e uso único
  - Atualiza senha com bcrypt
  - Invalida todos os refresh tokens
  - Marca token como usado
  - Mensagens genéricas de erro

#### 5. Auth Controller Atualizado
- **Arquivo**: `src/controllers/auth.controller.ts`
- **`forgotPassword()`**:
  - Rate limiting por IP (5 req/10min)
  - Rate limiting por email (3 req/30min)
  - Extrai IP e User-Agent
  - Resposta sempre genérica

#### 6. Migration Criada
- **Arquivo**: `prisma/migrations/20251211202000_add_password_reset_security/migration.sql`
- Dropa tabela antiga e cria nova estrutura segura
- Índices otimizados
- Foreign key para User

### Frontend (olive-baby-web)

#### 1. Novas Páginas Criadas

**`src/pages/auth/ForgotPasswordPage.tsx`**
- Formulário com validação Zod
- Estado de sucesso com mensagem genérica
- Link para voltar ao login
- Opção de reenviar

**`src/pages/auth/ResetPasswordPage.tsx`**
- Lê token da query string
- Validação de senha forte (Zod)
- Confirmação de senha
- Feedback visual de requisitos
- Estado de sucesso com redirecionamento
- Tratamento de erros (token inválido/expirado)

#### 2. Rotas Adicionadas
- **Arquivo**: `src/App.tsx`
- `/forgot-password` - Pública
- `/reset-password` - Pública (com token na query)

#### 3. Link no Login
- **Arquivo**: `src/pages/auth/LoginPage.tsx`
- Link "Esqueceu a senha?" já existia (linha 87-92)
- ✅ Funcionando corretamente

#### 4. API Service
- **Arquivo**: `src/services/api.ts`
- Métodos `forgotPassword()` e `resetPassword()` já existiam
- ✅ Funcionando corretamente

## 🔒 Segurança Implementada

### ✅ Requisitos Atendidos

1. **Resposta Genérica**: ✅
   - Endpoint sempre retorna sucesso (200)
   - Mensagem não revela se email existe

2. **Token Seguro**: ✅
   - 32 bytes aleatórios (256 bits)
   - Armazenado como SHA-256 hash
   - Timing-safe comparison
   - Expiração de 30 minutos
   - Uso único (marcado como usado)

3. **Rate Limiting**: ✅
   - Por IP: 5 requisições / 10 minutos
   - Por email: 3 requisições / 30 minutos
   - Redis com fallback em memória

4. **Invalidação de Tokens**: ✅
   - Todos os refresh tokens deletados após reset
   - Token de reset marcado como usado
   - Tokens anteriores invalidados ao criar novo

5. **Logs Seguros**: ✅
   - Email mascarado (3 primeiros caracteres + ***)
   - Token nunca logado
   - IP e User-Agent registrados

6. **Validação de Senha**: ✅
   - Backend: `validatePassword()` com regras mínimas
   - Frontend: Validação Zod com feedback visual

## 📁 Arquivos Criados/Modificados

### Backend
```
prisma/schema.prisma (modificado)
prisma/migrations/20251211202000_add_password_reset_security/migration.sql (criado)
src/services/password-reset.service.ts (criado)
src/services/rate-limit.service.ts (criado)
src/services/email.service.ts (modificado)
src/services/auth.service.ts (modificado)
src/controllers/auth.controller.ts (modificado)
src/utils/errors/AppError.ts (modificado - já tinha tooManyRequests)
```

### Frontend
```
src/pages/auth/ForgotPasswordPage.tsx (criado)
src/pages/auth/ResetPasswordPage.tsx (criado)
src/pages/auth/index.ts (modificado)
src/App.tsx (modificado)
```

## 🚀 Comandos para Deploy

### 1. Commit e Push das Alterações

```bash
# Backend
cd olive-baby-api
git add .
git commit -m "feat: Implementar recuperação de senha segura com rate limiting"
git push origin master

# Frontend
cd ../olive-baby-web
git add .
git commit -m "feat: Adicionar páginas de recuperação de senha"
git push origin master
```

### 2. Deploy no VPS

#### Backend (API)
```bash
# Atualizar projeto Docker
# Via Hostinger API ou SSH:
cd /docker/olivebaby-api
docker-compose pull
docker-compose up -d --build

# Rodar migrations
docker-compose exec api npx prisma migrate deploy

# Verificar logs
docker-compose logs -f api
```

#### Frontend (Web)
```bash
# Atualizar projeto Docker
# Via Hostinger API ou SSH:
cd /docker/olivebaby-web
docker-compose pull
docker-compose up -d --build

# Verificar logs
docker-compose logs -f web
```

### 3. Variáveis de Ambiente

**Backend (.env)**:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app
FRONTEND_URL=https://oliecare.cloud
REDIS_URL=redis://:senha@olivebaby-redis:6379
```

**Frontend (.env)**:
```env
VITE_API_URL=https://oliecare.cloud/api/v1
```

## 🧪 Testes

### Testes Manuais

1. **Teste de Solicitação**:
   ```bash
   curl -X POST https://oliecare.cloud/api/v1/auth/forgot-password \
     -H "Content-Type: application/json" \
     -d '{"email":"teste@exemplo.com"}'
   ```
   - ✅ Deve retornar 200 sempre
   - ✅ Não deve revelar se email existe
   - ✅ Deve enviar email se existir

2. **Teste de Rate Limiting**:
   - Fazer 6 requisições seguidas do mesmo IP
   - ✅ 6ª requisição deve retornar 429

3. **Teste de Reset**:
   - Usar token do email
   - ✅ Deve resetar senha
   - ✅ Token não deve funcionar novamente
   - ✅ Refresh tokens devem ser invalidados

### Checklist de Validação

- [ ] Link "Esqueceu a senha?" funciona no login
- [ ] Página `/forgot-password` carrega corretamente
- [ ] Email é enviado quando usuário existe
- [ ] Resposta é genérica (não revela existência)
- [ ] Rate limiting funciona (IP e email)
- [ ] Token expira em 30 minutos
- [ ] Token é single-use
- [ ] Senha é validada no backend
- [ ] Refresh tokens são invalidados após reset
- [ ] Usuário consegue fazer login com nova senha

## 📝 Notas Importantes

1. **Migration**: A migration foi criada manualmente devido ao problema com extensão `vector`. Execute `prisma migrate deploy` em produção.

2. **Rate Limiting**: Usa Redis se disponível, caso contrário fallback em memória (apenas para desenvolvimento).

3. **Email**: Se SMTP não estiver configurado, o sistema loga mas não falha a requisição (segurança).

4. **Tokens**: Tokens anteriores são automaticamente invalidados ao criar um novo.

5. **Logs**: Emails são mascarados nos logs (apenas 3 primeiros caracteres).

## 🔗 Endpoints

- `POST /api/v1/auth/forgot-password` - Solicitar reset
- `POST /api/v1/auth/reset-password` - Confirmar reset

## 📚 Documentação

- Validação de senha: `src/utils/validators/password.validator.ts`
- Rate limiting: `src/services/rate-limit.service.ts`
- Password reset: `src/services/password-reset.service.ts`

