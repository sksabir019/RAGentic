import { Queue } from 'bullmq';

export const DOCUMENT_INGESTION_QUEUE = 'document-ingestion';

export interface DocumentIngestionJobData {
  documentId: string;
  userId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  filePath: string;
  metadata?: Record<string, unknown>;
}

function buildRedisConnection() {
  if (process.env.REDIS_URL) {
    try {
      const url = new URL(process.env.REDIS_URL);
      return {
        host: url.hostname,
        port: Number.parseInt(url.port || '6379', 10),
        password: url.password || undefined,
        db: Number.parseInt(url.pathname.replace('/', '') || '0', 10),
      };
    } catch (error) {
      console.warn('Invalid REDIS_URL provided, falling back to host/port vars');
    }
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number.parseInt(process.env.REDIS_DB || '0', 10),
  };
}

export const documentIngestionQueueConnection = buildRedisConnection();

export const documentIngestionQueue = new Queue<DocumentIngestionJobData>(
  DOCUMENT_INGESTION_QUEUE,
  {
    connection: documentIngestionQueueConnection,
    defaultJobOptions: {
      attempts: Number.parseInt(process.env.DOCUMENT_INGESTION_RETRY_ATTEMPTS || '3', 10),
      backoff: {
        type: 'exponential',
        delay: Number.parseInt(process.env.DOCUMENT_INGESTION_RETRY_DELAY_MS || '5000', 10),
      },
      removeOnComplete: true,
      removeOnFail: Number.parseInt(process.env.DOCUMENT_INGESTION_RETAIN_FAILED || '10', 10),
    },
  }
);
