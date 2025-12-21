import { Repository } from 'typeorm';
import { dbAdapter } from '../adapter';
import { QueryHistoryEntity } from '../entities/postgresql';

export class QueryHistoryRepository {
  private readonly repo: Repository<QueryHistoryEntity>;

  constructor() {
    this.repo = dbAdapter.getRepository(dbAdapter.getQueryHistoryEntity());
  }

  async findById(id: string): Promise<QueryHistoryEntity | null> {
    return this.repo.findOneBy({ id });
  }

  async findByUserId(
    userId: string,
    skip: number = 0,
    take: number = 10
  ): Promise<QueryHistoryEntity[]> {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
  }

  async create(
    historyData: Partial<QueryHistoryEntity>
  ): Promise<QueryHistoryEntity> {
    const history = this.repo.create(historyData);
    return this.repo.save(history);
  }

  async update(
    id: string,
    historyData: Partial<QueryHistoryEntity>
  ): Promise<QueryHistoryEntity> {
    await this.repo.update(id, historyData);
    const updated = await this.repo.findOneBy({ id });
    if (!updated) {
      throw new Error('Query history not found after update');
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

  async findByDocumentId(documentId: string): Promise<QueryHistoryEntity[]> {
    return this.repo
      .createQueryBuilder('qh')
      .where(':documentId = ANY(qh.documentIds)', { documentId })
      .orderBy('qh.createdAt', 'DESC')
      .getMany();
  }

  async getAverageConfidence(userId: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('qh')
      .select('AVG(qh.confidence)', 'average')
      .where('qh.userId = :userId', { userId })
      .getRawOne();

    return Number(result?.average ?? 0);
  }
}
