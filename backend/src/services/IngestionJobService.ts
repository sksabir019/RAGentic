import { dbAdapter } from '../database/adapter';
import { DocumentIngestionJobEntity } from '../database/entities/postgresql';
import { DocumentIngestionJobRepository } from '../database/repositories';

export type IngestionJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export class IngestionJobService {
  private readonly repo?: DocumentIngestionJobRepository;
  private readonly enabled: boolean;

  constructor() {
    this.enabled = dbAdapter.getDatabaseType() === 'postgres';
    this.repo = this.enabled ? new DocumentIngestionJobRepository() : undefined;
  }

  async createJobRecord(params: {
    documentId: string;
    userId: string;
    jobId: string;
    status?: IngestionJobStatus;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.repo) {
      return;
    }

    const status = params.status ?? 'queued';

    const existing = await this.repo.findByJobId(params.jobId);
    if (existing) {
      await this.repo.updateStatus(params.jobId, {
        status,
        metadata: { ...(existing.metadata || {}), ...(params.metadata || {}) },
      });
      return;
    }

    await this.repo.create({
      documentId: params.documentId,
      userId: params.userId,
      jobId: params.jobId,
      status,
      metadata: params.metadata ?? {},
    });
  }

  async markProcessing(jobId: string, attempts: number): Promise<void> {
    if (!this.repo) {
      return;
    }

    const existing = await this.repo.findByJobId(jobId);
    await this.repo.updateStatus(jobId, {
      status: 'processing',
      attempts,
      startedAt: existing?.startedAt ?? new Date(),
    });
  }

  async markCompleted(jobId: string, attempts: number, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.repo) {
      return;
    }

    const existing = await this.repo.findByJobId(jobId);
    await this.repo.updateStatus(jobId, {
      status: 'completed',
      attempts,
      finishedAt: new Date(),
      metadata: metadata ? { ...(existing?.metadata ?? {}), ...metadata } : undefined,
      errorMessage: null,
    });
  }

  async markFailed(jobId: string, attempts: number, errorMessage: string): Promise<void> {
    if (!this.repo) {
      return;
    }

    await this.repo.updateStatus(jobId, {
      status: 'failed',
      attempts,
      finishedAt: new Date(),
      errorMessage,
    });
  }

  async getJobsForDocument(documentId: string): Promise<DocumentIngestionJobEntity[]> {
    if (!this.repo) {
      return [];
    }
    return this.repo.findByDocumentId(documentId);
  }

  async deleteJobsForDocument(documentId: string): Promise<void> {
    if (!this.repo) {
      return;
    }
    await this.repo.deleteByDocumentId(documentId);
  }
}

export const ingestionJobService = new IngestionJobService();
