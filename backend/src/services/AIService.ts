import OpenAI from 'openai';
import Groq from 'groq-sdk';

export type AIProvider = 'openai' | 'groq';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionOptions {
  provider?: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface EmbeddingOptions {
  model?: string;
}

export class AIService {
  private openai: OpenAI | null = null;
  private groq: Groq | null = null;
  private defaultProvider: AIProvider;

  constructor() {
    // Initialize OpenAI if API key exists
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    // Initialize Groq if API key exists
    if (process.env.GROQ_API_KEY) {
      this.groq = new Groq({
        apiKey: process.env.GROQ_API_KEY,
      });
    }

    // Set default provider: check LLM_PROVIDER env var first, then fall back to available keys
    const envProvider = process.env.LLM_PROVIDER?.toLowerCase() as AIProvider | undefined;
    if (envProvider && (envProvider === 'groq' || envProvider === 'openai')) {
      this.defaultProvider = envProvider;
    } else {
      this.defaultProvider = process.env.GROQ_API_KEY ? 'groq' : 'openai';
    }
    
    console.log(`AI Service initialized with providers: OpenAI=${!!this.openai}, Groq=${!!this.groq}`);
    console.log(`Default provider: ${this.defaultProvider}`);
  }

  /**
   * Generate chat completion using OpenAI or Groq
   */
  async chatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<string> {
    const provider = options.provider || this.defaultProvider;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens ?? 2048;

    if (provider === 'groq' && this.groq) {
      const model = options.model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
      
      const response = await this.groq.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      });

      return response.choices[0]?.message?.content || '';
    }

    if (provider === 'openai' && this.openai) {
      const model = options.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
      
      const response = await this.openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      });

      return response.choices[0]?.message?.content || '';
    }

    throw new Error(`AI provider ${provider} is not configured. Please set the appropriate API key.`);
  }

  /**
   * Generate embeddings using OpenAI
   */
  async generateEmbeddings(
    texts: string[],
    options: EmbeddingOptions = {}
  ): Promise<number[][]> {
    if (!this.openai) {
      throw new Error('OpenAI is not configured. Embeddings require OpenAI API key.');
    }

    const model = options.model || 'text-embedding-3-small';
    
    const response = await this.openai.embeddings.create({
      model,
      input: texts,
    });

    return response.data.map((item) => item.embedding);
  }

  /**
   * Generate a single embedding
   */
  async generateEmbedding(text: string, options: EmbeddingOptions = {}): Promise<number[]> {
    const embeddings = await this.generateEmbeddings([text], options);
    return embeddings[0];
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Check if AI service is available
   */
  isAvailable(): boolean {
    return this.openai !== null || this.groq !== null;
  }

  /**
   * Get default provider
   */
  getDefaultProvider(): AIProvider {
    return this.defaultProvider;
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): AIProvider[] {
    const providers: AIProvider[] = [];
    if (this.openai) providers.push('openai');
    if (this.groq) providers.push('groq');
    return providers;
  }
}

export const aiService = new AIService();
