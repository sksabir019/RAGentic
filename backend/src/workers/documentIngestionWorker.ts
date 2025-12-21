import 'reflect-metadata';
import dotenv from 'dotenv';
import { Worker, Job } from 'bullmq';

dotenv.config();

import { DOCUMENT_INGESTION_QUEUE, documentIngestionQueueConnection, DocumentIngestionJobData } from '../queues/documentIngestionQueue';
import { setupDatabaseAdapter, closeDatabaseAdapter } from '../database/connection';
import { DocumentService, documentProcessingService, ingestionJobService } from '../services';
import { vectorStoreService, UpsertVectorInput } from '../services/VectorStoreService';

const documentService = new DocumentService();

async function ensureDatabase(): Promise<void> {
  await setupDatabaseAdapter();
}

async function teardownDatabase(): Promise<void> {
  await closeDatabaseAdapter();
}

async function processJob(job: Job<DocumentIngestionJobData>): Promise<void> {
  const { documentId, userId, filePath, originalName, filename, metadata, mimeType, size } = job.data;
  const jobId = String(job.id);

  try {
    await documentService.updateDocumentStatus(documentId, 'processing', null);
    await ingestionJobService.markProcessing(jobId, job.attemptsMade ?? 0);

    // Reset existing state if this is a retry
    await documentService.deleteDocumentChunks(documentId);

    const processed = await documentProcessingService.processDocument(
      documentId,
      filePath,
      originalName || filename,
      true
    );

    const baseMetadata = {
      ...(metadata ?? {}),
      mimeType,
      size,
    };

    if (processed.totalChunks === 0) {
      const existingDocument = await documentService.getDocumentById(documentId);
      if (existingDocument) {
        const updatedMetadata = {
          ...(existingDocument.metadata || {}),
          ...(metadata ?? {}),
          pageCount: processed.pageCount ?? (existingDocument.metadata || {}).pageCount,
          totalChunks: 0,
          extractedCharacters: processed.extractedText.length,
        };

        await documentService.updateDocument(documentId, {
          metadata: updatedMetadata,
          chunkCount: 0,
        });
      }

      await documentService.updateDocumentStatus(
        documentId,
        'ready',
        'No text content was extracted from the uploaded document.'
      );
      await ingestionJobService.markCompleted(jobId, job.attemptsMade ?? 0, {
        totalChunks: 0,
        extractedCharacters: processed.extractedText.length,
      });
      return;
    }

    const chunkEntities = processed.chunks.map((chunk) => ({
      documentId,
      userId,
      content: chunk.content,
      chunkIndex: chunk.metadata.chunkIndex,
      metadata: {
        ...chunk.metadata,
        filename: processed.filename,
        ...baseMetadata,
      },
      embedding: chunk.embedding,
      pageNumber: chunk.metadata.pageNumber,
    }));

    const savedChunks = await documentService.addChunks(documentId, chunkEntities);

    const vectorInputs = savedChunks.reduce<UpsertVectorInput[]>((acc, chunkEntity, index) => {
      const embedding = processed.chunks[index]?.embedding;
      if (!embedding || embedding.length === 0) {
        return acc;
      }

      acc.push({
        documentChunkId: chunkEntity.id,
        documentId,
        userId,
        embedding,
        metadata: {
          chunkIndex: chunkEntity.chunkIndex,
          filename: processed.filename,
          documentId,
        },
      });

      return acc;
    }, []);

    if (vectorInputs.length) {
      const upserts = await vectorStoreService.upsertVectors(vectorInputs);
      await Promise.all(
        upserts.map((mapping) =>
          documentService.updateChunkVectorStoreId(mapping.documentChunkId, mapping.vectorId)
        )
      );
    }

    const existingDocument = await documentService.getDocumentById(documentId);
    if (existingDocument) {
      const updatedMetadata = {
        ...(existingDocument.metadata || {}),
        ...(metadata ?? {}),
        pageCount: processed.pageCount ?? (existingDocument.metadata || {}).pageCount,
        totalChunks: processed.totalChunks,
        extractedCharacters: processed.extractedText.length,
      };

      await documentService.updateDocument(documentId, {
        metadata: updatedMetadata,
        chunkCount: processed.totalChunks,
      });
    }

    await documentService.updateDocumentStatus(documentId, 'ready', null);
    await ingestionJobService.markCompleted(jobId, job.attemptsMade ?? 0, {
      totalChunks: processed.totalChunks,
      extractedCharacters: processed.extractedText.length,
      pageCount: processed.pageCount ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown ingestion error';
    console.error(`Document ingestion failed for ${documentId}:`, message);
    await documentService.updateDocumentStatus(documentId, 'failed', message);
    await ingestionJobService.markFailed(jobId, job.attemptsMade ?? 0, message);
    throw error;
  }
}

async function bootstrap(): Promise<void> {
  await ensureDatabase();

  const worker = new Worker<DocumentIngestionJobData>(
    DOCUMENT_INGESTION_QUEUE,
    async (job: Job<DocumentIngestionJobData>) => processJob(job),
    {
      connection: documentIngestionQueueConnection,
      concurrency: Number.parseInt(process.env.DOCUMENT_INGESTION_CONCURRENCY || '2', 10),
    }
  );

  worker.on('completed', (job: Job<DocumentIngestionJobData>) => {
    console.log(`Document ingestion completed for job ${job.id}`);
  });

  worker.on('failed', (job: Job<DocumentIngestionJobData> | undefined, err: Error) => {
    console.error(`Document ingestion failed for job ${job?.id}:`, err);
  });

  const handleShutdown = async (signal: string): Promise<void> => {
    console.log(`${signal} received. Stopping document ingestion worker...`);
    await worker.close();
    await teardownDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    handleShutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    handleShutdown('SIGINT');
  });
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
