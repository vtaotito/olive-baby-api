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
  const basePrompt = `Professional blog cover image for an article titled "${title}". ` +
    `Clean, modern, warm and inviting design. Pastel colors with olive green accents. ` +
    `Minimalist illustration style suitable for a baby care and parenting blog. ` +
    `No text, no letters, no words in the image. High quality, 16:9 aspect ratio.`;

  if (excerpt) {
    return `${basePrompt} Context: ${excerpt.substring(0, 100)}`;
  }
  return basePrompt;
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
    const pollinationsUrl = `${POLLINATIONS_BASE}/${encodedPrompt}?width=${width}&height=${height}&model=flux&seed=${seed}&enhance=true&nologo=true`;

    logger.info('Generating blog cover image via Pollinations', { title: options.title, width, height });

    try {
      const response = await fetch(pollinationsUrl, {
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        throw new Error(`Pollinations API error: ${response.status} ${response.statusText}`);
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
