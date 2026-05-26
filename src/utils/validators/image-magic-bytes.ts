import { AppError } from '../errors/AppError';

export type ImageFormat = 'jpeg' | 'png' | 'gif' | 'webp';

const EXT_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: '.jpg',
  png: '.png',
  gif: '.gif',
  webp: '.webp',
};

function isJpeg(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

function isPng(buf: Buffer): boolean {
  return (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  );
}

function isGif(buf: Buffer): boolean {
  return (
    buf.length >= 6 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  );
}

function isWebp(buf: Buffer): boolean {
  return (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  );
}

export function detectImageFormat(buffer: Buffer): ImageFormat | null {
  if (isJpeg(buffer)) return 'jpeg';
  if (isPng(buffer)) return 'png';
  if (isGif(buffer)) return 'gif';
  if (isWebp(buffer)) return 'webp';
  return null;
}

const MIME_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

export function assertValidImageBuffer(
  buffer: Buffer,
  declaredMime?: string
): { format: ImageFormat; extension: string } {
  if (!buffer?.length) {
    throw AppError.badRequest('Arquivo de imagem vazio ou inválido');
  }

  const format = detectImageFormat(buffer);
  if (!format) {
    throw AppError.badRequest(
      'Conteúdo do arquivo não corresponde a uma imagem permitida (JPEG, PNG, GIF ou WebP)'
    );
  }

  if (declaredMime) {
    const expected = MIME_BY_FORMAT[format];
    const normalized = declaredMime.toLowerCase();
    const altJpeg = format === 'jpeg' && normalized === 'image/jpg';
    if (normalized !== expected && !altJpeg) {
      throw AppError.badRequest('Tipo MIME não corresponde ao conteúdo real do arquivo');
    }
  }

  return { format, extension: EXT_BY_FORMAT[format] };
}
