import { Repository } from 'typeorm';
import { dbAdapter } from '../adapter';
import { DocumentIngestionJobEntity } from '../entities/postgresql';

export class DocumentIngestionJobRepository {
  private readonly repo: Repository<DocumentIngestionJobEntity>;

  constructor() {
    this.repo = dbAdapter.getRepository(dbAdapter.getDocumentIngestionJobEntity());
  }

  async create(job: Partial<DocumentIngestionJobEntity>): Promise<DocumentIngestionJobEntity> {
    const entity = this.repo.create(job);
    return this.repo.save(entity);
  }

  async findByJobId(jobId: string): Promise<DocumentIngestionJobEntity | null> {
    return this.repo.findOne({ where: { jobId } });
  }

  async updateStatus(
    jobId: string,
    updates: Partial<DocumentIngestionJobEntity>
  ): Promise<DocumentIngestionJobEntity | null> {
    await this.repo.update({ jobId }, updates);
    return this.findByJobId(jobId);
  }

  async findByDocumentId(documentId: string): Promise<DocumentIngestionJobEntity[]> {
    return this.repo.find({
      where: { documentId },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.repo.delete({ documentId });
  }
}
