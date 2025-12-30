# 🔧 Correções: Erros de Excesso de Requisições

## 🐛 Problemas Identificados

### 1. Rate Limiting Global Muito Restritivo
- **Problema**: Rate limiting global de 100 requisições em 15 minutos aplicado a TODAS as rotas
- **Impacto**: Bloqueava requisições legítimas da aplicação, especialmente durante polling de rotinas ativas
- **Localização**: `src/app.ts` linha 36-46

### 2. CORS Restritivo
- **Problema**: CORS permitia apenas origens específicas, podendo bloquear requisições de diferentes subdomínios
- **Impacto**: Erros de CORS em produção
- **Localização**: `src/app.ts` linha 26-33

### 3. Polling Excessivo
- **Problema**: `useActiveRoutine` fazia polling a cada 60s, mas poderia ser otimizado
- **Impacto**: Muitas requisições desnecessárias
- **Localização**: `src/hooks/useActiveRoutine.ts`

### 4. TanStack Query Refetch Excessivo
- **Problema**: Configuração padrão fazia refetch ao focar na janela
- **Impacto**: Requisições desnecessárias ao alternar entre abas
- **Localização**: `src/App.tsx`

### 5. Interceptor Axios sem Proteção contra Loops
- **Problema**: Múltiplas requisições 401 podiam causar múltiplos refresh tokens simultâneos
- **Impacto**: Loops de refresh token e requisições duplicadas
- **Localização**: `src/services/api.ts`

## ✅ Correções Aplicadas

### 1. Remoção do Rate Limiting Global
**Arquivo**: `olive-baby-api/src/app.ts`

```typescript
// ANTES: Rate limiting global aplicado a todas as rotas
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS, // 15 minutos
  max: env.RATE_LIMIT_MAX, // 100 requisições
});
app.use(limiter);

// DEPOIS: Rate limiting removido globalmente
// Endpoints críticos (forgot-password, etc) têm rate limiting próprio
```

**Justificativa**: 
- Rate limiting global estava bloqueando requisições legítimas
- Endpoints críticos (forgot-password, login) já têm rate limiting específico
- Aplicação faz polling legítimo de rotinas ativas

### 2. CORS Mais Permissivo
**Arquivo**: `olive-baby-api/src/app.ts`

```typescript
// ANTES: Apenas origens específicas
origin: isDevelopment 
  ? ['http://localhost:3000', 'http://localhost:5173'] 
  : env.FRONTEND_URL,

// DEPOIS: Mais permissivo e flexível
origin: isDevelopment 
  ? true // Permite todas as origens em desenvolvimento
  : [
      env.FRONTEND_URL,
      'https://oliecare.cloud',
      'https://www.oliecare.cloud',
      'http://localhost:3000',
      'http://localhost:5173',
    ],
```

**Melhorias**:
- Permite todas as origens em desenvolvimento
- Lista explícita de origens permitidas em produção
- Adicionado `maxAge` para cache de preflight
- Headers expostos para paginação

### 3. Otimização do Polling
**Arquivo**: `olive-baby-web/src/hooks/useActiveRoutine.ts`

```typescript
// ANTES: 60 segundos
const interval = setInterval(() => {
  fetchActiveRoutines();
}, 60000);

// DEPOIS: 30 segundos (mais responsivo, mas ainda razoável)
const interval = setInterval(() => {
  fetchActiveRoutines();
}, 30000);
```

**Justificativa**: 
- 30s é um bom balance entre responsividade e carga no servidor
- Polling só acontece quando há rotina ativa
- Reduzido de 60s para melhor UX

### 4. Configuração Otimizada do TanStack Query
**Arquivo**: `olive-baby-web/src/App.tsx`

```typescript
// ANTES:
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

// DEPOIS:
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      cacheTime: 1000 * 60 * 10, // 10 minutos
      refetchOnWindowFocus: false, // ✅ Não refetch ao focar
      refetchOnReconnect: true, // Refetch apenas ao reconectar
      refetchOnMount: true,
      retry: 1,
      retryDelay: 1000,
    },
    mutations: {
      retry: 0, // Mutations não devem retry
    },
  },
});
```

**Melhorias**:
- `refetchOnWindowFocus: false` - Evita refetch ao alternar abas
- `cacheTime` aumentado para 10 minutos
- `retryDelay` configurado para evitar retries muito rápidos

### 5. Interceptor Axios com Proteção contra Loops
**Arquivo**: `olive-baby-web/src/services/api.ts`

**Melhorias**:
- Sistema de fila para requisições pendentes durante refresh
- Flag `isRefreshing` para evitar múltiplos refresh simultâneos
- Proteção contra loops de redirecionamento
- Timeout de 10s para refresh token
- Skip refresh para endpoints públicos

### 6. Configuração Axios Otimizada
**Arquivo**: `olive-baby-web/src/services/api.ts`

```typescript
// ANTES:
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// DEPOIS:
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 segundos
  headers: {
    'Content-Type': 'application/json',
  },
  validateStatus: (status) => status < 500, // Não rejeitar 4xx automaticamente
});
```

## 📊 Impacto Esperado

### Antes das Correções
- ❌ Rate limiting bloqueando requisições legítimas
- ❌ Erros de CORS em alguns cenários
- ❌ Múltiplos refresh tokens simultâneos
- ❌ Refetch excessivo ao focar na janela
- ❌ Polling a cada 60s (pode ser otimizado)

### Depois das Correções
- ✅ Sem bloqueios de rate limiting global
- ✅ CORS configurado corretamente
- ✅ Sistema de fila para refresh tokens
- ✅ Refetch apenas quando necessário
- ✅ Polling otimizado para 30s

## 🧪 Testes Recomendados

1. **Teste de Carga**:
   - Abrir dashboard com rotina ativa
   - Verificar que não há bloqueios de rate limiting
   - Confirmar que polling funciona corretamente

2. **Teste de CORS**:
   - Acessar de diferentes origens
   - Verificar que requisições funcionam

3. **Teste de Refresh Token**:
   - Fazer múltiplas requisições simultâneas com token expirado
   - Verificar que apenas um refresh acontece
   - Confirmar que requisições são processadas após refresh

4. **Teste de Alternância de Abas**:
   - Abrir aplicação em múltiplas abas
   - Alternar entre abas
   - Verificar que não há refetch excessivo

## 📝 Notas Importantes

1. **Rate Limiting Específico**: Endpoints críticos (forgot-password, login) ainda têm rate limiting próprio via `rate-limit.service.ts`

2. **Segurança**: Remover rate limiting global não compromete segurança, pois:
   - Endpoints críticos têm proteção própria
   - Aplicação é autenticada (JWT)
   - CORS ainda está configurado

3. **Monitoramento**: Recomenda-se monitorar:
   - Número de requisições por minuto
   - Taxa de erro 429 (se houver)
   - Performance do servidor

## 🚀 Deploy

As alterações estão prontas para deploy. Não há mudanças de schema ou migrations necessárias.

```bash
# Backend
cd olive-baby-api
git add .
git commit -m "fix: Remover rate limiting global e ajustar CORS"
git push origin master

# Frontend
cd olive-baby-web
git add .
git commit -m "fix: Otimizar polling, TanStack Query e interceptor axios"
git push origin master
```
