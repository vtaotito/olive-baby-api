@echo off
REM Script para executar migração baby_cpf_hash via SSH
REM Requer: PuTTY (plink.exe) instalado ou acesso SSH manual

echo ========================================
echo Executando Migração baby_cpf_hash
echo ========================================
echo.

REM Verificar se plink está disponível
where plink.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Usando plink (PuTTY)...
    echo.
    
    REM Criar arquivo SQL temporário
    set TEMP_SQL=%TEMP%\migration_baby_cpf_hash.sql
    (
        echo DO $$^
        echo BEGIN^
        echo   IF NOT EXISTS ^(^
        echo     SELECT 1 FROM information_schema.columns ^
        echo     WHERE table_schema = 'public' ^
        echo     AND table_name = 'babies' ^
        echo     AND column_name = 'baby_cpf_hash'^
        echo   ^) THEN^
        echo     ALTER TABLE "babies" ^
        echo     ADD COLUMN "baby_cpf_hash" VARCHAR^(64^) NULL;^
        echo     ^
        echo     CREATE UNIQUE INDEX IF NOT EXISTS "babies_baby_cpf_hash_key" ^
        echo     ON "babies"^("baby_cpf_hash"^) ^
        echo     WHERE "baby_cpf_hash" IS NOT NULL;^
        echo     ^
        echo     RAISE NOTICE 'Coluna baby_cpf_hash adicionada com sucesso!';^
        echo   ELSE^
        echo     RAISE NOTICE 'Coluna baby_cpf_hash ja existe.';^
        echo   END IF;^
        echo END $$;
    ) > "%TEMP_SQL%"
    
    echo Arquivo SQL criado: %TEMP_SQL%
    echo.
    echo Copiando arquivo para o VPS...
    pscp.exe -pw "@VWFusca1978@" "%TEMP_SQL%" root@72.62.11.30:/tmp/migration.sql
    
    echo.
    echo Executando migração no VPS...
    plink.exe -ssh -pw "@VWFusca1978@" root@72.62.11.30 "docker exec -i olivebaby-db psql -U olivebaby -d olivebaby < /tmp/migration.sql"
    
    echo.
    echo Verificando resultado...
    plink.exe -ssh -pw "@VWFusca1978@" root@72.62.11.30 "docker exec -i olivebaby-db psql -U olivebaby -d olivebaby -c \"SELECT column_name FROM information_schema.columns WHERE table_name = 'babies' AND column_name = 'baby_cpf_hash';\""
    
    echo.
    echo Limpando arquivo temporário...
    del "%TEMP_SQL%" >nul 2>&1
    
    echo.
    echo ========================================
    echo Migração concluída!
    echo ========================================
) else (
    echo PuTTY (plink.exe) não encontrado.
    echo.
    echo Para executar manualmente:
    echo.
    echo 1. Conecte-se ao VPS:
    echo    ssh root@72.62.11.30
    echo    Senha: @VWFusca1978@
    echo.
    echo 2. Execute o comando SQL:
    echo    docker exec -i olivebaby-db psql -U olivebaby -d olivebaby ^<^< 'EOF'
    echo    DO $$
    echo    BEGIN
    echo      IF NOT EXISTS (
    echo        SELECT 1 FROM information_schema.columns 
    echo        WHERE table_schema = 'public' 
    echo        AND table_name = 'babies' 
    echo        AND column_name = 'baby_cpf_hash'
    echo      ) THEN
    echo        ALTER TABLE "babies" 
    echo        ADD COLUMN "baby_cpf_hash" VARCHAR(64) NULL;
    echo        CREATE UNIQUE INDEX IF NOT EXISTS "babies_baby_cpf_hash_key" 
    echo        ON "babies"("baby_cpf_hash") 
    echo        WHERE "baby_cpf_hash" IS NOT NULL;
    echo        RAISE NOTICE 'Coluna adicionada!';
    echo      END IF;
    echo    END $$;
    echo    EOF
    echo.
    pause
)
