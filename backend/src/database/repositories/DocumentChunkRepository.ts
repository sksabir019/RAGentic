import { In, Repository } from 'typeorm';
import { dbAdapter } from '../adapter';
import { DocumentChunkEntity } from '../entities/postgresql';

export class DocumentChunkRepository {
  private readonly repo: Repository<DocumentChunkEntity>;

  constructor() {
    this.repo = dbAdapter.getRepository(dbAdapter.getDocumentChunkEntity());
  }

  async findById(id: string): Promise<DocumentChunkEntity | null> {
    return this.repo.findOneBy({ id });
  }

  async findByDocumentId(documentId: string): Promise<DocumentChunkEntity[]> {
    return this.repo.find({
      where: { documentId },
      order: { chunkIndex: 'ASC' },
    });
  }

  async findByUserId(userId: string): Promise<DocumentChunkEntity[]> {
    return this.repo.find({
      where: { userId },
    });
  }

  async findByUserIdAndDocumentIds(
    userId: string,
    documentIds: string[]
  ): Promise<DocumentChunkEntity[]> {
    if (documentIds.length === 0) {
      return [];
    }

    return this.repo.find({
      where: {
        userId,
        documentId: In(documentIds),
      },
      order: { documentId: 'ASC', chunkIndex: 'ASC' },
    });
  }

  async findByIds(ids: string[]): Promise<DocumentChunkEntity[]> {
    if (!ids.length) {
      return [];
    }
    return this.repo.find({
      where: { id: In(ids) },
    });
  }

  async create(chunkData: Partial<DocumentChunkEntity>): Promise<DocumentChunkEntity> {
    const chunk = this.repo.create(chunkData);
    return this.repo.save(chunk);
  }

  async createBatch(chunks: Partial<DocumentChunkEntity>[]): Promise<DocumentChunkEntity[]> {
    const chunkEntities = this.repo.create(chunks);
    return this.repo.save(chunkEntities);
  }

  async update(
    id: string,
    chunkData: Partial<DocumentChunkEntity>
  ): Promise<DocumentChunkEntity> {
    await this.repo.update(id, chunkData);
    const updated = await this.repo.findOneBy({ id });
    if (!updated) {
      throw new Error('Chunk not found after update');
    }
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async deleteByDocumentId(documentId: string): Promise<number> {
    const result = await this.repo.delete({ documentId });
    return result.affected ?? 0;
  }

  async countByDocumentId(documentId: string): Promise<number> {
    return this.repo.countBy({ documentId });
  }

  async countByUserId(userId: string): Promise<number> {
    return this.repo.countBy({ userId });
  }

  async countByUserIdAndDocumentIds(
    userId: string,
    documentIds: string[]
  ): Promise<number> {
    if (documentIds.length === 0) {
      return 0;
    }

    return this.repo.count({
      where: {
        userId,
        documentId: In(documentIds),
      },
    });
  }

  async findWithEmbeddings(documentId: string): Promise<DocumentChunkEntity[]> {
    return this.repo.find({
      where: {
        documentId,
      },
      select: ['id', 'content', 'embedding', 'pageNumber', 'chunkIndex'],
    });
  }

  async updateVectorStoreId(id: string, vectorStoreId: string | null): Promise<void> {
    await this.repo.update(id, { vectorStoreId: vectorStoreId ?? undefined });
  }
}
