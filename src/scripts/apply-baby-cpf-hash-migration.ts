/**
 * Script para aplicar migration de baby_cpf_hash manualmente
 * Uso: npx ts-node src/scripts/apply-baby-cpf-hash-migration.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🔧 Aplicando migration de baby_cpf_hash...\n');

    // Ler arquivo SQL
    const sqlFilePath = path.join(__dirname, '../../add_baby_cpf_hash_column.sql');
    let sql = fs.readFileSync(sqlFilePath, 'utf-8');

    // Remover comentários de linha (-- comentário)
    sql = sql.replace(/--.*$/gm, '');

    // Dividir em comandos, preservando blocos DO $$
    const commands: string[] = [];
    let currentCommand = '';
    let inDoBlock = false;

    const lines = sql.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('DO $$')) {
        inDoBlock = true;
        currentCommand = trimmed;
      } else if (inDoBlock) {
        currentCommand += '\n' + line;
        if (trimmed.endsWith('END $$;')) {
          commands.push(currentCommand);
          currentCommand = '';
          inDoBlock = false;
        }
      } else if (trimmed && !trimmed.startsWith('--')) {
        currentCommand += (currentCommand ? '\n' : '') + line;
        if (trimmed.endsWith(';')) {
          commands.push(currentCommand.trim());
          currentCommand = '';
        }
      }
    }

    // Adicionar último comando se houver
    if (currentCommand.trim()) {
      commands.push(currentCommand.trim());
    }

    // Filtrar comandos vazios
    const validCommands = commands.filter(cmd => cmd.length > 0);

    console.log(`Executando ${validCommands.length} comandos SQL...\n`);

    // Executar cada comando
    for (let i = 0; i < validCommands.length; i++) {
      const command = validCommands[i];
      console.log(`[${i + 1}/${validCommands.length}] Executando comando...`);
      try {
        await prisma.$executeRawUnsafe(command);
        console.log(`✅ Comando ${i + 1} executado com sucesso`);
      } catch (error: any) {
        // Ignorar erros de "já existe" ou "não existe"
        if (error.message?.includes('already exists') || 
            error.message?.includes('does not exist') ||
            error.message?.includes('duplicate')) {
          console.log(`⚠️  Comando ${i + 1}: ${error.message}`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✅ Migration aplicada com sucesso!');

    // Verificar estrutura da tabela
    console.log('\n📊 Verificando estrutura da coluna baby_cpf_hash...');
    const columnInfo = await prisma.$queryRawUnsafe(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'babies'
        AND column_name = 'baby_cpf_hash';
    `);
    console.table(columnInfo);

    // Verificar índices
    console.log('\n📊 Verificando índices...');
    const indexes = await prisma.$queryRawUnsafe(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'babies'
        AND indexname LIKE '%baby_cpf_hash%';
    `);
    console.table(indexes);

  } catch (error) {
    console.error('\n❌ Erro ao aplicar migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar script
applyMigration()
  .then(() => {
    console.log('\n✨ Processo concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Falha ao aplicar migration:', error);
    process.exit(1);
  });
