import { Router, Request, Response } from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { QueryHistoryService, ragService, aiService, DocumentService } from '../services';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
const queryHistoryService = new QueryHistoryService();
const documentService = new DocumentService();

interface QueryRequest {
  query: string;
  documentIds?: string[];
  provider?: 'openai' | 'groq';
  model?: string;
}

interface Context {
  userId: string;
  sessionId: string;
  traceId: string;
  timeout: number;
}

// Check if microservices are configured
function useMicroservices(): boolean {
  return !!(
    process.env.QUERY_PARSER_AGENT_URL &&
    process.env.RETRIEVAL_AGENT_URL &&
    process.env.RANKING_AGENT_URL &&
    process.env.GENERATION_AGENT_URL
  );
}

// POST /queries - Main query endpoint with RAG fallback
router.post(
  '/',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    let traceId = uuidv4();
    const traceIdHeader = req.headers['x-trace-id'];
    if (typeof traceIdHeader === 'string') {
      traceId = traceIdHeader;
    } else if (Array.isArray(traceIdHeader) && traceIdHeader.length > 0) {
      traceId = traceIdHeader[0];
    }

    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { query, documentIds, provider, model } = req.body as QueryRequest;

      let filteredDocumentIds: string[] | undefined;

      if (Array.isArray(documentIds) && documentIds.length > 0) {
        const uniqueDocIds = Array.from(new Set(documentIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)));

        if (uniqueDocIds.length === 0) {
          res.status(400).json({ error: 'No valid document IDs provided' });
          return;
        }

        const userDocuments = await documentService.getUserDocumentsByIds(req.userId, uniqueDocIds);

        if (userDocuments.length !== uniqueDocIds.length) {
          res.status(404).json({ error: 'One or more documents not found or unauthorized' });
          return;
        }

        filteredDocumentIds = userDocuments.map((doc) => doc.id);
      }

      // Validate input
      if (!query?.trim()) {
        res.status(400).json({ error: 'Query cannot be empty' });
        return;
      }

      // Use RAG service directly if AI is available and no microservices
      if (!useMicroservices() && aiService.isAvailable()) {
        const result = await ragService.query(req.userId, query, {
          provider,
          model,
          documentIds: filteredDocumentIds,
        });
        const executionTime = Date.now() - startTime;

        // Store in history - convert citations format
        const historyCitations = result.citations.map((c) => ({
          documentId: c.chunkId,
          text: c.text,
          pageNumber: undefined,
        }));

        await queryHistoryService.createQuery(
          req.userId,
          query,
          filteredDocumentIds || [],
          result.response,
          historyCitations,
          result.confidence,
          executionTime
        );

        res.json({
          response: result.response,
          citations: result.citations,
          confidence: result.confidence,
          warning: result.confidence < 0.8 ? 'Lower confidence response' : null,
          metadata: {
            executionTimeMs: executionTime,
            traceId,
          },
        });
        return;
      }

      // If AI not available and no microservices, return error
      if (!useMicroservices()) {
        res.status(503).json({
          error: 'AI service is not configured. Please set OPENAI_API_KEY or GROQ_API_KEY.',
        });
        return;
      }

      // Fall back to microservices pipeline
      if (!filteredDocumentIds || filteredDocumentIds.length === 0) {
        res.status(400).json({ error: 'No documents specified' });
        return;
      }

      const sessionId = uuidv4();

      // Build context
      const context: Context = {
        userId: req.userId,
        sessionId,
        traceId,
        timeout: 30000,
      };

      // Step 1: Parse Query
      const parseResponse = await axios.post(
        `${process.env.QUERY_PARSER_AGENT_URL}/parse`,
        { payload: { query }, context },
        { timeout: 5000 }
      );

      const parsedQuery = parseResponse.data.data.originalQuery;

      // Step 2: Retrieve
      const retrieveResponse = await axios.post(
        `${process.env.RETRIEVAL_AGENT_URL}/search`,
        {
          payload: {
            query: parsedQuery,
            documentIds: filteredDocumentIds,
            topK: 10,
            searchType: 'hybrid',
          },
          context,
        },
        { timeout: 10000 }
      );

      const retrievedChunks = retrieveResponse.data.data.results;

      // Step 3: Rank
      const rankResponse = await axios.post(
        `${process.env.RANKING_AGENT_URL}/rank`,
        {
          payload: { query, documents: retrievedChunks, topK: 5 },
          context,
        },
        { timeout: 5000 }
      );

      const rankedChunks = rankResponse.data.data.rankedDocuments;

      // Step 4: Generate
      const generateResponse = await axios.post(
        `${process.env.GENERATION_AGENT_URL}/generate`,
        {
          payload: {
            query,
            context: rankedChunks,
            style: 'professional',
            includeReferences: true,
          },
          context,
        },
        { timeout: 30000 }
      );

      const generatedResponse = generateResponse.data.data.response;

      // Step 5: Validate
      const validateResponse = await axios.post(
        `${process.env.VALIDATION_AGENT_URL}/validate`,
        {
          payload: {
            query,
            response: generatedResponse,
            context: rankedChunks,
            validationRules: [
              'hallucination_detection',
              'fact_verification',
              'citation_check',
            ],
          },
          context,
        },
        { timeout: 15000 }
      );

      const validation = validateResponse.data.data;
      const executionTime = Date.now() - startTime;

      // Store query history
      const citations = rankedChunks.map(
        (chunk: any) => ({
          documentId: chunk.documentId,
          text: chunk.text,
          pageNumber: chunk.pageNumber,
        })
      );

      await queryHistoryService.createQuery(
        req.userId,
        query,
        filteredDocumentIds || [],
        generatedResponse,
        citations,
        validation.overallScore,
        executionTime
      );

      res.json({
        response: generatedResponse,
        citations,
        confidence: validation.overallScore,
        warning:
          validation.overallScore < 0.8 ? 'Lower confidence response' : null,
        metadata: {
          executionTimeMs: executionTime,
          traceId,
        },
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      console.error('Query processing error:', error.message);

      res.status(500).json({
        error: error.message || 'Query processing failed',
        metadata: {
          executionTimeMs: executionTime,
          traceId,
        },
      });
    }
  }
);

// GET /queries/history
router.get(
  '/history',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const skip = Number(req.query.skip) || 0;
      const take = Number(req.query.take) || 20;

      const queries = await queryHistoryService.getUserQueries(
        req.userId,
        skip,
        take
      );
      const count = await queryHistoryService.getUserQueryCount(req.userId);

      res.json({ queries, total: count });
    } catch (error) {
      console.error('Get history error:', error);
      res.status(500).json({ error: 'Failed to fetch query history' });
    }
  }
);

// GET /queries/:id
router.get(
  '/:id',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const query = await queryHistoryService.getQueryById(req.params.id);

      if (!query) {
        res.status(404).json({ error: 'Query not found' });
        return;
      }

      if (query.userId !== req.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      res.json({ query });
    } catch (error) {
      console.error('Get query error:', error);
      res.status(500).json({ error: 'Failed to fetch query' });
    }
  }
);

// GET /queries/ai/providers - Get available AI providers
router.get(
  '/ai/providers',
  async (_req: Request, res: Response): Promise<void> => {
    try {
      res.json({
        success: true,
        data: {
          providers: aiService.getAvailableProviders(),
          available: aiService.isAvailable(),
          models: {
            openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
            groq: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
          },
        },
      });
    } catch (error) {
      console.error('Providers error:', error);
      res.status(500).json({ error: 'Failed to get providers' });
    }
  }
);

// GET /queries/ai/stats - Get stats about stored documents and chunks
router.get(
  '/ai/stats',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const stats = await ragService.getStats(req.userId);

      res.json({
        success: true,
        data: {
          ...stats,
          aiProviders: aiService.getAvailableProviders(),
          aiAvailable: aiService.isAvailable(),
        },
      });
    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }
);

export default router;
