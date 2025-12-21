import { Job } from 'bullmq';
import { DOCUMENT_INGESTION_QUEUE, documentIngestionQueue } from '../queues/documentIngestionQueue';

export interface QueueSummary {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface IngestionJobDetails {
  id: string;
  name: string;
  state: string;
  attemptsMade: number;
  failedReason?: string;
  progress: number;
  timestamps: {
    createdOn?: number | null;
    processedOn?: number | null;
    finishedOn?: number | null;
  };
  data: Record<string, unknown>;
  options: {
    attempts?: number;
    backoff?: unknown;
    delay?: number;
    priority?: number;
  };
  logs: string[];
}

class IngestionMonitoringService {
  async getQueueSummary(): Promise<QueueSummary> {
    const counts = await documentIngestionQueue.getJobCounts();
    const paused = await documentIngestionQueue.isPaused();

    return {
      queueName: DOCUMENT_INGESTION_QUEUE,
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused,
    };
  }

  async getJobDetails(jobId: string): Promise<IngestionJobDetails | null> {
    const job = await documentIngestionQueue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    const logs = await this.getJobLogs(job);

    return {
      id: String(job.id),
      name: job.name ?? 'document.ingest',
      state,
      attemptsMade: job.attemptsMade ?? 0,
      failedReason: job.failedReason ?? undefined,
      progress: this.normalizeProgress(job.progress),
      timestamps: {
        createdOn: job.timestamp ?? null,
        processedOn: job.processedOn ?? null,
        finishedOn: job.finishedOn ?? null,
      },
      data: job.data as unknown as Record<string, unknown>,
      options: {
        attempts: job.opts.attempts,
        backoff: job.opts.backoff,
        delay: job.opts.delay,
        priority: job.opts.priority,
      },
      logs,
    };
  }

  private normalizeProgress(progress: number | object): number {
    if (typeof progress === 'number') {
      return progress;
    }

    return 0;
  }

  private async getJobLogs(job: Job): Promise<string[]> {
    try {
      const { logs } = await documentIngestionQueue.getJobLogs(String(job.id));
      return logs;
    } catch (error) {
      console.warn(`Failed to fetch logs for job ${job.id}:`, error);
      return [];
    }
  }
}

export const ingestionMonitoringService = new IngestionMonitoringService();
