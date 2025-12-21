import { dbAdapter } from '../database/adapter';

export interface UpsertVectorInput {
  documentChunkId: string;
  documentId: string;
  userId: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorSearchResult {
  documentChunkId: string;
  documentId: string;
  similarity: number;
}

class VectorStoreService {
  private readonly dimension: number;

  constructor() {
    this.dimension = Number.parseInt(process.env.VECTOR_DIMENSION || '1536', 10);
  }

  isEnabled(): boolean {
    return dbAdapter.getDatabaseType() === 'postgres';
  }

  private assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new Error('Vector store is only available when using PostgreSQL');
    }
  }

  private formatVector(embedding: number[]): string {
    if (embedding.length !== this.dimension) {
      console.warn(
        `Embedding dimension mismatch. Expected ${this.dimension}, received ${embedding.length}.`);
    }
    return `[${embedding.join(',')}]`;
  }

  async upsertVectors(
    vectors: UpsertVectorInput[]
  ): Promise<Array<{ documentChunkId: string; vectorId: string }>> {
    if (!vectors.length || !this.isEnabled()) {
      return [];
    }

    this.assertEnabled();
    const dataSource = dbAdapter.getDataSource();
    const results: Array<{ documentChunkId: string; vectorId: string }> = [];

    for (const vector of vectors) {
      if (!vector.embedding || vector.embedding.length === 0) {
        continue;
      }

      const formattedVector = this.formatVector(vector.embedding);
      const metadata = JSON.stringify(vector.metadata ?? {});

      const query = `
        INSERT INTO document_chunk_vectors
          (document_chunk_id, document_id, user_id, embedding, metadata)
        VALUES ($1, $2, $3, $4::vector, $5::jsonb)
        ON CONFLICT (document_chunk_id)
        DO UPDATE SET
          embedding = EXCLUDED.embedding,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
        RETURNING id;
      `;

      const [row] = await dataSource.query(query, [
        vector.documentChunkId,
        vector.documentId,
        vector.userId,
        formattedVector,
        metadata,
      ]);

      if (row?.id) {
        results.push({ documentChunkId: vector.documentChunkId, vectorId: row.id });
      }
    }

    return results;
  }

  async queryByEmbedding(
    userId: string,
    embedding: number[],
    topK = 5,
    documentIds?: string[]
  ): Promise<VectorSearchResult[]> {
    if (!this.isEnabled()) {
      return [];
    }

    if (!embedding || embedding.length === 0) {
      return [];
    }

    this.assertEnabled();
    const dataSource = dbAdapter.getDataSource();
    const formattedVector = this.formatVector(embedding);

    const params: unknown[] = [userId, formattedVector];
    let filterClause = '';

    if (documentIds && documentIds.length > 0) {
      params.push(documentIds);
      filterClause = ` AND document_id = ANY($${params.length}::uuid[])`;
    }

    params.push(topK);
    const limitParamIndex = params.length;

    const query = `
      SELECT
        document_chunk_id AS "documentChunkId",
        document_id AS "documentId",
        1 - (embedding <=> $2::vector) AS similarity
      FROM document_chunk_vectors
      WHERE user_id = $1${filterClause}
      ORDER BY embedding <=> $2::vector
      LIMIT $${limitParamIndex};
    `;

    const rows = await dataSource.query(query, params);
    return (rows as Array<Record<string, unknown>>).map((row) => {
      const similarity = Number.parseFloat(String(row.similarity ?? 0));
      return {
        documentChunkId: String(row.documentChunkId),
        documentId: String(row.documentId),
        similarity: Number.isNaN(similarity) ? 0 : similarity,
      };
    });
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }
    const dataSource = dbAdapter.getDataSource();
    await dataSource.query('DELETE FROM document_chunk_vectors WHERE document_id = $1', [documentId]);
  }

  async deleteByChunkIds(chunkIds: string[]): Promise<void> {
    if (!this.isEnabled() || chunkIds.length === 0) {
      return;
    }
    const dataSource = dbAdapter.getDataSource();
    await dataSource.query('DELETE FROM document_chunk_vectors WHERE document_chunk_id = ANY($1::uuid[])', [chunkIds]);
  }

  async countByUser(userId: string): Promise<number> {
    if (!this.isEnabled()) {
      return 0;
    }
    const dataSource = dbAdapter.getDataSource();
    const [result] = await dataSource.query(
      'SELECT COUNT(*)::int AS count FROM document_chunk_vectors WHERE user_id = $1',
      [userId]
    );
    return result?.count ?? 0;
  }
}

export const vectorStoreService = new VectorStoreService();
