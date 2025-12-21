import { QueryHistoryRepository } from '../database/repositories';
import { QueryHistoryEntity } from '../database/entities/postgresql';

export class QueryHistoryService {
  private readonly historyRepo: QueryHistoryRepository;

  constructor() {
    this.historyRepo = new QueryHistoryRepository();
  }

  async getQueryById(id: string): Promise<QueryHistoryEntity | null> {
    return this.historyRepo.findById(id);
  }

  async getUserQueries(
    userId: string,
    skip: number = 0,
    take: number = 20
  ): Promise<QueryHistoryEntity[]> {
    return this.historyRepo.findByUserId(userId, skip, take);
  }

  async createQuery(
    userId: string,
    query: string,
    documentIds: string[],
    response: string,
    citations: Array<{ documentId: string; text: string; pageNumber?: number }>,
    confidence: number,
    executionTimeMs: number
  ): Promise<QueryHistoryEntity> {
    return this.historyRepo.create({
      userId,
      query,
      documentIds,
      response,
      citations,
      confidence,
      executionTimeMs,
    });
  }

  async getUserQueryCount(userId: string): Promise<number> {
    return this.historyRepo.countByUserId(userId);
  }

  async getQueriesByDocument(documentId: string): Promise<QueryHistoryEntity[]> {
    return this.historyRepo.findByDocumentId(documentId);
  }

  async getAverageConfidence(userId: string): Promise<number> {
    return this.historyRepo.getAverageConfidence(userId);
  }

  async deleteQuery(id: string): Promise<boolean> {
    return this.historyRepo.delete(id);
  }

  async deleteUserQueries(userId: string): Promise<number> {
    // Get all queries for user
    const queries = await this.historyRepo.findByUserId(userId, 0, 1000);
    
    // Delete them individually
    let deleted = 0;
    for (const query of queries) {
      if (await this.historyRepo.delete(query.id)) {
        deleted += 1;
      }
    }
    
    return deleted;
  }
}
