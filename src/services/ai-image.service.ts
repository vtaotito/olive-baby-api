import { env } from '../config/env';
import { logger } from '../config/logger';
import { assertValidImageBuffer } from '../utils/validators/image-magic-bytes';
import {
  buildImageAgentPrompt,
  IMAGE_AGENT_FORMATS,
  IMAGE_NEGATIVE_PROMPT,
  type ImageAgentFormat,
  type ImageAgentTemplateId,
} from '../constants/image-agent';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';
const IMAGE_DIR = path.resolve(process.cwd(), 'public', 'blog-images');

function ensureImageDir() {
  if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
  }
}

export class AIImageService {
  /**
   * Generate a cover/social image using Pollinations.ai (fallback, no API key).
   * Uses the same prompt builder as Gemini/OpenAI for template consistency.
   */
  static async generateCoverImage(options: {
    title: string;
    excerpt?: string;
    customPrompt?: string;
    width?: number;
    height?: number;
    format?: ImageAgentFormat;
    templateId?: ImageAgentTemplateId;
    headings?: string[];
  }): Promise<{ imageUrl: string; prompt: string }> {
    const format = options.format ?? 'blog';
    const templateId = options.templateId ?? 'essencial';
    const formatConfig = IMAGE_AGENT_FORMATS[format];
    const width = options.width || formatConfig.width;
    const height = options.height || formatConfig.height;

    const prompt = buildImageAgentPrompt({
      topic: options.title,
      excerpt: options.excerpt,
      templateId,
      format,
      customPrompt: options.customPrompt,
      headings: options.headings,
    });

    const encodedPrompt = encodeURIComponent(prompt);
    const seed = crypto.randomInt(1, 999999);
    const negative = encodeURIComponent(IMAGE_NEGATIVE_PROMPT);
    const pollinationsUrl = `${POLLINATIONS_BASE}/${encodedPrompt}?width=${width}&height=${height}&model=flux&seed=${seed}&enhance=true&nologo=true&negative=${negative}`;

    logger.info('Generating image via Pollinations', {
      title: options.title.substring(0, 80),
      width,
      height,
      format,
      templateId,
    });

    try {
      let response: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          const delay = attempt * 20000;
          logger.info(`Pollinations rate limited, retrying in ${delay / 1000}s (attempt ${attempt + 1}/3)`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        response = await fetch(pollinationsUrl, {
          signal: AbortSignal.timeout(90000),
        });

        if (response.ok) break;
        if (response.status === 429) continue;
        throw new Error(`Pollinations API error: ${response.status} ${response.statusText}`);
      }

      if (!response || !response.ok) {
        throw new Error('Pollinations API: max retries exceeded (rate limited)');
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      assertValidImageBuffer(buffer);

      ensureImageDir();
      const filename = `blog-${Date.now()}-${seed}.jpg`;
      const filepath = path.join(IMAGE_DIR, filename);
      fs.writeFileSync(filepath, buffer);

      const frontendUrl = env.FRONTEND_URL || 'https://oliecare.cloud';
      const imageUrl = `${frontendUrl}/api/v1/blog/images/${filename}`;

      logger.info('Pollinations image generated', { filename, size: buffer.length, format, templateId });

      return { imageUrl, prompt };
    } catch (error) {
      logger.error('Failed to generate image via Pollinations', { error });
      throw error;
    }
  }

  /**
   * Save an uploaded image file and return the public URL
   */
  static saveUploadedImage(file: { buffer: Buffer; originalname: string; mimetype: string }): { imageUrl: string; filename: string } {
    ensureImageDir();

    const { extension } = assertValidImageBuffer(file.buffer, file.mimetype);
    const filename = `upload-${Date.now()}-${crypto.randomInt(1000, 9999)}${extension}`;
    const filepath = path.join(IMAGE_DIR, filename);
    fs.writeFileSync(filepath, file.buffer);

    const frontendUrl = env.FRONTEND_URL || 'https://oliecare.cloud';
    const imageUrl = `${frontendUrl}/api/v1/blog/images/${filename}`;

    logger.info('Image uploaded', { filename, size: file.buffer.length });

    return { imageUrl, filename };
  }

  /**
   * Get the local file path for a blog image
   */
  static getImagePath(filename: string): string | null {
    const filepath = path.join(IMAGE_DIR, filename);
    if (fs.existsSync(filepath)) {
      return filepath;
    }
    return null;
  }
}
