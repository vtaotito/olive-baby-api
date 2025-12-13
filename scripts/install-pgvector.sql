-- Script para instalar pgvector manualmente no PostgreSQL
-- Execute este script como superusuário no container PostgreSQL

-- Instalar pgvector (requer privilégios de superusuário)
-- No container: docker exec -it olivebaby-db psql -U olivebaby -d olivebaby -f /tmp/install-pgvector.sql

-- Verificar se já está instalado
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        -- Tentar criar a extensão
        CREATE EXTENSION IF NOT EXISTS vector;
        RAISE NOTICE 'Extensão pgvector instalada com sucesso!';
    ELSE
        RAISE NOTICE 'Extensão pgvector já está instalada.';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Erro ao instalar pgvector: %', SQLERRM;
        RAISE WARNING 'Certifique-se de que a imagem PostgreSQL tem pgvector instalado.';
        RAISE WARNING 'Use a imagem: pgvector/pgvector:pg16';
END $$;

-- Verificar instalação
SELECT extname, extversion 
FROM pg_extension 
WHERE extname = 'vector';
