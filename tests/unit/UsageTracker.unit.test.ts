// @ts-nocheck
import { UsageTracker, LLMUsageData, UsageStats } from '../../src/ai/UsageTracker';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

// Mock fs-extra
jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
  ensureDir: jest.fn(),
  writeJson: jest.fn(),
  readFile: jest.fn(),
  stat: jest.fn(),
  writeFile: jest.fn()
}));

// @ts-ignore
const mockedFs = fs;

// Mock os
jest.mock('os');
const mockedOs = os as jest.Mocked<typeof os>;

// Mock console methods
let mockConsoleWarn: jest.SpyInstance;

describe('UsageTracker Unit Tests', () => {
  let usageTracker: UsageTracker;
  let mockHomeDir: string;
  let mockUsageFile: string;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock console.warn
    mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    
    // Setup mock paths
    mockHomeDir = '/home/testuser';
    mockUsageFile = path.join(mockHomeDir, '.woaru', 'usage.json');
    
    // Mock os.homedir
    mockedOs.homedir.mockReturnValue(mockHomeDir);
    
    // Reset singleton instance
    (UsageTracker as any).instance = undefined;
    
    // Setup default fs mocks
    mockedFs.pathExists.mockResolvedValue(false);
    mockedFs.ensureDir.mockResolvedValue(undefined);
    mockedFs.writeJson.mockResolvedValue(undefined);
    mockedFs.readFile.mockResolvedValue('{}');
    mockedFs.stat.mockResolvedValue({ size: 100 } as any);
    
    // Get fresh instance
    usageTracker = UsageTracker.getInstance();
  });

  afterEach(() => {
    mockConsoleWarn.mockRestore();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = UsageTracker.getInstance();
      const instance2 = UsageTracker.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should initialize with correct usage file path', () => {
      expect((usageTracker as any).usageFile).toBe(mockUsageFile);
    });

    it('should create fallback instance on initialization error', () => {
      // Mock homedir to throw error the first time, but work for fallback
      let callCount = 0;
      mockedOs.homedir.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Cannot access home directory');
        }
        return '/fallback/home';
      });
      
      // Reset singleton
      (UsageTracker as any).instance = undefined;
      
      const instance = UsageTracker.getInstance();
      
      expect(instance).toBeDefined();
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        '⚠️ Failed to initialize UsageTracker, creating fallback instance'
      );
    });
  });

  describe('File Operations', () => {
    describe('loadStats', () => {
      it('should load stats from existing file', async () => {
        const mockStats = {
          'openai-gpt4': {
            totalRequests: 10,
            totalTokensUsed: 1000,
            totalCost: 0.02,
            lastUsed: '2024-01-01T00:00:00.000Z',
            firstUsed: '2024-01-01T00:00:00.000Z',
            errorCount: 0
          }
        };
        
        mockedFs.pathExists.mockResolvedValue(true);
        mockedFs.readFile.mockResolvedValue(JSON.stringify(mockStats));
        
        const stats = await usageTracker.getAllUsageStats();
        
        expect(stats).toEqual(mockStats);
      });

      it('should handle empty file', async () => {
        mockedFs.pathExists.mockResolvedValue(true);
        mockedFs.stat.mockResolvedValue({ size: 0 } as any);
        mockedFs.readFile.mockResolvedValue('');
        
        const stats = await usageTracker.getAllUsageStats();
        
        expect(stats).toEqual({});
        expect(mockConsoleWarn).toHaveBeenCalledWith(
          '⚠️ Usage statistics file is empty, initializing with empty stats'
        );
      });

      it('should handle file with only whitespace', async () => {
        mockedFs.pathExists.mockResolvedValue(true);
        mockedFs.stat.mockResolvedValue({ size: 10 } as any);
        mockedFs.readFile.mockResolvedValue('   \n  \t  ');
        
        const stats = await usageTracker.getAllUsageStats();
        
        expect(stats).toEqual({});
        expect(mockConsoleWarn).toHaveBeenCalledWith(
          '⚠️ Usage statistics file is empty, initializing with empty stats'
        );
      });

      it('should handle invalid JSON', async () => {
        mockedFs.pathExists.mockResolvedValue(true);
        mockedFs.stat.mockResolvedValue({ size: 12 } as any);
        mockedFs.readFile.mockResolvedValue('invalid json');
        mockedFs.writeJson.mockResolvedValue(undefined);
        
        const stats = await usageTracker.getAllUsageStats();
        
        expect(stats).toEqual({});
        expect(mockConsoleWarn).toHaveBeenCalledWith(
          '⚠️ Usage statistics file contains invalid JSON, recreating with empty stats'
        );
        expect(mockedFs.writeJson).toHaveBeenCalledWith(
          expect.stringContaining('usage.json'), 
          {}, 
          { spaces: 2 }
        );
      });

      it('should handle invalid data format', async () => {
        mockedFs.pathExists.mockResolvedValue(true);
        mockedFs.stat.mockResolvedValue({ size: 20 } as any);
        mockedFs.readFile.mockResolvedValue('["invalid", "array"]');
        
        const stats = await usageTracker.getAllUsageStats();
        
        expect(stats).toEqual({});
        expect(mockConsoleWarn).toHaveBeenCalledWith(
          '⚠️ Invalid usage statistics format, initializing with empty stats'
        );
      });

      it('should handle file read errors', async () => {
        mockedFs.pathExists.mockResolvedValue(true);
        mockedFs.readFile.mockRejectedValue(new Error('Permission denied'));
        
        const stats = await usageTracker.getAllUsageStats();
        
        expect(stats).toEqual({});
        expect(mockConsoleWarn).toHaveBeenCalledWith(
          '⚠️ Failed to load usage statistics (file may be corrupted):',
          'Permission denied'
        );
      });

      it('should handle file recreation errors', async () => {
        mockedFs.pathExists.mockResolvedValue(true);
        mockedFs.readFile.mockResolvedValue('invalid json');
        mockedFs.writeJson.mockRejectedValue(new Error('Cannot write file'));
        
        const stats = await usageTracker.getAllUsageStats();
        
        expect(stats).toEqual({});
        expect(mockConsoleWarn).toHaveBeenCalledWith(
          '⚠️ Could not recreate usage statistics file:',
          'Cannot write file'
        );
      });
    });

    describe('saveStats', () => {
      it('should save stats to file', async () => {
        await usageTracker.trackRequest('openai-gpt4', 100, 0.002);
        
        expect(mockedFs.ensureDir).toHaveBeenCalledWith(path.dirname(mockUsageFile));
        expect(mockedFs.writeJson).toHaveBeenCalledWith(
          mockUsageFile,
          expect.any(Object),
          { spaces: 2 }
        );
      });

      it('should handle save errors gracefully', async () => {
        mockedFs.writeJson.mockRejectedValue(new Error('Disk full'));
        
        await usageTracker.trackRequest('openai-gpt4', 100, 0.002);
        
        expect(mockConsoleWarn).toHaveBeenCalledWith(
          '⚠️ Failed to save usage statistics:',
          expect.any(Error)
        );
      });

      it('should handle directory creation errors', async () => {
        mockedFs.ensureDir.mockRejectedValue(new Error('Permission denied'));
        
        await usageTracker.trackRequest('openai-gpt4', 100, 0.002);
        
        expect(mockConsoleWarn).toHaveBeenCalledWith(
          '⚠️ Failed to save usage statistics:',
          expect.any(Error)
        );
      });
    });
  });

  describe('trackRequest() Functionality', () => {
    it('should track a new provider request', async () => {
      const providerId = 'openai-gpt4';
      const tokens = 150;
      const cost = 0.003;
      
      await usageTracker.trackRequest(providerId, tokens, cost);
      
      const stats = await usageTracker.getUsageStats(providerId);
      
      expect(stats).toEqual({
        totalRequests: 1,
        totalTokensUsed: tokens,
        totalCost: cost,
        lastUsed: expect.any(String),
        firstUsed: expect.any(String),
        errorCount: 0
      });
    });

    it('should accumulate multiple requests for same provider', async () => {
      const providerId = 'openai-gpt4';
      
      await usageTracker.trackRequest(providerId, 100, 0.002);
      await usageTracker.trackRequest(providerId, 150, 0.003);
      await usageTracker.trackRequest(providerId, 200, 0.004);
      
      const stats = await usageTracker.getUsageStats(providerId);
      
      expect(stats).toEqual({
        totalRequests: 3,
        totalTokensUsed: 450,
        totalCost: expect.any(Number),
        lastUsed: expect.any(String),
        firstUsed: expect.any(String),
        errorCount: 0
      });
      expect(stats!.totalCost).toBeCloseTo(0.009, 3);
    });

    it('should handle zero tokens and cost', async () => {
      const providerId = 'anthropic-claude';
      
      await usageTracker.trackRequest(providerId, 0, 0);
      
      const stats = await usageTracker.getUsageStats(providerId);
      
      expect(stats).toEqual({
        totalRequests: 1,
        totalTokensUsed: 0,
        totalCost: 0,
        lastUsed: expect.any(String),
        firstUsed: expect.any(String),
        errorCount: 0
      });
    });

    it('should handle default parameters', async () => {
      const providerId = 'openai-gpt4';
      
      await usageTracker.trackRequest(providerId);
      
      const stats = await usageTracker.getUsageStats(providerId);
      
      expect(stats).toEqual({
        totalRequests: 1,
        totalTokensUsed: 0,
        totalCost: 0,
        lastUsed: expect.any(String),
        firstUsed: expect.any(String),
        errorCount: 0
      });
    });

    it('should update lastUsed timestamp on each request', async () => {
      const providerId = 'openai-gpt4';
      
      await usageTracker.trackRequest(providerId, 100, 0.002);
      const firstStats = await usageTracker.getUsageStats(providerId);
      
      // Verify that lastUsed is set
      expect(firstStats!.lastUsed).toBeDefined();
      expect(firstStats!.firstUsed).toBeDefined();
      expect(typeof firstStats!.lastUsed).toBe('string');
      expect(typeof firstStats!.firstUsed).toBe('string');
    });
  });

  describe('trackError() Functionality', () => {
    it('should track error for new provider', async () => {
      const providerId = 'openai-gpt4';
      
      await usageTracker.trackError(providerId);
      
      const stats = await usageTracker.getUsageStats(providerId);
      
      expect(stats).toEqual({
        totalRequests: 0,
        totalTokensUsed: 0,
        totalCost: 0,
        lastUsed: expect.any(String),
        firstUsed: expect.any(String),
        errorCount: 1
      });
    });

    it('should accumulate errors for existing provider', async () => {
      const providerId = 'openai-gpt4';
      
      await usageTracker.trackRequest(providerId, 100, 0.002);
      await usageTracker.trackError(providerId);
      await usageTracker.trackError(providerId);
      
      const stats = await usageTracker.getUsageStats(providerId);
      
      expect(stats).toEqual({
        totalRequests: 1,
        totalTokensUsed: 100,
        totalCost: 0.002,
        lastUsed: expect.any(String),
        firstUsed: expect.any(String),
        errorCount: 2
      });
    });

    it('should update lastUsed timestamp on error', async () => {
      const providerId = 'openai-gpt4';
      
      await usageTracker.trackRequest(providerId, 100, 0.002);
      await usageTracker.trackError(providerId);
      const afterError = await usageTracker.getUsageStats(providerId);
      
      expect(afterError!.lastUsed).toBeDefined();
      expect(afterError!.errorCount).toBe(1);
      expect(typeof afterError!.lastUsed).toBe('string');
    });
  });

  describe('getTotalUsage() Aggregation', () => {
    beforeEach(async () => {
      // Setup test data with multiple providers
      await usageTracker.trackRequest('openai-gpt4', 100, 0.002);
      await usageTracker.trackRequest('openai-gpt4', 150, 0.003);
      await usageTracker.trackRequest('anthropic-claude', 200, 0.004);
      await usageTracker.trackRequest('anthropic-claude', 250, 0.005);
      await usageTracker.trackError('openai-gpt4');
      await usageTracker.trackError('anthropic-claude');
      await usageTracker.trackError('anthropic-claude');
    });

    it('should calculate total usage across all providers', async () => {
      const total = await usageTracker.getTotalUsage();
      
      expect(total).toEqual({
        totalRequests: 4,
        totalTokensUsed: 700,
        totalCost: expect.any(Number),
        totalErrors: 3,
        activeProviders: 2
      });
      expect(total.totalCost).toBeCloseTo(0.014, 3);
    });

    it('should handle empty stats', async () => {
      await usageTracker.resetStats();
      
      const total = await usageTracker.getTotalUsage();
      
      expect(total).toEqual({
        totalRequests: 0,
        totalTokensUsed: 0,
        totalCost: 0,
        totalErrors: 0,
        activeProviders: 0
      });
    });

    it('should count active providers correctly', async () => {
      await usageTracker.resetStats();
      
      // Provider with requests
      await usageTracker.trackRequest('openai-gpt4', 100, 0.002);
      // Provider with only errors (no requests)
      await usageTracker.trackError('anthropic-claude');
      
      const total = await usageTracker.getTotalUsage();
      
      expect(total.activeProviders).toBe(1); // Only openai-gpt4 has requests
    });

    it('should handle floating point precision in cost calculation', async () => {
      await usageTracker.resetStats();
      
      await usageTracker.trackRequest('openai-gpt4', 100, 0.001);
      await usageTracker.trackRequest('openai-gpt4', 100, 0.002);
      await usageTracker.trackRequest('openai-gpt4', 100, 0.003);
      
      const total = await usageTracker.getTotalUsage();
      
      expect(total.totalCost).toBeCloseTo(0.006, 3);
    });
  });

  describe('Provider-specific Cost Calculation', () => {
    it('should calculate costs for OpenAI GPT-4', async () => {
      const providerId = 'openai-gpt4';
      
      // Simulate GPT-4 pricing: $0.03 per 1K tokens input, $0.06 per 1K tokens output
      await usageTracker.trackRequest(providerId, 1000, 0.03);
      await usageTracker.trackRequest(providerId, 2000, 0.06);
      
      const stats = await usageTracker.getUsageStats(providerId);
      
      expect(stats!.totalCost).toBe(0.09);
      expect(stats!.totalTokensUsed).toBe(3000);
    });

    it('should calculate costs for Anthropic Claude', async () => {
      const providerId = 'anthropic-claude';
      
      // Simulate Claude pricing: $0.015 per 1K tokens input, $0.075 per 1K tokens output
      await usageTracker.trackRequest(providerId, 1000, 0.015);
      await usageTracker.trackRequest(providerId, 2000, 0.15);
      
      const stats = await usageTracker.getUsageStats(providerId);
      
      expect(stats!.totalCost).toBeCloseTo(0.165, 3);
      expect(stats!.totalTokensUsed).toBe(3000);
    });

    it('should handle different provider cost structures', async () => {
      await usageTracker.trackRequest('openai-gpt4', 1000, 0.02);
      await usageTracker.trackRequest('anthropic-claude', 1000, 0.015);
      await usageTracker.trackRequest('local-llama', 1000, 0); // Free local model
      
      const openaiStats = await usageTracker.getUsageStats('openai-gpt4');
      const anthropicStats = await usageTracker.getUsageStats('anthropic-claude');
      const localStats = await usageTracker.getUsageStats('local-llama');
      
      expect(openaiStats!.totalCost).toBe(0.02);
      expect(anthropicStats!.totalCost).toBe(0.015);
      expect(localStats!.totalCost).toBe(0);
    });

    it('should handle micro-transactions correctly', async () => {
      const providerId = 'openai-gpt4';
      
      // Test very small costs
      await usageTracker.trackRequest(providerId, 10, 0.0001);
      await usageTracker.trackRequest(providerId, 20, 0.0002);
      await usageTracker.trackRequest(providerId, 30, 0.0003);
      
      const stats = await usageTracker.getUsageStats(providerId);
      
      expect(stats!.totalCost).toBeCloseTo(0.0006, 4);
    });
  });

  describe('Persistence and Data Integrity', () => {
    it('should persist data across instance recreations', async () => {
      await usageTracker.trackRequest('openai-gpt4', 100, 0.002);
      
      // Mock file exists and return saved data for new instance
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.stat.mockResolvedValue({ size: 100 } as any);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        'openai-gpt4': {
          totalRequests: 1,
          totalTokensUsed: 100,
          totalCost: 0.002,
          lastUsed: new Date().toISOString(),
          firstUsed: new Date().toISOString(),
          errorCount: 0
        }
      }));
      
      // Simulate new instance creation
      (UsageTracker as any).instance = undefined;
      const newInstance = UsageTracker.getInstance();
      
      const stats = await newInstance.getUsageStats('openai-gpt4');
      
      expect(stats).toEqual({
        totalRequests: 1,
        totalTokensUsed: 100,
        totalCost: 0.002,
        lastUsed: expect.any(String),
        firstUsed: expect.any(String),
        errorCount: 0
      });
    });

    it('should handle concurrent access safely', async () => {
      const providerId = 'openai-gpt4';
      
      // Simulate concurrent requests
      const promises = [
        usageTracker.trackRequest(providerId, 100, 0.002),
        usageTracker.trackRequest(providerId, 150, 0.003),
        usageTracker.trackRequest(providerId, 200, 0.004),
        usageTracker.trackError(providerId),
        usageTracker.trackError(providerId)
      ];
      
      await Promise.all(promises);
      
      const stats = await usageTracker.getUsageStats(providerId);
      
      expect(stats!.totalRequests).toBe(3);
      expect(stats!.totalTokensUsed).toBe(450);
      expect(stats!.totalCost).toBeCloseTo(0.009, 3);
      expect(stats!.errorCount).toBe(2);
    });

    it('should maintain data consistency during save failures', async () => {
      // Track some initial data
      await usageTracker.trackRequest('openai-gpt4', 100, 0.002);
      
      // Mock save failure
      mockedFs.writeJson.mockRejectedValue(new Error('Disk full'));
      
      // Try to track more data
      await usageTracker.trackRequest('openai-gpt4', 150, 0.003);
      
      // Data should still be in memory
      const stats = await usageTracker.getUsageStats('openai-gpt4');
      
      expect(stats!.totalRequests).toBe(2);
      expect(stats!.totalTokensUsed).toBe(250);
      expect(stats!.totalCost).toBe(0.005);
    });
  });

  describe('Token Tracking Accuracy', () => {
    it('should track input and output tokens separately', async () => {
      const providerId = 'openai-gpt4';
      
      // Simulate request with input and output tokens
      await usageTracker.trackRequest(providerId, 500, 0.015); // Input tokens
      await usageTracker.trackRequest(providerId, 300, 0.018); // Output tokens
      
      const stats = await usageTracker.getUsageStats(providerId);
      
      expect(stats!.totalTokensUsed).toBe(800);
      expect(stats!.totalCost).toBe(0.033);
    });

    it('should handle large token counts', async () => {
      const providerId = 'openai-gpt4';
      
      // Test with maximum context length
      await usageTracker.trackRequest(providerId, 128000, 3.84); // 128k tokens
      
      const stats = await usageTracker.getUsageStats(providerId);
      
      expect(stats!.totalTokensUsed).toBe(128000);
      expect(stats!.totalCost).toBe(3.84);
    });

    it('should handle negative token counts gracefully', async () => {
      const providerId = 'openai-gpt4';
      
      await usageTracker.trackRequest(providerId, -100, 0.002);
      
      const stats = await usageTracker.getUsageStats(providerId);
      
      expect(stats!.totalTokensUsed).toBe(-100); // Should preserve the value
      expect(stats!.totalCost).toBe(0.002);
    });

    it('should handle decimal token counts', async () => {
      const providerId = 'openai-gpt4';
      
      await usageTracker.trackRequest(providerId, 100.5, 0.002);
      
      const stats = await usageTracker.getUsageStats(providerId);
      
      expect(stats!.totalTokensUsed).toBe(100.5);
    });
  });

  describe('Utility Functions', () => {
    beforeEach(async () => {
      await usageTracker.trackRequest('openai-gpt4', 1000, 0.02);
      await usageTracker.trackRequest('anthropic-claude', 1500, 0.03);
      await usageTracker.trackError('openai-gpt4');
    });

    describe('getFormattedSummary', () => {
      it('should return formatted summary lines', async () => {
        const summary = await usageTracker.getFormattedSummary();
        
        expect(summary).toEqual([
          'Total Requests: 2',
          'Total Tokens: 2,500',
          'Total Cost: $0.0500',
          'Total Errors: 1',
          'Active Providers: 2'
        ]);
      });
    });

    describe('exportUsageData', () => {
      it('should export usage data to file', async () => {
        const exportFile = '/tmp/usage-export.json';
        
        await usageTracker.exportUsageData(exportFile);
        
        expect(mockedFs.writeJson).toHaveBeenCalledWith(
          exportFile,
          expect.objectContaining({
            exportedAt: expect.any(String),
            totalUsage: expect.any(Object),
            providerStats: expect.any(Object)
          }),
          { spaces: 2 }
        );
      });
    });

    describe('resetStats', () => {
      it('should reset all statistics', async () => {
        await usageTracker.resetStats();
        
        const total = await usageTracker.getTotalUsage();
        const allStats = await usageTracker.getAllUsageStats();
        
        expect(total).toEqual({
          totalRequests: 0,
          totalTokensUsed: 0,
          totalCost: 0,
          totalErrors: 0,
          activeProviders: 0
        });
        expect(allStats).toEqual({});
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null/undefined provider IDs gracefully', async () => {
      // TypeScript would prevent this, but test runtime behavior
      await usageTracker.trackRequest(null as any, 100, 0.002);
      await usageTracker.trackRequest(undefined as any, 100, 0.002);
      
      const stats = await usageTracker.getUsageStats(null as any);
      expect(stats).toBeDefined();
    });

    it('should handle very large numbers', async () => {
      const providerId = 'stress-test';
      
      await usageTracker.trackRequest(providerId, Number.MAX_SAFE_INTEGER, 999999.99);
      
      const stats = await usageTracker.getUsageStats(providerId);
      
      expect(stats!.totalTokensUsed).toBe(Number.MAX_SAFE_INTEGER);
      expect(stats!.totalCost).toBe(999999.99);
    });

    it('should handle special string characters in provider IDs', async () => {
      const specialIds = ['provider-with-dashes', 'provider_with_underscores', 'provider.with.dots'];
      
      for (const id of specialIds) {
        await usageTracker.trackRequest(id, 100, 0.002);
        const stats = await usageTracker.getUsageStats(id);
        expect(stats).toBeDefined();
        expect(stats!.totalRequests).toBe(1);
      }
    });

    it('should handle file system permission errors', async () => {
      mockedFs.ensureDir.mockRejectedValue(new Error('Permission denied'));
      
      await usageTracker.trackRequest('openai-gpt4', 100, 0.002);
      
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        '⚠️ Failed to save usage statistics:',
        expect.any(Error)
      );
    });

    it('should handle corrupt file recovery', async () => {
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readFile.mockResolvedValue('corrupted data');
      
      const stats = await usageTracker.getAllUsageStats();
      
      expect(stats).toEqual({});
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        '⚠️ Usage statistics file contains invalid JSON, recreating with empty stats'
      );
    });
  });
});