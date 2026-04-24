import { env } from '../config/env';
import { logger } from '../config/logger';
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

function buildPrompt(title: string, excerpt?: string): string {
  const topicHint = excerpt ? ` The scene should visually represent: ${excerpt.substring(0, 120)}.` : '';

  return (
    `A beautiful, photorealistic illustration about "${title}".${topicHint} ` +
    `Warm pastel color palette with soft olive green and cream tones. ` +
    `The image depicts a cozy, tender scene related to baby care, parenting, or early childhood. ` +
    `Soft natural lighting, shallow depth of field, editorial photography style. ` +
    `STRICTLY NO TEXT. STRICTLY NO LETTERS. STRICTLY NO WORDS. STRICTLY NO NUMBERS. ` +
    `STRICTLY NO TYPOGRAPHY. STRICTLY NO WRITING OF ANY KIND ANYWHERE IN THE IMAGE. ` +
    `STRICTLY NO WATERMARKS. STRICTLY NO LOGOS. STRICTLY NO CAPTIONS. ` +
    `Pure visual illustration only. High quality, 16:9 cinematic composition.`
  );
}

export class AIImageService {
  /**
   * Generate a blog cover image using Pollinations.ai (free, no API key)
   * Returns the public URL of the generated image
   */
  static async generateCoverImage(options: {
    title: string;
    excerpt?: string;
    customPrompt?: string;
    width?: number;
    height?: number;
  }): Promise<{ imageUrl: string; prompt: string }> {
    const prompt = options.customPrompt || buildPrompt(options.title, options.excerpt);
    const width = options.width || 1200;
    const height = options.height || 675; // 16:9 ratio

    const encodedPrompt = encodeURIComponent(prompt);
    const seed = crypto.randomInt(1, 999999);
    const negative = encodeURIComponent('text, letters, words, numbers, typography, writing, captions, watermark, logo, signature, label, title, subtitle, heading, font, alphabet, character');
    const pollinationsUrl = `${POLLINATIONS_BASE}/${encodedPrompt}?width=${width}&height=${height}&model=flux&seed=${seed}&enhance=true&nologo=true&negative=${negative}`;

    logger.info('Generating blog cover image via Pollinations', { title: options.title, width, height });

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

      ensureImageDir();
      const filename = `blog-${Date.now()}-${seed}.jpg`;
      const filepath = path.join(IMAGE_DIR, filename);
      fs.writeFileSync(filepath, buffer);

      const frontendUrl = env.FRONTEND_URL || 'https://oliecare.cloud';
      const imageUrl = `${frontendUrl}/api/v1/blog/images/${filename}`;

      logger.info('Blog cover image generated', { filename, size: buffer.length });

      return { imageUrl, prompt };
    } catch (error) {
      logger.error('Failed to generate blog cover image', { error });
      throw error;
    }
  }

  /**
   * Save an uploaded image file and return the public URL
   */
  static saveUploadedImage(file: { buffer: Buffer; originalname: string; mimetype: string }): { imageUrl: string; filename: string } {
    ensureImageDir();

    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const safeExt = allowed.includes(ext) ? ext : '.jpg';

    const filename = `upload-${Date.now()}-${crypto.randomInt(1000, 9999)}${safeExt}`;
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
