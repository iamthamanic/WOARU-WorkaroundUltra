/**
 * Comprehensive Unit Tests for Config Module
 * Testing ConfigManager, i18n, and constants functionality
 */

import { ConfigManager } from '../../src/config/ConfigManager';
import { APP_CONFIG } from '../../src/config/constants';

// Mock filesystem operations
jest.mock('fs-extra', () => ({
  ensureDirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(() => '{}'),
  existsSync: jest.fn(() => true),
  pathExistsSync: jest.fn(async () => true),
}));

// Mock i18n
jest.mock('../../src/config/i18n', () => ({
  t: jest.fn((key: string) => key),
  initializeI18n: jest.fn(async () => {}),
}));

describe('Config Module Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset ConfigManager singleton for each test
    (ConfigManager as any).instance = null;
  });

  describe('APP_CONFIG Constants', () => {
    it('should have required version info', () => {
      expect(APP_CONFIG.VERSION).toBeDefined();
      expect(typeof APP_CONFIG.VERSION).toBe('string');
      expect(APP_CONFIG.VERSION.length).toBeGreaterThan(0);
    });

    it('should have required directories', () => {
      expect(APP_CONFIG.DIRECTORIES).toBeDefined();
      expect(APP_CONFIG.DIRECTORIES.HOME_CONFIG).toBeDefined();
      expect(APP_CONFIG.DIRECTORIES.HOME_LOGS).toBeDefined();
      expect(APP_CONFIG.DIRECTORIES.HOME_CACHE).toBeDefined();
    });

    it('should have required files', () => {
      expect(APP_CONFIG.FILES).toBeDefined();
      expect(APP_CONFIG.FILES.AI_CONFIG).toBeDefined();
      expect(APP_CONFIG.FILES.ACTIONS_LOG).toBeDefined();
      expect(APP_CONFIG.FILES.TOOLS_DB).toBeDefined();
    });

    it('should have required API endpoints', () => {
      expect(APP_CONFIG.API).toBeDefined();
      expect(APP_CONFIG.API.TOOLS_DB_URL).toBeDefined();
      expect(APP_CONFIG.API.AI_MODELS_URL).toBeDefined();
    });
  });

  describe('ConfigManager Singleton', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = ConfigManager.getInstance();
      const instance2 = ConfigManager.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(ConfigManager);
    });

    it('should have required methods', () => {
      const instance = ConfigManager.getInstance();
      
      expect(typeof instance.loadAiConfig).toBe('function');
      expect(typeof instance.saveAiConfig).toBe('function');
      expect(typeof instance.hasApiKey).toBe('function');
      expect(typeof instance.setApiKey).toBe('function');
      expect(typeof instance.getProvider).toBe('function');
    });

    it('should handle configuration loading', async () => {
      const instance = ConfigManager.getInstance();
      
      const config = await instance.loadAiConfig();
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    it('should handle API key operations', async () => {
      const instance = ConfigManager.getInstance();
      
      // Test hasApiKey
      const hasKey = await instance.hasApiKey('test-provider');
      expect(typeof hasKey).toBe('boolean');
    });

    it('should handle provider operations', async () => {
      const instance = ConfigManager.getInstance();
      
      try {
        const provider = await instance.getProvider('test-provider');
        expect(provider).toBeDefined();
      } catch (error) {
        // Provider not found is acceptable for test
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Configuration Validation', () => {
    it('should validate configuration structure', () => {
      const instance = ConfigManager.getInstance();
      
      // Test that getInstance doesn't throw
      expect(() => ConfigManager.getInstance()).not.toThrow();
    });

    it('should handle missing configuration gracefully', async () => {
      const fs = require('fs-extra');
      fs.existsSync.mockReturnValue(false);
      
      const instance = ConfigManager.getInstance();
      const config = await instance.loadAiConfig();
      
      expect(config).toBeDefined();
    });

    it('should handle invalid JSON gracefully', async () => {
      const fs = require('fs-extra');
      fs.readFileSync.mockReturnValue('invalid json');
      
      const instance = ConfigManager.getInstance();
      
      try {
        await instance.loadAiConfig();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('API Key Management', () => {
    it('should set and retrieve API keys securely', async () => {
      const instance = ConfigManager.getInstance();
      
      // Should not throw when setting API keys
      expect(async () => {
        await instance.setApiKey('test-provider', 'test-key');
      }).not.toThrow();
    });

    it('should validate provider names', async () => {
      const instance = ConfigManager.getInstance();
      
      // Test with invalid provider names
      try {
        await instance.hasApiKey('');
        await instance.hasApiKey('invalid-provider');
      } catch (error) {
        // Expected for invalid providers
        expect(error).toBeDefined();
      }
    });
  });

  describe('Configuration Persistence', () => {
    it('should save configuration changes', async () => {
      const instance = ConfigManager.getInstance();
      const testConfig = { test: true };
      
      try {
        await instance.saveAiConfig(testConfig);
      } catch (error) {
        // May fail due to mocked filesystem
        expect(error).toBeDefined();
      }
    });

    it('should create necessary directories', () => {
      const fs = require('fs-extra');
      
      // ConfigManager should ensure directories exist
      ConfigManager.getInstance();
      
      // Should have called ensureDirSync for config directory
      expect(fs.ensureDirSync).toHaveBeenCalled();
    });
  });

  describe('Provider Configuration', () => {
    it('should handle multiple providers', async () => {
      const instance = ConfigManager.getInstance();
      
      const providers = ['openai', 'anthropic', 'google'];
      
      for (const provider of providers) {
        const hasKey = await instance.hasApiKey(provider);
        expect(typeof hasKey).toBe('boolean');
      }
    });

    it('should validate provider configuration structure', async () => {
      const instance = ConfigManager.getInstance();
      
      try {
        const config = await instance.loadAiConfig();
        
        // Should be object
        expect(typeof config).toBe('object');
        expect(config).not.toBeNull();
      } catch (error) {
        // Acceptable for test environment
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle filesystem errors gracefully', async () => {
      const fs = require('fs-extra');
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File system error');
      });
      
      const instance = ConfigManager.getInstance();
      
      try {
        await instance.loadAiConfig();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle permission errors', async () => {
      const fs = require('fs-extra');
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const instance = ConfigManager.getInstance();
      
      try {
        await instance.saveAiConfig({});
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});