import { In, Repository } from 'typeorm';
import { dbAdapter } from '../adapter';
import { DocumentEntity } from '../entities/postgresql';

export class DocumentRepository {
  private readonly repo: Repository<DocumentEntity>;

  constructor() {
    this.repo = dbAdapter.getRepository(dbAdapter.getDocumentEntity());
  }

  async findById(id: string): Promise<DocumentEntity | null> {
    return this.repo.findOneBy({ id });
  }

  async findByUserId(
    userId: string,
    skip: number = 0,
    take: number = 10
  ): Promise<DocumentEntity[]> {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
  }

  async create(documentData: Partial<DocumentEntity>): Promise<DocumentEntity> {
    const doc = this.repo.create(documentData);
    return this.repo.save(doc);
  }

  async findByIds(userId: string, ids: string[]): Promise<DocumentEntity[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.repo.find({
      where: {
        userId,
        id: In(ids),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: string,
    documentData: Partial<DocumentEntity>
  ): Promise<DocumentEntity> {
    await this.repo.update(id, documentData);
    const updated = await this.repo.findOneBy({ id });
    if (!updated) {
      throw new Error('Document not found after update');
    }
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async countByUserId(userId: string): Promise<number> {
    return this.repo.countBy({ userId });
  }

  async findByS3Key(s3Key: string): Promise<DocumentEntity | null> {
    return this.repo.findOneBy({ s3Key });
  }
}
