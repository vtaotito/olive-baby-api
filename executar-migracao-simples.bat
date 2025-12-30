@echo off
echo ========================================
echo Executando Migracao baby_cpf_hash
echo ========================================
echo.

REM Verificar se plink esta disponivel
where plink.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Usando plink (PuTTY)...
    echo.
    
    REM Criar arquivo SQL temporario
    set TEMP_SQL=%TEMP%\migration.sql
    echo DO $$ > "%TEMP_SQL%"
    echo BEGIN >> "%TEMP_SQL%"
    echo   IF NOT EXISTS ( >> "%TEMP_SQL%"
    echo     SELECT 1 FROM information_schema.columns >> "%TEMP_SQL%"
    echo     WHERE table_schema = 'public' >> "%TEMP_SQL%"
    echo     AND table_name = 'babies' >> "%TEMP_SQL%"
    echo     AND column_name = 'baby_cpf_hash' >> "%TEMP_SQL%"
    echo   ) THEN >> "%TEMP_SQL%"
    echo     ALTER TABLE "babies" >> "%TEMP_SQL%"
    echo     ADD COLUMN "baby_cpf_hash" VARCHAR(64) NULL; >> "%TEMP_SQL%"
    echo     CREATE UNIQUE INDEX IF NOT EXISTS "babies_baby_cpf_hash_key" >> "%TEMP_SQL%"
    echo     ON "babies"("baby_cpf_hash") >> "%TEMP_SQL%"
    echo     WHERE "baby_cpf_hash" IS NOT NULL; >> "%TEMP_SQL%"
    echo     RAISE NOTICE 'Coluna adicionada!'; >> "%TEMP_SQL%"
    echo   END IF; >> "%TEMP_SQL%"
    echo END $$; >> "%TEMP_SQL%"
    
    echo Copiando arquivo SQL para o VPS...
    pscp.exe -pw "@VWFusca1978@" "%TEMP_SQL%" root@72.62.11.30:/tmp/migration.sql
    
    echo Executando migracao no VPS...
    plink.exe -ssh -pw "@VWFusca1978@" root@72.62.11.30 "docker exec -i olivebaby-db psql -U olivebaby -d olivebaby < /tmp/migration.sql"
    
    echo.
    echo Verificando resultado...
    plink.exe -ssh -pw "@VWFusca1978@" root@72.62.11.30 "docker exec -i olivebaby-db psql -U olivebaby -d olivebaby -c \"SELECT column_name FROM information_schema.columns WHERE table_name = 'babies' AND column_name = 'baby_cpf_hash';\""
    
    del "%TEMP_SQL%" >nul 2>&1
    echo.
    echo Migracao concluida!
) else (
    echo PuTTY (plink.exe) nao encontrado.
    echo.
    echo Execute manualmente via SSH:
    echo   ssh root@72.62.11.30
    echo   Senha: @VWFusca1978@
    echo.
    echo Depois execute o SQL do arquivo: add_baby_cpf_hash_column.sql
    pause
)
