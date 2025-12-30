-- Script para verificar se as tabelas de baby sharing foram criadas
-- Execute: docker exec -it olivebaby-db psql -U olivebaby -d olivebaby -f /tmp/verificar-tabelas-baby-sharing.sql

-- Verificar se a coluna baby_cpf_hash existe na tabela babies
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'babies' 
            AND column_name = 'baby_cpf_hash'
        ) 
        THEN '✅ Coluna baby_cpf_hash existe na tabela babies'
        ELSE '❌ Coluna baby_cpf_hash NÃO existe na tabela babies'
    END AS status_baby_cpf_hash;

-- Verificar se a tabela baby_members existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'baby_members'
        ) 
        THEN '✅ Tabela baby_members existe'
        ELSE '❌ Tabela baby_members NÃO existe'
    END AS status_baby_members;

-- Verificar se a tabela baby_invites existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'baby_invites'
        ) 
        THEN '✅ Tabela baby_invites existe'
        ELSE '❌ Tabela baby_invites NÃO existe'
    END AS status_baby_invites;

-- Verificar ENUMs
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_type 
            WHERE typname = 'BabyMemberType'
        ) 
        THEN '✅ ENUM BabyMemberType existe'
        ELSE '❌ ENUM BabyMemberType NÃO existe'
    END AS status_enum_member_type;

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_type 
            WHERE typname = 'BabyMemberRole'
        ) 
        THEN '✅ ENUM BabyMemberRole existe'
        ELSE '❌ ENUM BabyMemberRole NÃO existe'
    END AS status_enum_member_role;

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_type 
            WHERE typname = 'BabyMemberStatus'
        ) 
        THEN '✅ ENUM BabyMemberStatus existe'
        ELSE '❌ ENUM BabyMemberStatus NÃO existe'
    END AS status_enum_member_status;

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_type 
            WHERE typname = 'BabyInviteStatus'
        ) 
        THEN '✅ ENUM BabyInviteStatus existe'
        ELSE '❌ ENUM BabyInviteStatus NÃO existe'
    END AS status_enum_invite_status;

-- Listar todas as colunas da tabela baby_members (se existir)
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'baby_members'
ORDER BY ordinal_position;

-- Listar todas as colunas da tabela baby_invites (se existir)
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'baby_invites'
ORDER BY ordinal_position;

-- Contar registros (se as tabelas existirem)
SELECT 
    (SELECT COUNT(*) FROM baby_members) AS total_baby_members,
    (SELECT COUNT(*) FROM baby_invites) AS total_baby_invites;
