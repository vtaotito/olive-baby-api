@echo off
echo ========================================
echo Executando Migracao baby_cpf_hash
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Usando plink (PuTTY)...
    echo.
    
    echo Copiando arquivo SQL para o VPS...
    pscp.exe -pw "@VWFusca1978@" "add_baby_cpf_hash_column.sql" root@72.62.11.30:/tmp/migration.sql
    
    echo.
    echo Executando migracao no VPS...
    plink.exe -ssh -pw "@VWFusca1978@" root@72.62.11.30 "docker exec -i olivebaby-db psql -U olivebaby -d olivebaby < /tmp/migration.sql"
    
    echo.
    echo Verificando resultado...
    plink.exe -ssh -pw "@VWFusca1978@" root@72.62.11.30 "docker exec -i olivebaby-db psql -U olivebaby -d olivebaby -c \"SELECT column_name FROM information_schema.columns WHERE table_name = 'babies' AND column_name = 'baby_cpf_hash';\""
    
    echo.
    echo ========================================
    echo Migracao concluida!
    echo ========================================
) else (
    echo PuTTY (plink.exe) nao encontrado.
    echo.
    echo Execute manualmente via SSH:
    echo   ssh root@72.62.11.30
    echo   Senha: @VWFusca1978@
    echo.
    echo Depois execute:
    echo   docker exec -i olivebaby-db psql -U olivebaby -d olivebaby ^< add_baby_cpf_hash_column.sql
    pause
)
