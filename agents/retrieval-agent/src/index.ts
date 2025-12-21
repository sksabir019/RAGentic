import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
const PORT = process.env.AGENT_PORT || 3003;
const AGENT_NAME = 'retrieval-agent';

app.use(express.json({ limit: '50mb' }));

app.get('/health', (req: Request, res: Response): void => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    version: '1.0.0',
    agent: AGENT_NAME,
  });
});

app.get('/ready', (req: Request, res: Response): void => {
  res.json({ ready: true });
});

app.post('/search', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const { payload } = req.body;

    if (!payload?.query || !Array.isArray(payload?.documentIds)) {
      res.status(400).json({
        error: 'Missing query or documentIds in payload',
        metadata: { executionTimeMs: Date.now() - startTime },
      });
      return;
    }

    const { query, documentIds, topK = 10, searchType = 'hybrid' } = payload;

    // Simulate hybrid search (vector + keyword)
    const results = performHybridSearch(query, documentIds, topK, searchType);

    res.json({
      success: true,
      data: {
        query,
        documentIds,
        searchType,
        results,
        totalResults: results.length,
        searchDuration: Date.now() - startTime,
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        agentName: AGENT_NAME,
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SEARCH_FAILED',
        message: (error as Error).message,
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        agentName: AGENT_NAME,
      },
    });
  }
});

app.use((req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Endpoint not found',
  });
});

// ============ Utility Functions ============

function performHybridSearch(
  query: string,
  documentIds: string[],
  topK: number,
  searchType: string
): Array<{
  resultId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  vectorScore: number;
  keywordScore: number;
  hybridScore: number;
  metadata: Record<string, any>;
}> {
  const results = [];
  const limit = Math.min(topK, Math.max(3, documentIds.length * 2));

  for (let i = 0; i < limit; i++) {
    const docId = documentIds[i % documentIds.length];
    const vectorScore = Math.random() * 0.3 + 0.7;
    const keywordScore = Math.random() * 0.3 + 0.6;
    const hybridScore = (vectorScore + keywordScore) / 2;

    results.push({
      resultId: `res_${i}`,
      documentId: docId,
      chunkIndex: i,
      content: `Sample content from document chunk ${i}: This is relevant text that matches the query "${query}". It contains key information...`,
      vectorScore: Number(vectorScore.toFixed(3)),
      keywordScore: Number(keywordScore.toFixed(3)),
      hybridScore: Number(hybridScore.toFixed(3)),
      metadata: {
        pageNumber: Math.floor(i / 2) + 1,
        section: 'Body',
        confidence: Number(hybridScore.toFixed(2)),
      },
    });
  }

  return results.sort((a, b) => b.hybridScore - a.hybridScore);
}

app.listen(PORT, () => {
  console.log(`✓ ${AGENT_NAME} running on http://localhost:${PORT}`);
});

export default app;
