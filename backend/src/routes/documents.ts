import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback, StorageEngine } from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { DocumentService, ingestionMonitoringService, ingestionJobService } from '../services';
import { documentIngestionQueue } from '../queues/documentIngestionQueue';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
const documentService = new DocumentService();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage: StorageEngine = multer.diskStorage({
  destination: (
    _req: Express.Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    cb(null, uploadsDir);
  },
  filename: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) => {
    const allowedTypes = ['.pdf', '.txt', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Supported: PDF, TXT, DOC, DOCX'));
    }
  }
});

// Extend Request type to include file
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// POST /documents/upload
router.post(
  '/upload',
  authMiddleware,
  upload.single('file'),
  async (req: MulterRequest, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const { originalname, mimetype, size, filename, path: filePath } = req.file;

      // Create document record
      const document = await documentService.createDocument(
        req.userId,
        filename,
        originalname,
        mimetype,
        size,
        filePath,
        { uploadedAt: new Date().toISOString() }
      );

      // Process document asynchronously (extract text, chunk, generate embeddings)
      const documentId = (document as any)._id?.toString() || (document as any).id;

      const job = await documentIngestionQueue.add('document.ingest', {
        documentId,
        userId: req.userId,
        filename,
        originalName: originalname,
        mimeType: mimetype,
        size,
        filePath,
        metadata: { uploadedAt: new Date().toISOString() },
      });

      await ingestionJobService.createJobRecord({
        documentId,
        userId: req.userId,
        jobId: String(job.id),
        status: 'queued',
        metadata: {
          filename: originalname,
          size,
          mimeType: mimetype,
        },
      });

      const updatedDocument = await documentService.updateDocument(documentId, {
        metadata: {
          ...(document.metadata || {}),
          ingestionJobId: job.id,
        },
      });

      res.status(201).json({ 
        success: true,
        document: updatedDocument,
        data: { chunks: 0, ingestionJobId: job.id }
      });
    } catch (error) {
      console.error('Document upload error:', error);
      res.status(500).json({ error: 'Failed to upload document' });
    }
  }
);

// GET /documents
router.get(
  '/',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const skip = Number(req.query.skip) || 0;
      const take = Number(req.query.take) || 10;

      const documents = await documentService.getUserDocuments(req.userId, skip, take);
      const count = await documentService.getUserDocumentCount(req.userId);

      res.json({ documents, total: count });
    } catch (error) {
      console.error('Get documents error:', error);
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  }
);

// GET /documents/:id
router.get(
  '/:id/status',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const document = await documentService.getDocumentById(req.params.id);

      if (!document) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      if (document.userId !== req.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const ingestionJobId = typeof document.metadata === 'object'
        ? (document.metadata as Record<string, unknown>).ingestionJobId
        : undefined;

      const jobIdString = typeof ingestionJobId === 'string' ? ingestionJobId : undefined;
      const jobDetails = jobIdString
        ? await ingestionMonitoringService.getJobDetails(jobIdString)
        : null;

      res.json({
        success: true,
        data: {
          documentId: document.id,
          processingStatus: document.processingStatus,
          statusMessage: document.statusMessage ?? null,
          chunkCount: document.chunkCount,
          ingestionJobId: jobIdString ?? null,
          ingestionJob: jobDetails,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        },
      });
    } catch (error) {
      console.error('Get document status error:', error);
      res.status(500).json({ error: 'Failed to fetch document status' });
    }
  }
);

router.get(
  '/:id/ingestion-jobs',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const document = await documentService.getDocumentById(req.params.id);

      if (!document) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      if (document.userId !== req.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const jobs = await ingestionJobService.getJobsForDocument(document.id);

      res.json({
        success: true,
        data: jobs,
      });
    } catch (error) {
      console.error('Get ingestion jobs error:', error);
      res.status(500).json({ error: 'Failed to fetch ingestion jobs' });
    }
  }
);

router.post(
  '/:id/reprocess',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const forceFlag = req.body?.force;
      const force = forceFlag === true || forceFlag === 'true';

      const document = await documentService.getDocumentById(req.params.id);

      if (!document) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      if (document.userId !== req.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      if (!force && document.processingStatus === 'processing') {
        res.status(409).json({
          error: 'Document is currently being processed. Retry with force=true to requeue.',
        });
        return;
      }

      if (!document.s3Key) {
        res.status(400).json({ error: 'Document source file is not available for reprocessing.' });
        return;
      }

      if (!fs.existsSync(document.s3Key)) {
        res.status(400).json({ error: 'Original upload file is missing. Please re-upload the document.' });
        return;
      }

      await documentService.updateDocument(document.id, {
        processingStatus: 'pending',
        statusMessage: 'Queued for reprocessing',
      });

      const job = await documentIngestionQueue.add('document.ingest', {
        documentId: document.id,
        userId: req.userId,
        filename: document.filename,
        originalName: document.originalName,
        mimeType: document.mimeType,
        size: Number(document.size),
        filePath: document.s3Key,
        metadata: {
          reprocess: true,
          requestedAt: new Date().toISOString(),
        },
      });

      await ingestionJobService.createJobRecord({
        documentId: document.id,
        userId: req.userId,
        jobId: String(job.id),
        status: 'queued',
        metadata: {
          filename: document.originalName,
          reprocess: true,
        },
      });

      const updated = await documentService.updateDocument(document.id, {
        metadata: {
          ...(document.metadata || {}),
          ingestionJobId: job.id,
        },
      });

      res.status(202).json({
        success: true,
        document: updated,
        data: {
          ingestionJobId: job.id,
          message: 'Document reprocessing queued successfully',
        },
      });
    } catch (error) {
      console.error('Document reprocess error:', error);
      res.status(500).json({ error: 'Failed to reprocess document' });
    }
  }
);

router.get(
  '/:id',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const document = await documentService.getDocumentById(req.params.id);

      if (!document) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      if (document.userId !== req.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      res.json({ document });
    } catch (error) {
      console.error('Get document error:', error);
      res.status(500).json({ error: 'Failed to fetch document' });
    }
  }
);

// GET /documents/:id/chunks
router.get(
  '/:id/chunks',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const document = await documentService.getDocumentById(req.params.id);

      if (!document) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      if (document.userId !== req.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const chunks = await documentService.getDocumentChunks(req.params.id);

      res.json({ chunks });
    } catch (error) {
      console.error('Get chunks error:', error);
      res.status(500).json({ error: 'Failed to fetch chunks' });
    }
  }
);

// DELETE /documents/:id
router.delete(
  '/:id',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const document = await documentService.getDocumentById(req.params.id);

      if (!document) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      if (document.userId !== req.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      await documentService.deleteDocument(req.params.id);

      res.json({ message: 'Document deleted successfully' });
    } catch (error) {
      console.error('Delete document error:', error);
      res.status(500).json({ error: 'Failed to delete document' });
    }
  }
);

export default router;
