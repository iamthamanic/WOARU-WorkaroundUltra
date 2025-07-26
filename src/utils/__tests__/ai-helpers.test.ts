import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import chalk from 'chalk';

// Mock dependencies
jest.mock('chalk', () => ({
  red: jest.fn((text: string) => text),
  yellow: jest.fn((text: string) => text),
  cyan: jest.fn((text: string) => text),
  gray: jest.fn((text: string) => text),
}));

jest.mock('../config/ConfigManager', () => ({
  ConfigManager: {
    getInstance: jest.fn(() => ({
      loadAiConfig: jest.fn(),
      hasApiKey: jest.fn(),
    })),
  },
}));

jest.mock('../config/i18n', () => ({
  t: jest.fn((key: string, params?: any) => {
    const translations: Record<string, string> = {
      'ai_helpers.config_check_error': 'Error checking AI configuration:',
      'ai_helpers.config_missing_error': 'Error: This feature requires an active and correctly configured AI.',
      'ai_helpers.config_setup_hint': 'Please first set up an AI provider with the command: woaru ai setup',
      'ai_helpers.config_loading_error': 'Warning: Error loading AI providers:',
      'ai_helpers.validation_failed': 'AI provider validation failed for: {{provider}}',
      'ai_helpers.no_active_providers': 'No active AI providers found',
      'ai_helpers.provider_disabled': 'AI provider {{provider}} is disabled',
      'ai_helpers.invalid_provider_id': 'Invalid provider ID: {{provider}}',
      'ai_helpers.api_key_missing_for_provider': 'API key missing for provider: {{provider}}',
      'ai_helpers.configuration_validation_passed': 'AI configuration validation passed',
      'ai_helpers.graceful_shutdown': 'Shutting down gracefully due to AI configuration error',
    };
    
    let result = translations[key] || key;
    
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        result = result.replace(`{{${paramKey}}}`, String(value));
      });
    }
    
    return result;
  }),
  initializeI18n: jest.fn(),
}));

import {
  ensureAiIsConfigured,
  validateAiProvider,
  getActiveAiProviders,
  checkAiAvailability,
  ActiveProvider
} from '../ai-helpers';

import { ConfigManager } from '../../config/ConfigManager';
import { t, initializeI18n } from '../../config/i18n';

describe('ai-helpers - Production Quality Tests', () => {
  let mockConfigManager: any;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    // Setup console spies
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    
    // Setup mock config manager
    mockConfigManager = {
      loadAiConfig: jest.fn(),
      hasApiKey: jest.fn(),
    };
    ConfigManager.getInstance.mockReturnValue(mockConfigManager);
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock returns
    initializeI18n.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  describe('ensureAiIsConfigured', () => {
    it('should pass validation with properly configured AI', async () => {
      // Arrange
      const validConfig = {
        openai: { enabled: true, model: 'gpt-4' },
        anthropic: { enabled: false, model: 'claude-3' },
        lastDataUpdate: '2024-01-01',
      };
      
      mockConfigManager.loadAiConfig.mockResolvedValue(validConfig);
      mockConfigManager.hasApiKey.mockResolvedValue(true);

      // Act & Assert
      await expect(ensureAiIsConfigured()).resolves.not.toThrow();
      expect(initializeI18n).toHaveBeenCalled();
      expect(mockConfigManager.loadAiConfig).toHaveBeenCalled();
    });

    it('should throw AiConfigurationError when no config exists', async () => {
      // Arrange
      mockConfigManager.loadAiConfig.mockResolvedValue(null);

      // Act & Assert
      await expect(ensureAiIsConfigured()).rejects.toThrow('Error: This feature requires an active and correctly configured AI.');
    });

    it('should throw AiConfigurationError when config is empty', async () => {
      // Arrange
      mockConfigManager.loadAiConfig.mockResolvedValue({ lastDataUpdate: '2024-01-01' });

      // Act & Assert
      await expect(ensureAiIsConfigured()).rejects.toThrow('No active AI providers found');
    });

    it('should throw AiConfigurationError when no providers are enabled', async () => {
      // Arrange
      const configWithDisabledProviders = {
        openai: { enabled: false, model: 'gpt-4' },
        anthropic: { enabled: false, model: 'claude-3' },
      };
      
      mockConfigManager.loadAiConfig.mockResolvedValue(configWithDisabledProviders);

      // Act & Assert
      await expect(ensureAiIsConfigured()).rejects.toThrow('No active AI providers found');
    });

    it('should throw AiConfigurationError when no API keys are available', async () => {
      // Arrange
      const validConfig = {
        openai: { enabled: true, model: 'gpt-4' },
      };
      
      mockConfigManager.loadAiConfig.mockResolvedValue(validConfig);
      mockConfigManager.hasApiKey.mockResolvedValue(false);

      // Act & Assert
      await expect(ensureAiIsConfigured()).rejects.toThrow();
    });

    it('should handle malicious provider IDs safely', async () => {
      // Arrange
      const maliciousConfig = {
        '<script>alert("xss")</script>': { enabled: true, model: 'gpt-4' },
        '../../etc/passwd': { enabled: true, model: 'claude-3' },
        'normal_provider': { enabled: true, model: 'gemini' },
      };
      
      mockConfigManager.loadAiConfig.mockResolvedValue(maliciousConfig);
      mockConfigManager.hasApiKey.mockImplementation((id: string) => 
        Promise.resolve(id === 'normal_provider')
      );

      // Act & Assert
      await expect(ensureAiIsConfigured()).resolves.not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid provider ID')
      );
    });
  });

  describe('validateAiProvider', () => {
    it('should validate correct provider configuration', async () => {
      // Arrange
      const validProvider = { enabled: true, model: 'gpt-4' };
      mockConfigManager.hasApiKey.mockResolvedValue(true);

      // Act
      const result = await validateAiProvider('openai', validProvider);

      // Assert
      expect(result).toBe(true);
      expect(mockConfigManager.hasApiKey).toHaveBeenCalledWith('openai');
    });

    it('should reject disabled providers', async () => {
      // Arrange
      const disabledProvider = { enabled: false, model: 'gpt-4' };

      // Act
      const result = await validateAiProvider('openai', disabledProvider);

      // Assert
      expect(result).toBe(false);
    });

    it('should reject invalid provider configurations', async () => {
      // Arrange
      const invalidProviders = [
        null,
        undefined,
        'string',
        123,
        [],
        { enabled: 'true' }, // enabled should be boolean
        { model: 'gpt-4' }, // missing enabled
      ];

      for (const provider of invalidProviders) {
        // Act
        const result = await validateAiProvider('test', provider);

        // Assert
        expect(result).toBe(false);
      }
    });

    it('should sanitize malicious provider IDs', async () => {
      // Arrange
      const validProvider = { enabled: true, model: 'gpt-4' };
      const maliciousIds = [
        '<script>alert("xss")</script>',
        '../../etc/passwd',
        'provider; rm -rf /',
        null,
        undefined,
        123,
      ];

      for (const id of maliciousIds) {
        // Act
        const result = await validateAiProvider(id, validProvider);

        // Assert
        expect(result).toBe(false);
      }
    });

    it('should handle API key check failures gracefully', async () => {
      // Arrange
      const validProvider = { enabled: true, model: 'gpt-4' };
      mockConfigManager.hasApiKey.mockRejectedValue(new Error('API key check failed'));

      // Act
      const result = await validateAiProvider('openai', validProvider);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getActiveAiProviders', () => {
    it('should return active providers with proper typing', async () => {
      // Arrange
      const validConfig = {
        openai: { enabled: true, model: 'gpt-4' },
        anthropic: { enabled: false, model: 'claude-3' },
        gemini: { enabled: true, model: 'gemini-pro' },
      };
      
      mockConfigManager.loadAiConfig.mockResolvedValue(validConfig);
      mockConfigManager.hasApiKey.mockImplementation((id: string) => 
        Promise.resolve(['openai', 'gemini'].includes(id))
      );

      // Act
      const result = await getActiveAiProviders();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('provider');
      expect(result[0].provider).toHaveProperty('enabled', true);
    });

    it('should handle empty configuration gracefully', async () => {
      // Arrange
      mockConfigManager.loadAiConfig.mockResolvedValue(null);

      // Act
      const result = await getActiveAiProviders();

      // Assert
      expect(result).toEqual([]);
    });

    it('should filter out invalid providers', async () => {
      // Arrange
      const mixedConfig = {
        valid_provider: { enabled: true, model: 'gpt-4' },
        '<script>': { enabled: true, model: 'malicious' },
        invalid_config: null,
        disabled_provider: { enabled: false, model: 'claude-3' },
      };
      
      mockConfigManager.loadAiConfig.mockResolvedValue(mixedConfig);
      mockConfigManager.hasApiKey.mockResolvedValue(true);

      // Act
      const result = await getActiveAiProviders();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('valid_provider');
    });

    it('should handle configuration loading errors', async () => {
      // Arrange
      mockConfigManager.loadAiConfig.mockRejectedValue(new Error('Config load failed'));

      // Act
      const result = await getActiveAiProviders();

      // Assert
      expect(result).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('checkAiAvailability', () => {
    it('should return true when AI is properly configured', async () => {
      // Arrange
      const validConfig = {
        openai: { enabled: true, model: 'gpt-4' },
      };
      
      mockConfigManager.loadAiConfig.mockResolvedValue(validConfig);
      mockConfigManager.hasApiKey.mockResolvedValue(true);

      // Act
      const result = await checkAiAvailability('test-feature');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when AI is not configured', async () => {
      // Arrange
      mockConfigManager.loadAiConfig.mockResolvedValue(null);

      // Act
      const result = await checkAiAvailability('test-feature');

      // Assert
      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('test-feature')
      );
    });

    it('should handle errors gracefully without feature name', async () => {
      // Arrange
      mockConfigManager.loadAiConfig.mockResolvedValue(null);

      // Act
      const result = await checkAiAvailability();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Security Tests', () => {
    it('should sanitize all inputs to prevent injection', async () => {
      // Arrange
      const dangerousInputs = [
        '<script>alert("xss")</script>',
        '"; DROP TABLE users; --',
        '{{constructor.constructor("alert(1)")()}}',
        '../../../etc/passwd',
        'provider; rm -rf /',
      ];

      const validProvider = { enabled: true, model: 'gpt-4' };

      for (const input of dangerousInputs) {
        // Act
        const result = await validateAiProvider(input, validProvider);

        // Assert
        expect(result).toBe(false);
      }
    });

    it('should limit provider ID length to prevent buffer overflow', async () => {
      // Arrange
      const longProviderId = 'a'.repeat(1000);
      const validProvider = { enabled: true, model: 'gpt-4' };
      mockConfigManager.hasApiKey.mockResolvedValue(true);

      // Act
      const result = await validateAiProvider(longProviderId, validProvider);

      // Assert
      expect(result).toBe(true); // Should work but with truncated ID
      expect(mockConfigManager.hasApiKey).toHaveBeenCalledWith('a'.repeat(50));
    });

    it('should validate object types strictly', async () => {
      // Arrange
      const invalidTypes = [
        'string',
        123,
        [],
        null,
        undefined,
        Symbol('test'),
        new Date(),
      ];

      for (const type of invalidTypes) {
        // Act
        const result = await validateAiProvider('test', type);

        // Assert
        expect(result).toBe(false);
      }
    });
  });

  describe('Error Handling', () => {
    it('should provide fallback error messages when i18n fails', async () => {
      // Arrange
      initializeI18n.mockRejectedValue(new Error('i18n failed'));
      mockConfigManager.loadAiConfig.mockResolvedValue(null);

      // Act & Assert
      await expect(ensureAiIsConfigured()).rejects.toThrow();
    });

    it('should handle async validation errors properly', async () => {
      // Arrange
      const validConfig = {
        failing_provider: { enabled: true, model: 'gpt-4' },
      };
      
      mockConfigManager.loadAiConfig.mockResolvedValue(validConfig);
      mockConfigManager.hasApiKey.mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(ensureAiIsConfigured()).rejects.toThrow();
    });
  });
});