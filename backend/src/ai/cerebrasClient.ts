import Cerebras from "@cerebras/cerebras_cloud_sdk";

type ChatCompletionLike = {
  choices: {
    message?: {
      content?: string;
    };
    delta?: {
      content?: string;
    };
  }[];
};

/**
 * Cerebras Client - Wrapper for Cerebras Cloud SDK
 *
 * Why Cerebras?
 * - World's fastest AI inference (1000+ tokens/sec)
 * - Perfect for real-time test generation
 * - 100x faster than GPT-4
 *
 * This class handles all AI completions with error handling and streaming
 */
export class CerebrasClient {
  private client: Cerebras;
  private model: string;
  private maxRetries: number;

  constructor() {
    const apiKey = process.env.CEREBRAS_API_KEY;

    if (!apiKey) {
      throw new Error("CEREBRAS_API_KEY environment variable is required");
    }

    this.client = new Cerebras({ apiKey });
    this.model = process.env.CEREBRAS_MODEL || "llama3.1-70b";
    this.maxRetries = 3;

    console.log("✅ Cerebras client initialized with model:", this.model);
  }

  //* Single completion - Get AI response in one go
  //* Use for: Test generation, analysis, any non-streaming needs
  async complete(
    prompt: string,
    maxTokens: number = 2000,
    temperature: number = 0.7
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(
          `🧠 Cerebras request (attempt ${attempt}/${this.maxRetries})...`
        );

        const startTime = Date.now();

        const response = (await this.client.chat.completions.create({
          model: this.model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature: temperature,
          stream: false,
        })) as unknown as ChatCompletionLike;

        const duration = Date.now() - startTime;
        const content = response.choices[0]?.message?.content || "";

        console.log(
          `✅ Cerebras response received in ${duration}ms (${content.length} chars)`
        );

        return content;
      } catch (error: any) {
        lastError = error;
        console.error(`❌ Cerebras attempt ${attempt} failed:`, error.message);

        if (attempt < this.maxRetries) {
          const backoff = Math.pow(2, attempt) * 1000; //* Exponential backoff
          console.log(`⏳ Retrying in ${backoff}ms...`);
          await this.sleep(backoff);
        }
      }
    }

    throw new Error(
      `Cerebras API failed after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  //* Streaming completion - Get AI response token by token
  //* Use for: Real-time UI updates, analysis streaming
  async *streamComplete(
    prompt: string,
    maxTokens: number = 2000
  ): AsyncGenerator<string> {
    try {
      console.log("🧠 Cerebras streaming request...");

      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7,
        stream: true,
      });

      let totalTokens = 0;

      for await (const chunk of stream) {
        const content = (chunk as ChatCompletionLike).choices[0]?.delta
          ?.content;
        if (content) {
          totalTokens++;
          yield content;
        }
      }

      console.log(`✅ Cerebras stream complete (${totalTokens} tokens)`);
    } catch (error: any) {
      console.error("❌ Cerebras streaming error:", error);
      throw new Error(`Streaming failed: ${error.message}`);
    }
  }

  //* JSON completion - Ensure AI returns valid JSON
  //* Use for: Structured data like test cases, analysis results
  async completeJSON<T = any>(
    prompt: string,
    maxTokens: number = 3000
  ): Promise<T> {
    //* Enhanced prompt to ensure JSON output
    const jsonPrompt = `${prompt}

CRITICAL: Your response MUST be valid JSON only. No explanations, no markdown, no code blocks.
Start directly with { and end with }. The JSON must be parseable.`;

    const response = await this.complete(jsonPrompt, maxTokens, 0.5); //* Lower temp for JSON

    try {
      //* Clean response - remove markdown code blocks if present
      let cleaned = response.trim();
      cleaned = cleaned
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      //* Parse JSON
      const parsed = JSON.parse(cleaned);
      return parsed as T;
    } catch (error: any) {
      console.error("❌ Failed to parse JSON from Cerebras:", response);
      throw new Error(`Invalid JSON response: ${error.message}`);
    }
  }

  //* Batch completions - Process multiple prompts efficiently
  //* Use for: Generating tests for multiple endpoints
  async batchComplete(
    prompts: string[],
    maxTokens: number = 2000
  ): Promise<string[]> {
    console.log(`🧠 Processing batch of ${prompts.length} prompts...`);

    const results = await Promise.all(
      prompts.map((prompt) => this.complete(prompt, maxTokens))
    );

    console.log(`✅ Batch complete: ${results.length} responses`);
    return results;
  }

  //* Health check - Verify Cerebras API is accessible
  async healthCheck(): Promise<boolean> {
    try {
      await this.complete("Reply with OK", 10);
      return true;
    } catch (error) {
      console.error("❌ Cerebras health check failed:", error);
      return false;
    }
  }

  //* Get model info
  getModelInfo(): { model: string; provider: string } {
    return {
      model: this.model,
      provider: "Cerebras Cloud",
    };
  }

  //* Utility: Sleep function for retries
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  //* Estimate tokens (rough approximation)
  //* 1 token ≈ 4 characters for English text
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  //* Validate prompt size
  validatePrompt(prompt: string, maxTokens: number = 8000): boolean {
    const estimatedTokens = this.estimateTokens(prompt);
    if (estimatedTokens > maxTokens) {
      console.warn(
        `⚠️ Prompt too long: ${estimatedTokens} tokens (max: ${maxTokens})`
      );
      return false;
    }
    return true;
  }
}

//* Singleton instance
export const cerebrasClient = new CerebrasClient();
