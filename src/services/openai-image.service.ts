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

function ensureImageDir() {
  if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
  }
}

export interface GenerateOpenAIImageOptions {
  topic: string;
  excerpt?: string;
  customPrompt?: string;
  format?: ImageAgentFormat;
  templateId?: ImageAgentTemplateId;
}

export class OpenAIImageService {
  static isConfigured(): boolean {
    return !!env.OPENAI_API_KEY;
  }

  static async generate(options: GenerateOpenAIImageOptions): Promise<{
    imageUrl: string;
    prompt: string;
    filename: string;
  }> {
    if (!env.OPENAI_API_KEY) {
      throw AppError.badRequest('OPENAI_API_KEY não configurada no servidor');
    }

    const format = options.format ?? 'blog';
    const templateId = options.templateId ?? 'essencial';
    const formatConfig = IMAGE_AGENT_FORMATS[format];
    const prompt = buildImageAgentPrompt({
      topic: options.topic,
      excerpt: options.excerpt,
      templateId,
      format,
      customPrompt: options.customPrompt,
    });

    const model = env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

    logger.info('Generating image via OpenAI', { model, format, templateId, size: formatConfig.openAiSize });

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size: formatConfig.openAiSize,
        quality: 'high',
        output_format: 'jpeg',
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      logger.error('OpenAI image API error', { status: response.status, errText: errText.slice(0, 500) });
      throw AppError.badRequest(`Falha ao gerar imagem (OpenAI ${response.status})`);
    }

    const json = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };

    const item = json.data?.[0];
    if (!item) {
      throw AppError.badRequest('OpenAI não retornou imagem');
    }

    let buffer: Buffer;
    if (item.b64_json) {
      buffer = Buffer.from(item.b64_json, 'base64');
    } else if (item.url) {
      const imgRes = await fetch(item.url, { signal: AbortSignal.timeout(60000) });
      if (!imgRes.ok) throw AppError.badRequest('Falha ao baixar imagem gerada');
      buffer = Buffer.from(await imgRes.arrayBuffer());
    } else {
      throw AppError.badRequest('Resposta OpenAI sem imagem');
    }

    assertValidImageBuffer(buffer);

    ensureImageDir();
    const seed = crypto.randomInt(1000, 99999);
    const filename = `openai-${format}-${templateId}-${Date.now()}-${seed}.jpg`;
    fs.writeFileSync(path.join(IMAGE_DIR, filename), buffer);

    const frontendUrl = env.FRONTEND_URL || 'https://oliecare.cloud';
    const imageUrl = `${frontendUrl}/api/v1/blog/images/${filename}`;

    return { imageUrl, prompt, filename };
  }
}
