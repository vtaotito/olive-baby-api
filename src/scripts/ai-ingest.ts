// Olive Baby API - AI Knowledge Base Ingestion Script
// Usage: npm run ai:ingest

import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment
dotenv.config();

import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { ragService } from '../services/ai/rag.service';
import { openaiService } from '../services/ai/openai.service';

// Directories to scan for documents
const DOCS_DIRECTORIES = [
  path.resolve(__dirname, '../../../docs'), // /docs folder at repo root
  path.resolve(__dirname, '../../../knowledge'), // /knowledge folder for curated content
];

// File patterns to include
const INCLUDE_PATTERNS = [
  /\.md$/i,
  /README/i,
];

// File patterns to exclude
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /CHANGELOG/i,
  /LICENSE/i,
];

interface FileInfo {
  path: string;
  relativePath: string;
  title: string;
  content: string;
  tags: string[];
}

async function findDocuments(baseDir: string): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  
  function scanDirectory(dir: string) {
    if (!fs.existsSync(dir)) {
      logger.warn(`Directory not found: ${dir}`);
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      
      // Check exclusions
      if (EXCLUDE_PATTERNS.some(p => p.test(fullPath))) {
        continue;
      }
      
      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile()) {
        // Check inclusions
        if (INCLUDE_PATTERNS.some(p => p.test(entry.name))) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            
            // Skip empty or very small files
            if (content.length < 100) {
              continue;
            }
            
            // Extract title from first heading or filename
            const titleMatch = content.match(/^#\s+(.+)$/m);
            const title = titleMatch 
              ? titleMatch[1] 
              : entry.name.replace(/\.(md|txt)$/i, '');
            
            // Extract tags from content
            const tags = extractTags(content, relativePath);
            
            files.push({
              path: fullPath,
              relativePath,
              title,
              content,
              tags,
            });
          } catch (error) {
            logger.error(`Error reading file: ${fullPath}`, error);
          }
        }
      }
    }
  }
  
  scanDirectory(baseDir);
  return files;
}

function extractTags(content: string, filePath: string): string[] {
  const tags: string[] = [];
  const lowerContent = content.toLowerCase();
  const lowerPath = filePath.toLowerCase();
  
  // Extract from file path
  if (lowerPath.includes('sono') || lowerPath.includes('sleep')) tags.push('sono');
  if (lowerPath.includes('amament') || lowerPath.includes('feeding')) tags.push('amamentacao');
  if (lowerPath.includes('aliment') || lowerPath.includes('food')) tags.push('alimentacao');
  if (lowerPath.includes('fralda') || lowerPath.includes('diaper')) tags.push('fralda');
  if (lowerPath.includes('desenvolv') || lowerPath.includes('milestone')) tags.push('desenvolvimento');
  
  // Extract from content keywords
  const tagKeywords: Record<string, string[]> = {
    sono: ['sono', 'dormir', 'soneca', 'noite', 'acordar', 'regressão'],
    amamentacao: ['amamentação', 'mamar', 'peito', 'mama', 'leite materno', 'livre demanda'],
    alimentacao: ['alimentação', 'comida', 'papinha', 'introdução alimentar', 'blw'],
    fralda: ['fralda', 'xixi', 'cocô', 'evacuação'],
    desenvolvimento: ['desenvolvimento', 'marco', 'milestone', 'motor', 'cognitivo'],
    saude: ['saúde', 'febre', 'vacina', 'pediatra', 'doença'],
    rotina: ['rotina', 'horário', 'schedule'],
    colica: ['cólica', 'gases', 'desconforto'],
    choro: ['choro', 'chorando', 'inconsolável'],
  };
  
  for (const [tag, keywords] of Object.entries(tagKeywords)) {
    if (!tags.includes(tag) && keywords.some(kw => lowerContent.includes(kw))) {
      tags.push(tag);
    }
  }
  
  return [...new Set(tags)]; // Remove duplicates
}

async function main() {
  console.log('🤖 Olive Baby - AI Knowledge Base Ingestion');
  console.log('==========================================\n');
  
  // Check OpenAI configuration
  if (!openaiService.isConfigured()) {
    console.error('❌ OPENAI_API_KEY not configured. Please set it in your .env file.');
    process.exit(1);
  }
  
  // Connect to database
  try {
    await prisma.$connect();
    console.log('✅ Database connected\n');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
  
  // Find documents
  console.log('📁 Scanning directories for documents...\n');
  
  const allFiles: FileInfo[] = [];
  
  for (const dir of DOCS_DIRECTORIES) {
    console.log(`   Scanning: ${dir}`);
    const files = await findDocuments(dir);
    allFiles.push(...files);
  }
  
  // Also scan for built-in knowledge (if exists)
  const knowledgeDir = path.resolve(__dirname, '../../../knowledge');
  if (fs.existsSync(knowledgeDir)) {
    console.log(`   Scanning: ${knowledgeDir}`);
    const files = await findDocuments(knowledgeDir);
    allFiles.push(...files);
  }
  
  console.log(`\n📄 Found ${allFiles.length} documents to process\n`);
  
  if (allFiles.length === 0) {
    console.log('⚠️ No documents found. Create some .md files in the docs/ or knowledge/ folders.');
    await prisma.$disconnect();
    return;
  }
  
  // Process each file
  let processed = 0;
  let errors = 0;
  
  for (const file of allFiles) {
    console.log(`📝 Processing: ${file.relativePath}`);
    console.log(`   Title: ${file.title}`);
    console.log(`   Tags: ${file.tags.join(', ') || 'none'}`);
    console.log(`   Size: ${file.content.length} chars`);
    
    try {
      await ragService.ingestDocument({
        sourcePath: file.relativePath,
        title: file.title,
        content: file.content,
        tags: file.tags,
        metadata: {
          originalPath: file.path,
          ingestedAt: new Date().toISOString(),
        },
      });
      processed++;
      console.log(`   ✅ Ingested successfully\n`);
    } catch (error) {
      errors++;
      console.error(`   ❌ Error:`, error);
      console.log();
    }
  }
  
  // Summary
  console.log('==========================================');
  console.log(`✅ Processed: ${processed} documents`);
  if (errors > 0) {
    console.log(`❌ Errors: ${errors} documents`);
  }
  
  // Show stats
  const docCount = await prisma.aiDocument.count();
  const chunkCount = await prisma.aiChunk.count();
  console.log(`\n📊 Knowledge Base Stats:`);
  console.log(`   Documents: ${docCount}`);
  console.log(`   Chunks: ${chunkCount}`);
  
  await prisma.$disconnect();
  console.log('\n🎉 Done!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
