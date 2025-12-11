// Olive Baby API - Logger Configuration
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { env, isDevelopment } from './env';
import path from 'path';
import fs from 'fs';

// Criar diretório de logs se não existir
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Formato personalizado para logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Formato para console (desenvolvimento)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Transportes de log
const transports: winston.transport[] = [
  // Console (sempre ativo)
  new winston.transports.Console({
    format: isDevelopment ? consoleFormat : logFormat,
    level: isDevelopment ? 'debug' : 'info',
  }),

  // Arquivo de erros (rotação diária)
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    format: logFormat,
    maxSize: '20m',
    maxFiles: '30d',
    zippedArchive: true,
  }),

  // Arquivo de todos os logs (rotação diária)
  new DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: logFormat,
    maxSize: '20m',
    maxFiles: '30d',
    zippedArchive: true,
  }),
];

// Criar logger
export const logger = winston.createLogger({
  level: env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  format: logFormat,
  defaultMeta: {
    service: 'olive-baby-api',
    environment: env.NODE_ENV,
  },
  transports,
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
});

// Helper para logs estruturados
export const logContext = (context: Record<string, any>) => {
  return winston.format((info) => ({
    ...info,
    ...context,
  }))();
};

export default logger;
