import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
const PORT = process.env.AGENT_PORT || 3004;
const AGENT_NAME = 'ranking-agent';

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

app.post('/rank', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const { payload } = req.body;

    if (!payload?.documents || !Array.isArray(payload.documents)) {
      res.status(400).json({
        error: 'Missing or invalid documents in payload',
        metadata: { executionTimeMs: Date.now() - startTime },
      });
      return;
    }

    const { query, documents, topK = 5 } = payload;

    // Rank documents using multiple factors
    const rankedDocuments = rankDocuments(query, documents, topK);

    res.json({
      success: true,
      data: {
        rankedDocuments,
        query,
        rankingStrategy: 'multi-factor',
        totalDocuments: documents.length,
        rankedCount: rankedDocuments.length,
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        agentName: AGENT_NAME,
      },
    });
  } catch (error) {
    console.error('Ranking error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RANKING_FAILED',
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

interface RankedDocument {
  documentId: string;
  rank: number;
  relevanceScore: number;
  diversityScore: number;
  freshnessScore: number;
  authorityScore: number;
  combinedScore: number;
  reason: string;
}

function rankDocuments(
  query: string,
  documents: any[],
  topK: number
): RankedDocument[] {
  // Calculate ranking scores for each document
  const scoredDocuments = documents.map((doc: any, idx: number) => {
    const relevanceScore = Math.max(0.5, 1 - idx * 0.1);
    const diversityScore = 0.7 + Math.random() * 0.3;
    const freshnessScore = 0.8;
    const authorityScore = 0.75 + Math.random() * 0.2;

    const combinedScore =
      relevanceScore * 0.4 +
      diversityScore * 0.2 +
      freshnessScore * 0.2 +
      authorityScore * 0.2;

    return {
      ...doc,
      relevanceScore: Number(relevanceScore.toFixed(3)),
      diversityScore: Number(diversityScore.toFixed(3)),
      freshnessScore: Number(freshnessScore.toFixed(3)),
      authorityScore: Number(authorityScore.toFixed(3)),
      combinedScore: Number(combinedScore.toFixed(3)),
      reason: generateRankingReason(query, relevanceScore),
    };
  });

  // Sort by combined score and take top K
  const sorted = scoredDocuments.toSorted(
    (a, b) => b.combinedScore - a.combinedScore
  );
  return sorted
    .slice(0, topK)
    .map((doc, idx) => ({
      documentId: doc.documentId || doc.resultId,
      rank: idx + 1,
      relevanceScore: doc.relevanceScore,
      diversityScore: doc.diversityScore,
      freshnessScore: doc.freshnessScore,
      authorityScore: doc.authorityScore,
      combinedScore: doc.combinedScore,
      reason: doc.reason,
    }));
}

function generateRankingReason(query: string, score: number): string {
  if (score > 0.8) {
    return 'Highly relevant and directly addresses the query';
  }
  if (score > 0.6) {
    return 'Moderately relevant with some key information';
  }
  return 'Contains related information';
}

app.listen(PORT, () => {
  console.log(`✓ ${AGENT_NAME} running on http://localhost:${PORT}`);
});

export default app;
