# 🌿 Olive Baby API

API REST para o sistema Olive Baby Tracker - Acompanhamento do desenvolvimento de bebês.

## 🚀 Tecnologias

- **Node.js** 20+
- **TypeScript** 5.x
- **Express** 4.x
- **Prisma ORM** 5.x
- **PostgreSQL** 16
- **Redis** 7
- **JWT** para autenticação

## 📋 Funcionalidades

- ✅ Autenticação (registro, login, JWT, refresh token)
- ✅ Gestão de cuidadores e bebês
- ✅ Registro de rotinas (alimentação, sono, fraldas, banho, extração)
- ✅ Acompanhamento de crescimento
- ✅ Marcos do desenvolvimento
- ✅ Estatísticas e relatórios
- ✅ Exportação CSV
- ✅ Sistema de convite de profissionais

## 🛠️ Instalação

```bash
# Clonar repositório
git clone https://github.com/SEU_USUARIO/olive-baby-api.git
cd olive-baby-api

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas configurações

# Gerar Prisma Client
npx prisma generate

# Executar migrations
npx prisma migrate deploy

# Iniciar em desenvolvimento
npm run dev

# Build para produção
npm run build
npm start
```

## 📝 Variáveis de Ambiente

```env
# Server
NODE_ENV=development
PORT=4000
API_PREFIX=/api/v1

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/olivebaby

# Redis
REDIS_URL=redis://:password@localhost:6379

# JWT
JWT_ACCESS_SECRET=your-access-secret-32-chars-min
JWT_REFRESH_SECRET=your-refresh-secret-32-chars-min
JWT_ACCESS_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-app-password

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

## 🐳 Docker

```bash
# Build e executar com Docker Compose
docker-compose up -d

# Apenas build
docker build -t olive-baby-api .
```

## 📡 Endpoints Principais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/v1/auth/register` | Registro |
| POST | `/api/v1/auth/login` | Login |
| GET | `/api/v1/babies` | Listar bebês |
| POST | `/api/v1/babies/:id/routines` | Criar rotina |
| GET | `/api/v1/babies/:id/stats` | Estatísticas |
| GET | `/api/v1/export/:id/routines` | Exportar CSV |

## 📄 Licença

MIT © Olive Baby Team
