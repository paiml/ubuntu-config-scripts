/**
 * Embedding Generator
 *
 * Generates vector embeddings using OpenAI API
 * - Text-to-vector conversion for semantic search
 * - Batch processing support
 * - Automatic retry with exponential backoff
 * - Token usage tracking
 */

export interface EmbeddingConfig {
  apiKey: string;
  model: string;
  dimensions?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
  model: string;
}

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
  usage: { total_tokens: number };
}

export class EmbeddingGenerator {
  private config: EmbeddingConfig;
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000; // ms

  constructor(config: EmbeddingConfig) {
    // Validate configuration
    if (!config.apiKey || config.apiKey.trim() === "") {
      throw new Error("Invalid API key: API key cannot be empty");
    }

    if (!config.model || config.model.trim() === "") {
      throw new Error("Invalid model: model cannot be empty");
    }

    if (config.dimensions !== undefined && config.dimensions <= 0) {
      throw new Error("Invalid dimensions: must be positive");
    }

    this.config = config;
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!text || text.trim() === "") {
      throw new Error("Empty text: text cannot be empty");
    }

    const response = await this.retryWithBackoff(async () => {
      return await this.callOpenAIAPI([text]);
    }, this.maxRetries);

    return {
      embedding: response.data[0]?.embedding || [],
      tokens: response.usage.total_tokens,
      model: this.config.model,
    };
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return [];
    }

    const response = await this.retryWithBackoff(async () => {
      return await this.callOpenAIAPI(texts);
    }, this.maxRetries);

    const tokensPerText = Math.floor(
      response.usage.total_tokens / texts.length
    );

    return response.data.map((item) => ({
      embedding: item.embedding,
      tokens: tokensPerText,
      model: this.config.model,
    }));
  }

  /**
   * Call OpenAI API for embeddings
   */
  private async callOpenAIAPI(
    texts: string[]
  ): Promise<OpenAIEmbeddingResponse> {
    const body: {
      input: string[];
      model: string;
      dimensions?: number;
    } = {
      input: texts,
      model: this.config.model,
    };

    if (this.config.dimensions) {
      body.dimensions = this.config.dimensions;
    }

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      const errorMessage = error.error?.message || "API request failed";

      if (response.status === 429) {
        throw new Error(`Rate limit exceeded: ${errorMessage}`);
      }

      throw new Error(
        `API error (${response.status}): ${errorMessage}`
      );
    }

    return await response.json();
  }

  /**
   * Retry function with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx except 429)
        if (lastError.message.includes("API error") &&
            !lastError.message.includes("429")) {
          throw lastError;
        }

        // Last attempt, don't delay
        if (attempt === maxRetries - 1) {
          break;
        }

        // Exponential backoff
        const delay = this.baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error("Max retries exceeded");
  }
}
