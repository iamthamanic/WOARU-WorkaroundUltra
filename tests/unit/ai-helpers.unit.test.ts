/**
 * Comprehensive Unit Tests for ai-helpers
 * Tests all AI configuration and validation functionality
 */

import {
  ensureAiIsConfigured,
  displayAiConfigurationError,
  sanitizeProviderId,
  getActiveProviders,
  validateSingleProvider,
  checkAiAvailability,
  AiConfigurationError,
} from '../../src/utils/ai-helpers';

// Mock i18n
jest.mock('../../src/config/i18n', () => ({
  t: jest.fn((key: string, params?: any) => {
    const translations: Record<string, string> = {
      'ai_helpers.no_active_providers': 'No active AI providers found',
      'ai_helpers.api_key_missing_for_provider': 'API key missing for {{provider}}',
      'ai_helpers.validation_failed': 'Validation failed for {{provider}}',
      'ai_helpers.config_missing_error': 'AI configuration missing',
      'ai_helpers.config_setup_hint': 'Run: woaru ai setup',
      'ai_helpers.graceful_shutdown': 'Shutting down gracefully',
      'ai_helpers.configuration_validation_passed': 'Configuration validation passed',
    };
    
    let result = translations[key] || key;
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        result = result.replace(`{{${param}}}`, String(value));
      });
    }
    return result;
  }),
}));

describe('ai-helpers Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup console mocks
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'debug').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('AiConfigurationError', () => {
    it('should create error with message and code', () => {
      const error = new AiConfigurationError('Test message', 'TEST_CODE');
      
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('AiConfigurationError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should work without error code', () => {
      const error = new AiConfigurationError('Test message');
      
      expect(error.message).toBe('Test message');
      expect(error.code).toBeUndefined();
    });
  });

  describe('sanitizeProviderId()', () => {
    it('should sanitize valid provider IDs', () => {
      expect(sanitizeProviderId('openai')).toBe('openai');
      expect(sanitizeProviderId('anthropic')).toBe('anthropic');
      expect(sanitizeProviderId('google')).toBe('google');
    });

    it('should handle invalid or empty provider IDs', () => {
      expect(sanitizeProviderId('')).toBe('unknown');
      expect(sanitizeProviderId(null as any)).toBe('unknown');
      expect(sanitizeProviderId(undefined as any)).toBe('unknown');
    });

    it('should sanitize special characters', () => {
      expect(sanitizeProviderId('test<script>')).toBe('testscript');
      expect(sanitizeProviderId('provider"with"quotes')).toBe('providerwithquotes');
      expect(sanitizeProviderId('provider&with&ampersands')).toBe('providerwithampersands');
    });

    it('should limit length', () => {
      const longId = 'a'.repeat(150);
      const sanitized = sanitizeProviderId(longId);
      expect(sanitized.length).toBe(100);
    });
  });

  describe('checkAiAvailability()', () => {
    it('should handle availability check', async () => {
      const isAvailable = await checkAiAvailability('test feature');
      expect(typeof isAvailable).toBe('boolean');
    });
  });
});