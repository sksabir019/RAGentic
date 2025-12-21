import fs from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import { aiService } from './AIService';

// Dynamic import for pdf-parse to handle ESM/CJS compatibility
let pdfParse: any = null;
async function loadPdfParse(): Promise<any> {
  if (!pdfParse) {
    try {
      const module = await import('pdf-parse');
      pdfParse = module.default || module;
    } catch {
      console.warn('pdf-parse not available');
    }
  }
  return pdfParse;
}

interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
  metadata: {
    pageNumber?: number;
    chunkIndex: number;
    startChar: number;
    endChar: number;
  };
}

interface ProcessedDocument {
  documentId: string;
  filename: string;
  totalChunks: number;
  chunks: DocumentChunk[];
  extractedText: string;
  pageCount?: number;
}

export class DocumentProcessingService {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(chunkSize = 1000, chunkOverlap = 200) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  /**
   * Extract text from a document based on file type
   */
  async extractText(filePath: string): Promise<{ text: string; pageCount?: number }> {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.pdf':
        return this.extractFromPDF(filePath);
      case '.docx':
      case '.doc':
        return this.extractFromDOCX(filePath);
      case '.txt':
        return this.extractFromTXT(filePath);
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  /**
   * Extract text from PDF
   */
  private async extractFromPDF(filePath: string): Promise<{ text: string; pageCount?: number }> {
    const parser = await loadPdfParse();
    if (!parser) {
      throw new Error('PDF parsing is not available. Please install pdf-parse.');
    }
    
    const dataBuffer = fs.readFileSync(filePath);
    const data = await parser(dataBuffer);
    
    return {
      text: data.text,
      pageCount: data.numpages,
    };
  }

  /**
   * Extract text from DOCX
   */
  private async extractFromDOCX(filePath: string): Promise<{ text: string; pageCount?: number }> {
    const result = await mammoth.extractRawText({ path: filePath });
    return {
      text: result.value,
    };
  }

  /**
   * Extract text from TXT
   */
  private async extractFromTXT(filePath: string): Promise<{ text: string; pageCount?: number }> {
    const text = fs.readFileSync(filePath, 'utf-8');
    return { text };
  }

  /**
   * Split text into overlapping chunks
   */
  chunkText(text: string): Array<{ content: string; startChar: number; endChar: number }> {
    const chunks: Array<{ content: string; startChar: number; endChar: number }> = [];
    
    // Clean text
    const cleanedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (cleanedText.length === 0) {
      return chunks;
    }

    // Split into sentences for better chunking
    const sentences = cleanedText.split(/(?<=[.!?])\s+/);
    
    let currentChunk = '';
    let startChar = 0;
    let currentStartChar = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.chunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          content: currentChunk.trim(),
          startChar: currentStartChar,
          endChar: startChar,
        });

        // Start new chunk with overlap
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.floor(words.length * (this.chunkOverlap / this.chunkSize)));
        currentChunk = overlapWords.join(' ') + ' ' + sentence;
        currentStartChar = startChar - overlapWords.join(' ').length;
      } else {
        if (currentChunk.length === 0) {
          currentStartChar = startChar;
        }
        currentChunk += (currentChunk.length > 0 ? ' ' : '') + sentence;
      }
      startChar += sentence.length + 1;
    }

    // Add remaining chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        startChar: currentStartChar,
        endChar: startChar,
      });
    }

    return chunks;
  }

  /**
   * Process a document: extract text, chunk, and generate embeddings
   */
  async processDocument(
    documentId: string,
    filePath: string,
    filename: string,
    generateEmbeddings = true
  ): Promise<ProcessedDocument> {
    console.log(`Processing document: ${filename}`);

    // Extract text
    const { text, pageCount } = await this.extractText(filePath);
    console.log(`Extracted ${text.length} characters from ${filename}`);

    // Chunk text
    const textChunks = this.chunkText(text);
    console.log(`Created ${textChunks.length} chunks`);

    // Create document chunks
    const chunks: DocumentChunk[] = textChunks.map((chunk, index) => ({
      id: `${documentId}-chunk-${index}`,
      documentId,
      content: chunk.content,
      metadata: {
        chunkIndex: index,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
      },
    }));

    // Generate embeddings if OpenAI is available
    if (generateEmbeddings && aiService.isAvailable() && aiService.getAvailableProviders().includes('openai')) {
      console.log('Generating embeddings...');
      try {
        const embeddings = await aiService.generateEmbeddings(
          chunks.map((c) => c.content)
        );
        
        chunks.forEach((chunk, index) => {
          chunk.embedding = embeddings[index];
        });
        console.log('Embeddings generated successfully');
      } catch (error) {
        console.error('Failed to generate embeddings:', error);
        // Continue without embeddings
      }
    } else {
      console.log('Skipping embeddings (OpenAI not configured)');
    }

    return {
      documentId,
      filename,
      totalChunks: chunks.length,
      chunks,
      extractedText: text,
      pageCount,
    };
  }

  /**
   * Find relevant chunks for a query using embeddings or keyword search
   */
  async findRelevantChunks(
    query: string,
    chunks: DocumentChunk[],
    topK = 5
  ): Promise<Array<DocumentChunk & { similarity: number }>> {
    // Check if embeddings exist
    const hasEmbeddings = chunks.some((c) => c.embedding && c.embedding.length > 0);
    
    if (!hasEmbeddings) {
      // Fallback to keyword matching if no embeddings
      console.log('Using keyword search (no embeddings available)');
      return this.keywordSearch(query, chunks, topK);
    }

    // Try to generate query embedding, fall back to keyword search on error
    try {
      const queryEmbedding = await aiService.generateEmbedding(query);

      // Calculate similarities
      const chunksWithSimilarity = chunks
        .filter((c) => c.embedding && c.embedding.length > 0)
        .map((chunk) => ({
          ...chunk,
          similarity: aiService.cosineSimilarity(queryEmbedding, chunk.embedding!),
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

      return chunksWithSimilarity;
    } catch (error) {
      console.log('Embedding generation failed, falling back to keyword search:', error instanceof Error ? error.message : 'Unknown error');
      return this.keywordSearch(query, chunks, topK);
    }
  }

  /**
   * Simple keyword search fallback
   */
  private keywordSearch(
    query: string,
    chunks: DocumentChunk[],
    topK = 5
  ): Array<DocumentChunk & { similarity: number }> {
    const queryWords = query.toLowerCase().split(/\s+/);
    
    const scored = chunks.map((chunk) => {
      const content = chunk.content.toLowerCase();
      let score = 0;
      
      for (const word of queryWords) {
        if (content.includes(word)) {
          score += 1;
        }
      }
      
      return {
        ...chunk,
        similarity: score / queryWords.length,
      };
    });

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
}

export const documentProcessingService = new DocumentProcessingService();
