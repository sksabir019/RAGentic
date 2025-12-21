import { Router, Request, Response } from 'express';
import { ingestionMonitoringService } from '../services';

const router = Router();

router.get(
  '/queues/document-ingestion',
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const summary = await ingestionMonitoringService.getQueueSummary();
      res.json({ success: true, data: summary });
    } catch (error) {
      console.error('Queue summary error:', error);
      res.status(500).json({ error: 'Failed to retrieve queue metrics' });
    }
  }
);

router.get(
  '/queues/document-ingestion/jobs/:jobId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const job = await ingestionMonitoringService.getJobDetails(req.params.jobId);

      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      res.json({ success: true, data: job });
    } catch (error) {
      console.error('Queue job lookup error:', error);
      res.status(500).json({ error: 'Failed to retrieve job details' });
    }
  }
);

export default router;
