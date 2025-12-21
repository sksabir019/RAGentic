import { DocumentRepository, DocumentChunkRepository } from '../database/repositories';
import { DocumentEntity, DocumentChunkEntity } from '../database/entities/postgresql';
import { vectorStoreService } from './VectorStoreService';
import { ingestionJobService } from './IngestionJobService';

export type DocumentProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';

export class DocumentService {
  private readonly docRepo: DocumentRepository;
  private readonly chunkRepo: DocumentChunkRepository;

  constructor() {
    this.docRepo = new DocumentRepository();
    this.chunkRepo = new DocumentChunkRepository();
  }

  async getDocumentById(id: string): Promise<DocumentEntity | null> {
    return this.docRepo.findById(id);
  }

  async getUserDocuments(
    userId: string,
    skip: number = 0,
    take: number = 10
  ): Promise<DocumentEntity[]> {
    return this.docRepo.findByUserId(userId, skip, take);
  }

  async getUserDocumentsByIds(userId: string, documentIds: string[]): Promise<DocumentEntity[]> {
    return this.docRepo.findByIds(userId, documentIds);
  }

  async createDocument(
    userId: string,
    filename: string,
    originalName: string,
    mimeType: string,
    size: number,
    s3Key?: string,
    metadata?: Record<string, any>
  ): Promise<DocumentEntity> {
    return this.docRepo.create({
      userId,
      filename,
      originalName,
      mimeType,
      size,
      s3Key,
      metadata: metadata || {},
      chunkCount: 0,
      processingStatus: 'pending',
    });
  }

  async updateDocument(
    id: string,
    updates: Partial<DocumentEntity>
  ): Promise<DocumentEntity> {
    return this.docRepo.update(id, updates);
  }

  async deleteDocument(id: string): Promise<boolean> {
    // Delete associated vectors and chunks
    await vectorStoreService.deleteByDocumentId(id);
    await this.chunkRepo.deleteByDocumentId(id);
    await ingestionJobService.deleteJobsForDocument(id);
    // Delete document
    return this.docRepo.delete(id);
  }

  async getUserDocumentCount(userId: string): Promise<number> {
    return this.docRepo.countByUserId(userId);
  }

  async getDocumentByS3Key(s3Key: string): Promise<DocumentEntity | null> {
    return this.docRepo.findByS3Key(s3Key);
  }

  async addChunks(
    documentId: string,
    chunks: Partial<DocumentChunkEntity>[]
  ): Promise<DocumentChunkEntity[]> {
    const savedChunks = await this.chunkRepo.createBatch(chunks);
    
    // Update chunk count
    const count = await this.chunkRepo.countByDocumentId(documentId);
    await this.docRepo.update(documentId, { chunkCount: count });

    return savedChunks;
  }

  async getDocumentChunks(documentId: string): Promise<DocumentChunkEntity[]> {
    return this.chunkRepo.findByDocumentId(documentId);
  }

  async getChunksByIds(ids: string[]): Promise<DocumentChunkEntity[]> {
    return this.chunkRepo.findByIds(ids);
  }

  async getDocumentChunksWithEmbeddings(
    documentId: string
  ): Promise<DocumentChunkEntity[]> {
    return this.chunkRepo.findWithEmbeddings(documentId);
  }

  async getUserChunks(userId: string, documentIds?: string[]): Promise<DocumentChunkEntity[]> {
    if (documentIds && documentIds.length > 0) {
      return this.chunkRepo.findByUserIdAndDocumentIds(userId, documentIds);
    }
    return this.chunkRepo.findByUserId(userId);
  }

  async getUserChunkCount(userId: string, documentIds?: string[]): Promise<number> {
    if (documentIds && documentIds.length > 0) {
      return this.chunkRepo.countByUserIdAndDocumentIds(userId, documentIds);
    }
    return this.chunkRepo.countByUserId(userId);
  }

  async deleteDocumentChunks(documentId: string): Promise<number> {
    await vectorStoreService.deleteByDocumentId(documentId);
    const deleted = await this.chunkRepo.deleteByDocumentId(documentId);
    await this.docRepo.update(documentId, { chunkCount: 0 });
    return deleted;
  }

  async updateDocumentStatus(
    documentId: string,
    status: DocumentProcessingStatus,
    statusMessage?: string | null
  ): Promise<DocumentEntity> {
    return this.docRepo.update(documentId, {
      processingStatus: status,
      statusMessage: statusMessage ?? undefined,
    });
  }

  async updateChunkVectorStoreId(
    chunkId: string,
    vectorStoreId: string | null
  ): Promise<void> {
    await this.chunkRepo.updateVectorStoreId(chunkId, vectorStoreId);
  }
}
