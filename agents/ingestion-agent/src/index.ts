import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
const PORT = process.env.AGENT_PORT || 3001;
const AGENT_NAME = 'ingestion-agent';

app.use(express.json({ limit: '50mb' }));

// ============ Health Checks ============

app.get('/health', (req: Request, res: Response): void => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    version: '1.0.0',
    agent: AGENT_NAME,
  });
});

app.get('/ready', (req: Request, res: Response): void => {
  res.json({
    ready: true,
    reason: 'All dependencies initialized',
  });
});

// ============ Ingest Endpoint ============

app.post('/ingest', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const { payload } = req.body;

    if (!payload?.documentId) {
      res.status(400).json({
        error: 'Missing documentId in payload',
        metadata: { executionTimeMs: Date.now() - startTime },
      });
      return;
    }

    const { documentId, fileName, fileType, content } = payload;

    // Simulate document processing
    // In production, this would:
    // 1. Download file from S3
    // 2. Extract text based on fileType
    // 3. Split text into overlapping chunks (token-aware)
    // 4. Generate embeddings using OpenAI or other provider
    // 5. Store embeddings in vector database (Pinecone, Weaviate, etc.)

    const chunks = generateChunks(content || `Sample content for ${fileName}`, 512);
    const embeddings = chunks.map((chunk, idx) => ({
      chunkIndex: idx,
      content: chunk,
      embedding: generateMockEmbedding(),
      metadata: {
        fileName,
        chunkSize: chunk.length,
        tokens: estimateTokens(chunk),
      },
    }));

    res.json({
      success: true,
      data: {
        documentId,
        status: 'completed',
        chunksGenerated: chunks.length,
        embeddingsGenerated: embeddings.length,
        chunks: embeddings,
        metadata: {
          fileName,
          fileType,
          totalSize: (content || '').length,
          chunkingStrategy: 'sliding-window',
          embeddingModel: 'text-embedding-3-small',
          totalTokens: embeddings.reduce((sum, e) => sum + (e.metadata.tokens || 0), 0),
        },
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        agentName: AGENT_NAME,
      },
    });
  } catch (error) {
    console.error('Ingestion error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INGESTION_FAILED',
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

// ============ 404 Handler ============

app.use((req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Endpoint not found',
  });
});

// ============ Utility Functions ============

function generateChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
}

function generateMockEmbedding(): number[] {
  return new Array(1536).fill(0).map(() => Math.random());
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ============ Start Server ============

app.listen(PORT, () => {
  console.log(`✓ ${AGENT_NAME} running on http://localhost:${PORT}`);
});

export default app;
