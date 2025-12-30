/**
 * Script para aplicar migration de password reset manualmente
 * Uso: npx ts-node src/scripts/apply-password-reset-migration.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🔧 Aplicando migration de password reset...\n');

    // Ler arquivo SQL
    const sqlFilePath = path.join(__dirname, '../../apply_password_reset_migration.sql');
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
      await prisma.$executeRawUnsafe(command);
    }

    console.log('\n✅ Migration aplicada com sucesso!');

    // Verificar estrutura da tabela
    console.log('\n📊 Verificando estrutura da tabela...');
    const tableInfo = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'password_resets'
      ORDER BY ordinal_position;
    `);
    console.table(tableInfo);

    // Verificar índices
    console.log('\n📊 Verificando índices...');
    const indexes = await prisma.$queryRawUnsafe(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'password_resets';
    `);
    console.table(indexes);

    // Verificar foreign keys
    console.log('\n📊 Verificando foreign keys...');
    const foreignKeys = await prisma.$queryRawUnsafe(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
      WHERE constraint_type = 'FOREIGN KEY' 
        AND tc.table_name='password_resets';
    `);
    console.table(foreignKeys);

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

