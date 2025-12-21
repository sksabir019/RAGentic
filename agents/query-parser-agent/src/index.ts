import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
const PORT = process.env.AGENT_PORT || 3002;
const AGENT_NAME = 'query-parser-agent';

app.use(express.json());

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

app.post('/parse', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const { payload } = req.body;

    if (!payload?.query) {
      res.status(400).json({
        error: 'Missing query in payload',
        metadata: { executionTimeMs: Date.now() - startTime },
      });
      return;
    }

    const { query } = payload;

    // Parse query to extract intent and entities
    const intent = extractIntent(query);
    const entities = extractEntities(query);
    const subQueries = generateSubQueries(query, intent);
    const filters = extractFilters(query);

    res.json({
      success: true,
      data: {
        originalQuery: query,
        parsedQuery: query.toLowerCase().trim(),
        intent,
        entities,
        subQueries,
        filters,
        confidence: 0.92,
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        agentName: AGENT_NAME,
      },
    });
  } catch (error) {
    console.error('Parse error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PARSING_FAILED',
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

function extractIntent(query: string): string {
  const lowerQuery = query.toLowerCase();
  if (lowerQuery.includes('define') || lowerQuery.includes('what is')) {
    return 'definition';
  }
  if (lowerQuery.includes('how') || lowerQuery.includes('explain')) {
    return 'explanation';
  }
  if (lowerQuery.includes('list') || lowerQuery.includes('show')) {
    return 'enumeration';
  }
  if (lowerQuery.includes('compare')) {
    return 'comparison';
  }
  return 'information_extraction';
}

function extractEntities(query: string): Array<{ text: string; type: string; confidence: number }> {
  // Simple entity extraction - in production, use NER model
  const entities = [];
  const words = query.split(' ');
  
  for (const word of words) {
    if (word.length > 3 && /^[A-Z]/.test(word)) {
      entities.push({
        text: word,
        type: 'ENTITY',
        confidence: 0.85,
      });
    }
  }

  return entities.slice(0, 3);
}

function generateSubQueries(query: string, intent: string): string[] {
  const subQueries: string[] = [query];

  if (intent === 'definition') {
    subQueries.push(`Explain ${query.replace(/define\s+/i, '')}`, `History of ${query.replace(/define\s+/i, '')}`);
  } else if (intent === 'comparison') {
    subQueries.push(`Differences in ${query}`, `Similarities in ${query}`);
  }

  return subQueries;
}

function extractFilters(query: string): Record<string, any> {
  // Simple filter extraction - in production, use more sophisticated parsing
  const filters: Record<string, any> = {};

  if (query.includes('recent')) {
    filters.timeRange = 'recent';
  }
  if (query.includes('2024')) {
    filters.year = 2024;
  }

  return filters;
}

app.listen(PORT, () => {
  console.log(`✓ ${AGENT_NAME} running on http://localhost:${PORT}`);
});

export default app;
