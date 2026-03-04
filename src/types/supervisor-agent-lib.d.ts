/**
 * Type declarations for optional dependency supervisor-agent-lib.
 * When the package is installed, it provides these exports.
 */
declare module 'supervisor-agent-lib' {
  export function initLLMService(deps: {
    config: Array<{ provider: string; apiKey: string; defaultModel?: string; baseUrl?: string }>;
    logger: { info: (m: string) => void; error: (m: string) => void; warn: (m: string) => void; debug: (m: string) => void };
  }): void;
  export function disposeLLMService(): void;
  export class LLMService {
    complete(opts: {
      messages: Array<{ role: string; content: string }>;
      temperature?: number;
      maxTokens?: number;
    }): Promise<{ content: string }>;
  }
}
