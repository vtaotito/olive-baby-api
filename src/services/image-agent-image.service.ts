import { env } from '../config/env';
import { logger } from '../config/logger';
import { AppError } from '../utils/errors/AppError';
import {
  buildImageAgentPrompt,
  IMAGE_AGENT_FORMATS,
  type ImageAgentFormat,
  type ImageAgentTemplateId,
} from '../constants/image-agent';
import { assertValidImageBuffer } from '../utils/validators/image-magic-bytes';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const IMAGE_DIR = path.resolve(process.cwd(), 'public', 'blog-images');

export type ImageGenerationProvider = 'gemini' | 'openai' | 'pollinations';

export interface GenerateAgentImageOptions {
  topic: string;
  excerpt?: string;
  customPrompt?: string;
  format?: ImageAgentFormat;
  templateId?: ImageAgentTemplateId;
  provider?: ImageGenerationProvider;
}

export interface GenerateAgentImageResult {
  imageUrl: string;
  prompt: string;
  filename: string;
  provider: ImageGenerationProvider;
  fallbackFrom?: ImageGenerationProvider;
}

function ensureImageDir() {
  if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
  }
}

function saveImageBuffer(
  buffer: Buffer,
  prefix: string,
  format: ImageAgentFormat,
  templateId: ImageAgentTemplateId
): { imageUrl: string; filename: string } {
  assertValidImageBuffer(buffer);
  ensureImageDir();
  const seed = crypto.randomInt(1000, 99999);
  const filename = `${prefix}-${format}-${templateId}-${Date.now()}-${seed}.jpg`;
  fs.writeFileSync(path.join(IMAGE_DIR, filename), buffer);
  const frontendUrl = env.FRONTEND_URL || 'https://oliecare.cloud';
  return { imageUrl: `${frontendUrl}/api/v1/blog/images/${filename}`, filename };
}

function geminiAspectRatio(format: ImageAgentFormat): string {
  return format === 'blog' ? '16:9' : '1:1';
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: { mimeType?: string; data?: string };
      }>;
    };
  }>;
  error?: { message?: string };
}

function isGeminiRetryableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('depleted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('429') ||
    lower.includes('resource exhausted') ||
    lower.includes('billing')
  );
}

async function generateWithFallback(
  options: GenerateAgentImageOptions,
  primary: ImageGenerationProvider
): Promise<GenerateAgentImageResult> {
  const chain: ImageGenerationProvider[] = [primary];
  if (primary === 'gemini') {
    if (env.OPENAI_API_KEY) chain.push('openai');
    chain.push('pollinations');
  } else if (primary === 'openai') {
    chain.push('pollinations');
  }

  let lastError: unknown;

  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
    try {
      const result = await generateWithProvider(options, provider);
      if (i > 0) {
        logger.warn('Image generation used fallback provider', {
          requested: primary,
          used: provider,
          reason: lastError instanceof Error ? lastError.message : String(lastError),
        });
        return { ...result, fallbackFrom: primary };
      }
      return result;
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const canRetry =
        i < chain.length - 1 &&
        (provider !== 'gemini' || isGeminiRetryableError(msg));

      if (!canRetry) throw error;
      logger.warn('Provider failed, trying next', { provider, msg: msg.slice(0, 200) });
    }
  }

  throw lastError;
}

async function generateWithProvider(
  options: GenerateAgentImageOptions,
  provider: ImageGenerationProvider
): Promise<GenerateAgentImageResult> {
  if (provider === 'gemini') {
    return GeminiImageService.generate(options);
  }
  if (provider === 'openai') {
    const { OpenAIImageService } = await import('./openai-image.service');
    const result = await OpenAIImageService.generate(options);
    return { ...result, provider: 'openai' };
  }
  const { AIImageService } = await import('./ai-image.service');
  const format = options.format ?? 'blog';
  const formatConfig = IMAGE_AGENT_FORMATS[format];
  const result = await AIImageService.generateCoverImage({
    title: options.topic,
    excerpt: options.excerpt,
    customPrompt: options.customPrompt,
    width: formatConfig.width,
    height: formatConfig.height,
  });
  const filename = result.imageUrl.split('/').pop() || `pollinations-${Date.now()}.jpg`;
  return { ...result, filename, provider: 'pollinations' };
}

export class GeminiImageService {
  static isConfigured(): boolean {
    return !!env.GEMINI_API_KEY;
  }

  static async generate(options: GenerateAgentImageOptions): Promise<GenerateAgentImageResult> {
    if (!env.GEMINI_API_KEY) {
      throw AppError.badRequest('GEMINI_API_KEY não configurada no servidor');
    }

    const format = options.format ?? 'blog';
    const templateId = options.templateId ?? 'essencial';
    const prompt = buildImageAgentPrompt({
      topic: options.topic,
      excerpt: options.excerpt,
      templateId,
      format,
      customPrompt: options.customPrompt,
    });

    const model = env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

    logger.info('Generating image via Gemini', { model, format, templateId, aspectRatio: geminiAspectRatio(format) });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: geminiAspectRatio(format),
          },
        },
      }),
      signal: AbortSignal.timeout(120000),
    });

    const json = (await response.json()) as GeminiGenerateResponse;

    if (!response.ok) {
      const msg = json.error?.message || `HTTP ${response.status}`;
      logger.error('Gemini image API error', { status: response.status, msg: msg.slice(0, 500) });
      if (isGeminiRetryableError(msg)) {
        throw AppError.badRequest(`Gemini indisponível (créditos ou cota): ${msg}`);
      }
      throw AppError.badRequest(`Falha ao gerar imagem (Gemini): ${msg}`);
    }

    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(p => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      throw AppError.badRequest('Gemini não retornou imagem na resposta');
    }

    const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
    const saved = saveImageBuffer(buffer, 'gemini', format, templateId);

    return { ...saved, prompt, provider: 'gemini' };
  }
}

export class ImageAgentImageService {
  static listProviders(): ImageGenerationProvider[] {
    const list: ImageGenerationProvider[] = [];
    if (GeminiImageService.isConfigured()) list.push('gemini');
    if (env.OPENAI_API_KEY) list.push('openai');
    list.push('pollinations');
    return list;
  }

  static defaultProvider(): ImageGenerationProvider {
    const pref = env.IMAGE_AGENT_IMAGE_PROVIDER;
    if (pref === 'gemini' && GeminiImageService.isConfigured()) return 'gemini';
    if (pref === 'openai' && env.OPENAI_API_KEY) return 'openai';
    if (pref === 'pollinations') return 'pollinations';
    if (GeminiImageService.isConfigured()) return 'gemini';
    if (env.OPENAI_API_KEY) return 'openai';
    return 'pollinations';
  }

  static resolveProvider(requested?: ImageGenerationProvider): ImageGenerationProvider {
    if (requested) {
      if (requested === 'gemini' && !GeminiImageService.isConfigured()) {
        throw AppError.badRequest('Gemini não configurado (GEMINI_API_KEY ausente)');
      }
      if (requested === 'openai' && !env.OPENAI_API_KEY) {
        throw AppError.badRequest('OpenAI não configurado (OPENAI_API_KEY ausente)');
      }
      return requested;
    }
    return ImageAgentImageService.defaultProvider();
  }

  static async generate(options: GenerateAgentImageOptions): Promise<GenerateAgentImageResult> {
    const provider = ImageAgentImageService.resolveProvider(options.provider);
    return generateWithFallback(options, provider);
  }
}
