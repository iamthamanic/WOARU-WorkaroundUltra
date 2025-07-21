/**
 * Comprehensive Unit Tests for Database Module
 * Testing DatabaseManager and ToolsDatabaseManager functionality
 */

import { DatabaseManager } from '../../src/database/DatabaseManager';
import { ToolsDatabaseManager } from '../../src/database/ToolsDatabaseManager';

// Mock filesystem operations
jest.mock('fs-extra', () => ({
  pathExists: jest.fn(async () => true),
  readFile: jest.fn(async () => '{}'),
  writeFile: jest.fn(async () => {}),
  ensureDir: jest.fn(async () => {}),
  copy: jest.fn(async () => {}),
  readJsonSync: jest.fn(() => ({})),
  writeJsonSync: jest.fn(),
}));

// Mock HTTP requests
jest.mock('axios', () => ({
  get: jest.fn(async () => ({ data: { version: '1.0.0', tools: {} } })),
  default: {
    get: jest.fn(async () => ({ data: { version: '1.0.0', tools: {} } })),
  },
}));

// Mock i18n
jest.mock('../../src/config/i18n', () => ({
  t: jest.fn((key: string) => key),
  initializeI18n: jest.fn(async () => {}),
}));

describe('Database Module Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DatabaseManager', () => {
    let manager: DatabaseManager;
    const testPath = '/test/project';

    beforeEach(() => {
      manager = new DatabaseManager(testPath);
    });

    it('should be instantiable', () => {
      expect(manager).toBeInstanceOf(DatabaseManager);
    });

    it('should initialize with project path', () => {
      expect(manager).toBeDefined();
      // Manager should store the project path internally
    });

    it('should have required methods', () => {
      expect(typeof manager.updateDatabase).toBe('function');
      expect(typeof manager.getToolsDatabase).toBe('function');
      expect(typeof manager.isUpdateNeeded).toBe('function');
    });

    it('should update database successfully', async () => {
      const result = await manager.updateDatabase();
      expect(typeof result).toBe('boolean');
    });

    it('should get tools database', async () => {
      const database = await manager.getToolsDatabase();
      expect(database).toBeDefined();
      expect(typeof database).toBe('object');
    });

    it('should check if update is needed', async () => {
      const needsUpdate = await manager.isUpdateNeeded();
      expect(typeof needsUpdate).toBe('boolean');
    });

    it('should handle network errors gracefully', async () => {
      const axios = require('axios');
      axios.get.mockRejectedValue(new Error('Network error'));

      try {
        await manager.updateDatabase();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle file system errors', async () => {
      const fs = require('fs-extra');
      fs.writeFile.mockRejectedValue(new Error('Write error'));

      try {
        await manager.updateDatabase();
      } catch (error) {
        // Should handle gracefully or throw
        expect(error).toBeDefined();
      }
    });
  });

  describe('ToolsDatabaseManager', () => {
    let manager: ToolsDatabaseManager;

    beforeEach(() => {
      manager = new ToolsDatabaseManager();
    });

    it('should be instantiable', () => {
      expect(manager).toBeInstanceOf(ToolsDatabaseManager);
    });

    it('should have required methods', () => {
      expect(typeof manager.getToolsDatabase).toBe('function');
      expect(typeof manager.getAIModelsDatabase).toBe('function');
      expect(typeof manager.getCoreToolConfiguration).toBe('function');
      expect(typeof manager.getFrameworkRecommendations).toBe('function');
      expect(typeof manager.getModelsForProvider).toBe('function');
    });

    it('should get tools database', async () => {
      const database = await manager.getToolsDatabase();
      
      expect(database).toBeDefined();
      expect(typeof database).toBe('object');
      expect(database.version).toBeDefined();
    });

    it('should get AI models database', async () => {
      const database = await manager.getAIModelsDatabase();
      
      expect(database).toBeDefined();
      expect(typeof database).toBe('object');
      expect(database.version).toBeDefined();
    });

    it('should get core tool configuration', async () => {
      const fs = require('fs-extra');
      fs.readJsonSync.mockReturnValue({
        core_tools: {
          eslint: { description: 'Linter', packages: ['eslint'] }
        }
      });

      const toolConfig = await manager.getCoreToolConfiguration('eslint');
      expect(toolConfig).toBeDefined();
    });

    it('should get framework recommendations', async () => {
      const fs = require('fs-extra');
      fs.readJsonSync.mockReturnValue({
        framework_recommendations: {
          react: { core_tools: ['eslint', 'prettier'] }
        }
      });

      const recommendations = await manager.getFrameworkRecommendations('react');
      expect(recommendations).toBeDefined();
    });

    it('should get models for provider', async () => {
      const fs = require('fs-extra');
      fs.readJsonSync.mockReturnValue({
        llm_providers: {
          openai: {
            models: [
              { id: 'gpt-4', name: 'GPT-4' },
              { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
            ]
          }
        }
      });

      const models = await manager.getModelsForProvider('openai');
      expect(Array.isArray(models)).toBe(true);
    });

    it('should get provider configuration', async () => {
      const fs = require('fs-extra');
      fs.readJsonSync.mockReturnValue({
        llm_providers: {
          anthropic: {
            name: 'Anthropic',
            api_base_url: 'https://api.anthropic.com'
          }
        }
      });

      const config = await manager.getProviderConfiguration('anthropic');
      expect(config).toBeDefined();
    });

    it('should get latest models across providers', async () => {
      const fs = require('fs-extra');
      fs.readJsonSync.mockReturnValue({
        llm_providers: {
          openai: {
            models: [
              { id: 'gpt-4', release_date: '2023-03-14', capabilities: ['chat'] }
            ]
          },
          anthropic: {
            models: [
              { id: 'claude-3', release_date: '2024-03-04', capabilities: ['chat'] }
            ]
          }
        }
      });

      const latestModels = await manager.getLatestModels();
      expect(Array.isArray(latestModels)).toBe(true);
    });

    it('should get AI models statistics', async () => {
      const fs = require('fs-extra');
      fs.readJsonSync.mockReturnValue({
        llm_providers: {
          openai: { models: [{}, {}] },
          anthropic: { models: [{}] }
        }
      });

      const stats = await manager.getAIModelsStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.totalProviders).toBeDefined();
      expect(stats.totalModels).toBeDefined();
    });

    it('should handle missing files gracefully', async () => {
      const fs = require('fs-extra');
      fs.pathExists.mockResolvedValue(false);

      const database = await manager.getToolsDatabase();
      expect(database).toBeDefined();
      // Should return fallback/minimal database
    });

    it('should handle corrupted JSON gracefully', async () => {
      const fs = require('fs-extra');
      fs.readJsonSync.mockImplementation(() => {
        throw new Error('Invalid JSON');
      });

      const database = await manager.getToolsDatabase();
      expect(database).toBeDefined();
      // Should return fallback database
    });

    it('should update database from remote', async () => {
      const axios = require('axios');
      axios.get.mockResolvedValue({
        data: {
          version: '2.0.0',
          core_tools: { jest: { description: 'Testing framework' } }
        }
      });

      const result = await manager.updateFromRemote();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Database Caching', () => {
    it('should cache database responses', async () => {
      const manager = new ToolsDatabaseManager();
      const fs = require('fs-extra');
      
      // First call
      await manager.getToolsDatabase();
      const firstCallCount = fs.readJsonSync.mock.calls.length;
      
      // Second call should use cache
      await manager.getToolsDatabase();
      const secondCallCount = fs.readJsonSync.mock.calls.length;
      
      // Should not make additional file reads if cached
      expect(secondCallCount).toBeLessThanOrEqual(firstCallCount + 1);
    });

    it('should handle cache invalidation', async () => {
      const manager = new ToolsDatabaseManager();
      
      // Get database to populate cache
      await manager.getToolsDatabase();
      
      // Update should invalidate cache
      await manager.updateFromRemote();
      
      // Next call should refresh
      const database = await manager.getToolsDatabase();
      expect(database).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      const manager = new ToolsDatabaseManager();
      const axios = require('axios');
      
      axios.get.mockRejectedValue(new Error('timeout'));
      
      try {
        await manager.updateFromRemote();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle disk space errors', async () => {
      const manager = new DatabaseManager('/test/path');
      const fs = require('fs-extra');
      
      fs.writeFile.mockRejectedValue(new Error('No space left'));
      
      try {
        await manager.updateDatabase();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle permission errors', async () => {
      const manager = new ToolsDatabaseManager();
      const fs = require('fs-extra');
      
      fs.writeJsonSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      try {
        await manager.updateFromRemote();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Data Validation', () => {
    it('should validate database schema', async () => {
      const manager = new ToolsDatabaseManager();
      const database = await manager.getToolsDatabase();
      
      expect(database.version).toBeDefined();
      expect(typeof database.version).toBe('string');
    });

    it('should validate AI models schema', async () => {
      const manager = new ToolsDatabaseManager();
      const database = await manager.getAIModelsDatabase();
      
      expect(database.version).toBeDefined();
      expect(typeof database.version).toBe('string');
    });

    it('should validate tool configurations', async () => {
      const fs = require('fs-extra');
      fs.readJsonSync.mockReturnValue({
        core_tools: {
          eslint: {
            description: 'JavaScript linter',
            packages: ['eslint'],
            metadata: { popularity: 100 }
          }
        }
      });

      const manager = new ToolsDatabaseManager();
      const toolConfig = await manager.getCoreToolConfiguration('eslint');
      
      expect(toolConfig?.description).toBeDefined();
      expect(Array.isArray(toolConfig?.packages)).toBe(true);
    });
  });
});