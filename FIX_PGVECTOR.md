# 🔧 Correção: Instalar pgvector no PostgreSQL

## Problema
A migration `20251213000001_add_ai_assistant` está falhando porque a extensão `pgvector` não está disponível no PostgreSQL.

**Erro:**
```
ERROR: extension "vector" is not available
DETAIL: Could not open extension control file "/usr/local/share/postgresql/extension/vector.control": No such file or directory.
```

## Solução

### Opção 1: Atualizar imagem do PostgreSQL (Recomendado)

O projeto `olivebaby-infra` precisa usar a imagem `pgvector/pgvector:pg16` em vez de `postgres:16-alpine`.

**Passos:**

1. Acesse o projeto `olivebaby-infra` no Hostinger VPS
2. Atualize o `docker-compose.yml` para usar:
   ```yaml
   postgres:
     image: pgvector/pgvector:pg16  # Em vez de postgres:16-alpine
   ```
3. Recrie o container:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

**⚠️ IMPORTANTE:** Os dados serão preservados porque o volume `postgres_data` está configurado.

### Opção 2: Instalar pgvector manualmente (Temporário)

Se não puder atualizar a imagem agora, você pode instalar pgvector manualmente:

```bash
# Conectar ao container PostgreSQL
docker exec -it olivebaby-db bash

# Instalar dependências (se necessário)
apk add --no-cache build-base git postgresql-dev

# Baixar e compilar pgvector
cd /tmp
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
make install

# Criar extensão no banco
psql -U olivebaby -d olivebaby -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Opção 3: Executar migration manualmente

Após instalar pgvector, execute a migration:

```bash
# No container da API
docker exec -it olivebaby-api npx prisma migrate deploy
```

## Verificação

Após aplicar a solução, verifique se pgvector está instalado:

```sql
-- Conectar ao banco
docker exec -it olivebaby-db psql -U olivebaby -d olivebaby

-- Verificar extensão
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
```

Deve retornar:
```
 extname | extversion 
---------+------------
 vector  | 0.5.1
```

## Status Atual

- ✅ Código atualizado no repositório
- ✅ Migration criada
- ⚠️ PostgreSQL precisa ser atualizado para incluir pgvector
- ⚠️ Migration aguardando instalação de pgvector
