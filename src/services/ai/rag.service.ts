// Olive Baby API - RAG Service (Retrieval-Augmented Generation)
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { openaiService } from './openai.service';
import { AiCitation, AiChunkMetadata } from '../../types';

interface ChunkResult {
  id: number;
  documentId: number;
  content: string;
  metadata: AiChunkMetadata;
  similarity: number;
  documentSource: string;
  documentTitle: string;
}

interface IngestOptions {
  sourcePath: string;
  title: string;
  content: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export class RAGService {
  private chunkSize = 1000; // ~250 tokens
  private chunkOverlap = 150;

  /**
   * Busca chunks relevantes para uma query
   */
  async searchChunks(
    query: string,
    topK: number = env.AI_RAG_TOP_K,
    filterTags?: string[]
  ): Promise<ChunkResult[]> {
    try {
      // Generate embedding for query
      const { embedding } = await openaiService.createEmbedding(query);
      const embeddingStr = `[${embedding.join(',')}]`;

      // Build query with optional tag filter
      let queryStr = `
        SELECT 
          c.id,
          c.document_id as "documentId",
          c.content,
          c.metadata,
          d.source as "documentSource",
          d.title as "documentTitle",
          1 - (c.embedding <=> $1::vector) as similarity
        FROM ai_chunks c
        JOIN ai_documents d ON c.document_id = d.id
        WHERE c.embedding IS NOT NULL
      `;

      const params: any[] = [embeddingStr];

      if (filterTags && filterTags.length > 0) {
        queryStr += ` AND d.tags && $2::text[]`;
        params.push(filterTags);
      }

      queryStr += ` ORDER BY c.embedding <=> $1::vector LIMIT $${params.length + 1}`;
      params.push(topK);

      // Execute query
      const results = await prisma.$queryRawUnsafe<ChunkResult[]>(queryStr, ...params);

      return results;
    } catch (error) {
      logger.error('RAG search error:', error);
      return [];
    }
  }

  /**
   * Formata chunks para contexto do LLM
   */
  formatChunksForContext(chunks: ChunkResult[]): string[] {
    return chunks.map(chunk => {
      const meta = chunk.metadata as AiChunkMetadata;
      let formatted = '';
      
      if (meta?.headings?.length) {
        formatted += `### ${meta.headings.join(' > ')}\n`;
      }
      
      formatted += chunk.content;
      
      if (meta?.topic) {
        formatted += `\n[Tópico: ${meta.topic}]`;
      }
      
      return formatted;
    });
  }

  /**
   * Extrai citações dos chunks usados
   */
  extractCitations(chunks: ChunkResult[]): AiCitation[] {
    return chunks.map(chunk => ({
      source: chunk.documentSource,
      title: chunk.documentTitle,
      content: chunk.content.substring(0, 200) + '...',
      similarity: chunk.similarity,
    }));
  }

  /**
   * Ingere um documento na base de conhecimento
   */
  async ingestDocument(options: IngestOptions): Promise<number> {
    const { sourcePath, title, content, tags = [], metadata = {} } = options;

    try {
      // Check if document already exists
      const existing = await prisma.aiDocument.findFirst({
        where: { source: sourcePath },
      });

      // Generate content hash
      const contentHash = await this.hashContent(content);

      let documentId: number;

      if (existing) {
        // Update if content changed
        if (existing.contentHash !== contentHash) {
          // Delete old chunks
          await prisma.aiChunk.deleteMany({
            where: { documentId: existing.id },
          });

          await prisma.aiDocument.update({
            where: { id: existing.id },
            data: {
              title,
              tags,
              metadata: metadata as any,
              contentHash,
              updatedAt: new Date(),
            },
          });

          documentId = existing.id;
          logger.info(`📄 Document updated: ${title}`);
        } else {
          logger.info(`⏭️ Document unchanged: ${title}`);
          return existing.id;
        }
      } else {
        // Create new document
        const doc = await prisma.aiDocument.create({
          data: {
            source: sourcePath,
            title,
            tags,
            metadata: metadata as any,
            contentHash,
          },
        });
        documentId = doc.id;
        logger.info(`📄 Document created: ${title}`);
      }

      // Chunk the content
      const chunks = this.chunkContent(content, sourcePath);
      logger.info(`🔪 Created ${chunks.length} chunks`);

      // Generate embeddings in batches
      const batchSize = 20;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const texts = batch.map(c => c.content);
        
        const embeddings = await openaiService.createEmbeddings(texts);

          // Insert chunks with embeddings
          for (let j = 0; j < batch.length; j++) {
            const chunk = batch[j];
            const embedding = embeddings[j];
            const embeddingStr = `[${embedding.join(',')}]`;

            await prisma.$executeRawUnsafe(
              `INSERT INTO ai_chunks (document_id, chunk_index, content, embedding, metadata)
               VALUES ($1, $2, $3, $4::vector, $5::jsonb)`,
              documentId,
              chunk.index,
              chunk.content,
              embeddingStr,
              JSON.stringify(chunk.metadata)
            );
          }

        logger.info(`✅ Embedded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
      }

      return documentId;
    } catch (error) {
      logger.error('Document ingestion error:', error);
      throw error;
    }
  }

  /**
   * Divide conteúdo em chunks com overlap
   */
  private chunkContent(
    content: string,
    sourcePath: string
  ): { index: number; content: string; metadata: AiChunkMetadata }[] {
    const chunks: { index: number; content: string; metadata: AiChunkMetadata }[] = [];
    
    // Parse headings from markdown
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings: { level: number; text: string; position: number }[] = [];
    let match;
    
    while ((match = headingRegex.exec(content)) !== null) {
      headings.push({
        level: match[1].length,
        text: match[2],
        position: match.index,
      });
    }

    // Split content by paragraphs/sections
    const paragraphs = content.split(/\n\n+/);
    let currentPosition = 0;
    let currentChunk = '';
    let currentHeadings: string[] = [];
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      // Update current headings based on position
      const relevantHeadings = headings.filter(h => h.position <= currentPosition);
      if (relevantHeadings.length > 0) {
        // Build heading hierarchy
        const stack: string[] = [];
        for (const h of relevantHeadings) {
          while (stack.length >= h.level) {
            stack.pop();
          }
          stack.push(h.text);
        }
        currentHeadings = stack;
      }

      // Check if adding this paragraph exceeds chunk size
      if (currentChunk.length + paragraph.length > this.chunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          index: chunkIndex++,
          content: currentChunk.trim(),
          metadata: {
            sourcePath,
            headings: [...currentHeadings],
            tags: this.extractTags(currentChunk),
            topic: this.inferTopic(currentChunk),
          },
        });

        // Start new chunk with overlap
        const words = currentChunk.split(/\s+/);
        const overlapWords = words.slice(-Math.floor(this.chunkOverlap / 5));
        currentChunk = overlapWords.join(' ') + '\n\n';
      }

      currentChunk += paragraph + '\n\n';
      currentPosition += paragraph.length + 2;
    }

    // Don't forget the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        index: chunkIndex,
        content: currentChunk.trim(),
        metadata: {
          sourcePath,
          headings: currentHeadings,
          tags: this.extractTags(currentChunk),
          topic: this.inferTopic(currentChunk),
        },
      });
    }

    return chunks;
  }

  /**
   * Extrai tags do conteúdo
   */
  private extractTags(content: string): string[] {
    const tags: string[] = [];
    const lowerContent = content.toLowerCase();

    const tagKeywords: Record<string, string[]> = {
      sono: ['sono', 'dormir', 'soneca', 'noite', 'acordar', 'despertar'],
      amamentacao: ['amamentação', 'mamar', 'peito', 'mama', 'leite materno', 'amamentar'],
      alimentacao: ['alimentação', 'comida', 'papinha', 'introdução alimentar', 'comer'],
      fralda: ['fralda', 'xixi', 'cocô', 'evacuação', 'diurese'],
      desenvolvimento: ['desenvolvimento', 'marco', 'milestone', 'crescimento', 'motor'],
      saude: ['saúde', 'febre', 'doença', 'vacina', 'médico', 'pediatra'],
      rotina: ['rotina', 'horário', 'schedule', 'ritmo'],
    };

    for (const [tag, keywords] of Object.entries(tagKeywords)) {
      if (keywords.some(kw => lowerContent.includes(kw))) {
        tags.push(tag);
      }
    }

    return tags;
  }

  /**
   * Infere o tópico principal do chunk
   */
  private inferTopic(content: string): string {
    const lowerContent = content.toLowerCase();

    const topics: Record<string, string[]> = {
      'Sono do bebê': ['sono', 'dormir', 'soneca', 'noite'],
      'Amamentação': ['amamentação', 'mamar', 'peito', 'leite'],
      'Alimentação complementar': ['introdução alimentar', 'papinha', 'BLW'],
      'Fraldas e higiene': ['fralda', 'banho', 'higiene'],
      'Desenvolvimento motor': ['engatinhar', 'sentar', 'andar', 'motor'],
      'Desenvolvimento cognitivo': ['falar', 'palavra', 'cognitivo', 'brincar'],
      'Saúde e bem-estar': ['febre', 'vacina', 'saúde', 'pediatra'],
    };

    for (const [topic, keywords] of Object.entries(topics)) {
      if (keywords.some(kw => lowerContent.includes(kw))) {
        return topic;
      }
    }

    return 'Geral';
  }

  /**
   * Gera hash do conteúdo para detectar mudanças
   */
  private async hashContent(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Lista todos os documentos indexados
   */
  async listDocuments(): Promise<{ id: number; source: string; title: string; chunkCount: number }[]> {
    const docs = await prisma.aiDocument.findMany({
      include: {
        _count: {
          select: { chunks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return docs.map(doc => ({
      id: doc.id,
      source: doc.source,
      title: doc.title,
      chunkCount: doc._count.chunks,
    }));
  }

  /**
   * Remove um documento e seus chunks
   */
  async deleteDocument(documentId: number): Promise<void> {
    await prisma.aiDocument.delete({
      where: { id: documentId },
    });
    logger.info(`🗑️ Document ${documentId} deleted`);
  }
}

// Singleton instance
export const ragService = new RAGService();
