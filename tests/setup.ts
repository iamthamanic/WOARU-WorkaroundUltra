import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// Global test setup
beforeEach(() => {
  // Clear any environment variables that might affect tests
  delete process.env.WOARU_DEBUG;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.GOOGLE_AI_API_KEY;
});

afterEach(() => {
  // Clean up any test artifacts
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidJSON(): R;
      toContainAIProvider(provider: string): R;
    }
  }
}

// Custom matchers
expect.extend({
  toBeValidJSON(received: string) {
    try {
      JSON.parse(received);
      return {
        message: () => `Expected ${received} not to be valid JSON`,
        pass: true,
      };
    } catch (error) {
      return {
        message: () => `Expected ${received} to be valid JSON but got error: ${error}`,
        pass: false,
      };
    }
  },
  
  toContainAIProvider(received: any, provider: string) {
    const hasProvider = received.llm_providers && received.llm_providers[provider];
    return {
      message: () => hasProvider 
        ? `Expected AI models database not to contain provider ${provider}`
        : `Expected AI models database to contain provider ${provider}`,
      pass: !!hasProvider,
    };
  },
});

// Test helper functions
export const createTempDir = async (): Promise<string> => {
  const tempDir = path.join(os.tmpdir(), 'woaru-test-' + Date.now());
  await fs.ensureDir(tempDir);
  return tempDir;
};

export const cleanupTempDir = async (tempDir: string): Promise<void> => {
  if (await fs.pathExists(tempDir)) {
    await fs.remove(tempDir);
  }
};

export const createMockEnvFile = async (tempDir: string, content: string): Promise<string> => {
  const envPath = path.join(tempDir, '.env');
  await fs.writeFile(envPath, content);
  return envPath;
};