# 🚀 Aplicar Migrations - User Settings

## Resumo das Alterações

Esta migration adiciona suporte para:
- **Configurações de Notificações**: push, email, som, horário de silêncio
- **Configurações de Aparência**: tema (claro/escuro/sistema), idioma
- **Notificações de Rotinas**: configurações individuais por tipo de rotina

## Novos Endpoints da API

### GET /api/v1/settings
Retorna todas as configurações do usuário logado.

### PUT /api/v1/settings/notifications
Atualiza configurações de notificações.

```json
{
  "pushEnabled": true,
  "emailEnabled": false,
  "soundEnabled": true,
  "quietHoursEnabled": true,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "07:00",
  "routineNotifications": {
    "feeding": true,
    "sleep": true,
    "diaper": false,
    "bath": true,
    "extraction": false
  }
}
```

### PUT /api/v1/settings/appearance
Atualiza configurações de aparência.

```json
{
  "theme": "system", // "light" | "dark" | "system"
  "language": "pt-BR"
}
```

### POST /api/v1/auth/change-password
Altera a senha do usuário (requer autenticação).

```json
{
  "currentPassword": "senhaAtual123",
  "newPassword": "novaSenha123"
}
```

### DELETE /api/v1/auth/account
Exclui a conta do usuário (requer autenticação).

```json
{
  "password": "suaSenha123"
}
```

---

## 📋 Passos para Aplicar

### Opção 1: Via Prisma (Recomendado para Desenvolvimento)

```bash
cd olive-baby-api

# Gerar migration do Prisma
npx prisma migrate dev --name add_user_settings

# Gerar client
npx prisma generate
```

### Opção 2: Via SQL Direto (Para Produção)

```bash
# Conectar ao banco de dados
psql -U seu_usuario -d olive_baby

# Executar o script SQL
\i prisma/migrations/manual/create_user_settings.sql

# Depois, sincronizar o Prisma client
npx prisma generate
```

---

## ✅ Verificação

Após aplicar a migration, verifique se a tabela foi criada:

```sql
SELECT * FROM information_schema.tables WHERE table_name = 'user_settings';
```

E teste os endpoints:

```bash
# Buscar configurações
curl -X GET http://localhost:4000/api/v1/settings \
  -H "Authorization: Bearer SEU_TOKEN"

# Atualizar notificações
curl -X PUT http://localhost:4000/api/v1/settings/notifications \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pushEnabled": true, "emailEnabled": false}'
```

---

## 📁 Arquivos Modificados/Criados

### Backend (olive-baby-api)
- `prisma/schema.prisma` - Adicionado modelo UserSettings
- `src/controllers/auth.controller.ts` - Novos métodos changePassword, deleteAccount
- `src/services/auth.service.ts` - Implementação de changePassword, deleteAccount
- `src/routes/auth.routes.ts` - Novas rotas /change-password e /account
- `src/controllers/settings.controller.ts` - NOVO
- `src/services/settings.service.ts` - NOVO
- `src/routes/settings.routes.ts` - NOVO
- `src/routes/index.ts` - Registrado settingsRoutes

### Frontend (olive-baby-web)
- `src/services/api.ts` - Adicionado authService.changePassword, deleteAccount, settingsService
- `src/pages/settings/ProfilePage.tsx` - Integração com API (alteração de senha, exclusão de conta)
- `src/pages/settings/NotificationsPage.tsx` - Integração com API
- `src/pages/settings/PrivacyPage.tsx` - NOVO
- `src/pages/settings/AppearancePage.tsx` - NOVO
- `src/pages/settings/HelpPage.tsx` - NOVO
- `src/pages/settings/index.ts` - Exportação das novas páginas
- `src/App.tsx` - Rotas das novas páginas

