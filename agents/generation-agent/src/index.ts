import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
const PORT = process.env.AGENT_PORT || 3005;
const AGENT_NAME = 'generation-agent';

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

app.post('/generate', async (req: Request, res: Response): Promise<void> => {
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

    const {
      query,
      context: contextChunks = [],
      style = 'professional',
      includeReferences = true,
    } = payload;

    // Generate response based on context
    const response = generateResponse(query, contextChunks, style);
    const references = includeReferences
      ? contextChunks.map((chunk: any, idx: number) => ({
          documentId: chunk.documentId || `doc_${idx}`,
          chunkIndex: chunk.chunkIndex ?? idx,
          text: chunk.content?.substring(0, 200) || 'Reference text',
          pageNumber: chunk.metadata?.pageNumber,
          source: chunk.metadata?.fileName || 'Unknown source',
        }))
      : [];

    res.json({
      success: true,
      data: {
        response,
        references,
        stats: {
          inputTokens: estimateTokens(query),
          outputTokens: estimateTokens(response),
          model: 'gpt-4-turbo',
          temperature: 0.7,
        },
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        agentName: AGENT_NAME,
      },
    });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GENERATION_FAILED',
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

function generateResponse(query: string, contextChunks: any[], style: string): string {
  if (contextChunks.length === 0) {
    return `I don't have enough information to answer your question about "${query}". Please provide relevant context.`;
  }

  const contextSummary = contextChunks
    .slice(0, 3)
    .map((chunk: any) => chunk.content || 'context')
    .join(' ');

  let response = '';

  if (style === 'professional') {
    response = `Regarding your inquiry about "${query}":\n\n`;
    response += `Based on the provided context, here is a comprehensive analysis:\n\n`;
    response += `${contextSummary.substring(0, 300)}...\n\n`;
    response += `This information directly addresses the key aspects of your question. The evidence suggests several important considerations for understanding this topic.`;
  } else if (style === 'casual') {
    response = `So, you asked about "${query}"?\n\n`;
    response += `Here's what I found: ${contextSummary.substring(0, 200)}...\n\n`;
    response += `Basically, that's the gist of it!`;
  } else {
    response = `Query: "${query}"\n\n`;
    response += `Response: ${contextSummary.substring(0, 250)}...`;
  }

  return response;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

app.listen(PORT, () => {
  console.log(`✓ ${AGENT_NAME} running on http://localhost:${PORT}`);
});

export default app;
