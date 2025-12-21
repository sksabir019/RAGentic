import { aiService, AIProvider } from './AIService';
import { documentProcessingService } from './DocumentProcessingService';
import { DocumentService } from './DocumentService';
import { vectorStoreService } from './VectorStoreService';
import { DocumentChunkEntity } from '../database/entities/postgresql';

interface Citation {
  text: string;
  source: string;
  chunkId: string;
  similarity: number;
}

interface RAGResponse {
  response: string;
  citations: Citation[];
  confidence: number;
  model: string;
  provider: AIProvider;
}

export class RAGService {
  private readonly documentService = new DocumentService();

  // Deprecated: retained for backward compatibility with older callers.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  storeChunks(_userId: string, _documentName: string, _chunks: unknown[]): void {
    console.warn('storeChunks is deprecated. Document ingestion is now asynchronous.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getChunks(_userId: string): unknown[] {
    console.warn('getChunks is deprecated. Document chunks are managed via the vector store.');
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  clearDocumentChunks(_userId: string, _documentId: string): void {
    console.warn('clearDocumentChunks is deprecated. Document chunks are managed via the vector store.');
  }

  /**
   * Process a query using RAG
   */
  async query(
    userId: string,
    query: string,
    options: {
      provider?: AIProvider;
      model?: string;
      topK?: number;
      documentIds?: string[];
    } = {}
  ): Promise<RAGResponse> {
    const { provider, model, topK = 5, documentIds } = options;

    const targetDocumentIds = documentIds && documentIds.length > 0
      ? Array.from(new Set(documentIds))
      : undefined;

    const [documentCount, chunkCount] = await Promise.all([
      targetDocumentIds ? targetDocumentIds.length : this.documentService.getUserDocumentCount(userId),
      this.documentService.getUserChunkCount(userId, targetDocumentIds),
    ]);

    if (documentCount === 0) {
      return {
        response: "I don't have any documents to search through. Please upload some documents first.",
        citations: [],
        confidence: 0,
        model: model || 'none',
        provider: provider || 'openai',
      };
    }

    if (chunkCount === 0) {
      const documents = targetDocumentIds
        ? await this.documentService.getUserDocumentsByIds(userId, targetDocumentIds)
        : await this.documentService.getUserDocuments(userId, 0, 50);
      const hasProcessingDocs = documents.some((doc) => doc.processingStatus !== 'ready');

      return {
        response: hasProcessingDocs
          ? 'Your documents are still being processed. Please try again once processing is complete.'
          : "I couldn't find any content to search through. Please re-upload your documents.",
        citations: [],
        confidence: 0,
        model: model || 'none',
        provider: provider || 'openai',
      };
    }

    const preparedChunks = await this.findRelevantChunks(userId, query, topK, targetDocumentIds);

    if (preparedChunks.length === 0 || preparedChunks[0].similarity < 0.1) {
      return {
        response: "I couldn't find any relevant information in your documents for this query.",
        citations: [],
        confidence: 0,
        model: model || 'none',
        provider: provider || 'openai',
      };
    }

    const documentNames = await this.resolveDocumentNames(preparedChunks.map((item) => item.chunk));

    const context = preparedChunks
      .map((chunk, index) => {
        const sourceName = documentNames.get(chunk.chunk.documentId) || chunk.chunk.metadata?.filename || 'Document';
        return `[Source ${index + 1}: ${sourceName}]\n${chunk.chunk.content}`;
      })
      .join('\n\n');

    // Generate response using AI
    const systemPrompt = `You are a helpful AI assistant that answers questions based on the provided document context. 
Always base your answers on the provided context. If the context doesn't contain enough information to answer the question fully, say so.
When referencing information, mention which source it came from (e.g., "According to Source 1...").
Be concise but thorough in your responses.`;

    const userPrompt = `Context from documents:
${context}

Question: ${query}

Please answer the question based on the context provided. If you reference specific information, mention the source number.`;

    // Use provided provider, or default provider from AIService
    const selectedProvider = provider || aiService.getDefaultProvider();
    
    const response = await aiService.chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        provider: selectedProvider,
        model,
        temperature: 0.3,
        maxTokens: 1024,
      }
    );

    // Build citations
    const citations: Citation[] = preparedChunks.map((item) => {
      const chunk = item.chunk;
      const sourceName = documentNames.get(chunk.documentId) || chunk.metadata?.filename || 'Unknown';
      const preview = chunk.content.slice(0, 200);
      return {
        text: preview + (chunk.content.length > 200 ? '...' : ''),
        source: sourceName,
        chunkId: chunk.id,
        similarity: item.similarity,
      };
    });

    const avgSimilarity = preparedChunks.reduce((sum, item) => sum + item.similarity, 0) / preparedChunks.length;
    const confidence = Math.min(avgSimilarity * 1.5, 1); // Scale similarity to confidence

    return {
      response,
      citations,
      confidence,
      model: model || (selectedProvider === 'groq' ? 'llama-3.1-70b-versatile' : 'gpt-4o-mini'),
      provider: selectedProvider,
    };
  }

  /**
   * Get stats about stored chunks
   */
  async getStats(userId: string): Promise<{ totalChunks: number; totalDocuments: number }> {
    const [totalChunks, totalDocuments] = await Promise.all([
      this.documentService.getUserChunkCount(userId),
      this.documentService.getUserDocumentCount(userId),
    ]);

    return {
      totalChunks,
      totalDocuments,
    };
  }

  private async findRelevantChunks(
    userId: string,
    query: string,
    topK: number,
    documentIds?: string[]
  ): Promise<Array<{ chunk: DocumentChunkEntity; similarity: number }>> {
    const results: Array<{ chunk: DocumentChunkEntity; similarity: number }> = [];

    if (vectorStoreService.isEnabled() && aiService.isAvailable()) {
      try {
        const queryEmbedding = await aiService.generateEmbedding(query);
        const matches = await vectorStoreService.queryByEmbedding(userId, queryEmbedding, topK, documentIds);

        if (matches.length > 0) {
          const chunkIds = matches.map((match) => match.documentChunkId);
          const chunks = await this.documentService.getChunksByIds(chunkIds);
          const chunkMap = new Map(chunks.map((chunk) => [chunk.id, chunk]));

          matches.forEach((match) => {
            const chunk = chunkMap.get(match.documentChunkId);
            if (chunk) {
              results.push({ chunk, similarity: match.similarity });
            }
          });
        }
      } catch (error) {
        console.warn('Vector search failed, falling back to keyword search.', error);
      }
    }

    if (results.length > 0) {
      return results;
    }

    const allChunks = await this.documentService.getUserChunks(userId, documentIds);
    if (allChunks.length === 0) {
      return [];
    }

    const prepared = allChunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      content: chunk.content,
      embedding: chunk.embedding,
      metadata: {
        chunkIndex: chunk.chunkIndex,
        startChar: (chunk.metadata as any)?.startChar ?? 0,
        endChar: (chunk.metadata as any)?.endChar ?? chunk.content.length,
      },
    }));

    const keywordResults = await documentProcessingService.findRelevantChunks(
      query,
      prepared as any,
      topK
    );

    const chunkMap = new Map(allChunks.map((chunk) => [chunk.id, chunk]));

    keywordResults.forEach((match) => {
      const chunk = chunkMap.get(match.id);
      if (chunk) {
        results.push({ chunk, similarity: match.similarity });
      }
    });

    return results;
  }

  private async resolveDocumentNames(chunks: DocumentChunkEntity[]): Promise<Map<string, string>> {
    const documentIds = Array.from(new Set(chunks.map((chunk) => chunk.documentId)));
    const nameMap = new Map<string, string>();

    await Promise.all(
      documentIds.map(async (documentId) => {
        const document = await this.documentService.getDocumentById(documentId);
        if (document) {
          nameMap.set(documentId, document.originalName || document.filename);
        }
      })
    );

    return nameMap;
  }
}

export const ragService = new RAGService();
