/**
 * Comprehensive Unit Tests for AIProviderUtils
 * Tests all AI provider functionality for 95%+ coverage
 */

import { AIProviderUtils, AIModel } from '../../src/utils/AIProviderUtils';
import axios from 'axios';
import * as fs from 'fs-extra';
import chalk from 'chalk';

// Mock dependencies
jest.mock('axios');
jest.mock('fs-extra');
jest.mock('chalk', () => ({
  gray: jest.fn((text) => text),
  green: jest.fn((text) => text),
  yellow: jest.fn((text) => text),
  red: jest.fn((text) => text),
}));

// Mock i18n
jest.mock('../../src/config/i18n', () => ({
  t: jest.fn((key: string, params?: any) => {
    const translations: Record<string, string> = {
      'ai_provider_utils.fetching_openai_models': 'Fetching OpenAI models...',
      'ai_provider_utils.models_found_openai': 'Found {{count}} OpenAI models',
      'ai_provider_utils.could_not_fetch_fallback': 'Could not fetch, using fallback',
      'ai_provider_utils.invalid_api_key_error': 'Invalid API key',
      'ai_provider_utils.fetching_anthropic_models': 'Fetching Anthropic models...',
      'ai_provider_utils.fetching_google_models': 'Fetching Google models...',
      'ai_provider_utils.models_found_google': 'Found {{count}} Google models',
      'ai_provider_utils.error_loading_fallback': 'Error loading fallback: {{error}}',
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

const mockedAxios = jest.mocked(axios);
const mockedFs = jest.mocked(fs);

describe('AIProviderUtils Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockedFs.readJson.mockResolvedValue({
      llm_providers: {
        openai: {
          models: [
            {
              id: 'gpt-4',
              name: 'GPT-4',
              description: 'OpenAI GPT-4',
              isLatest: true,
              category: 'cached',
              contextWindow: 8192,
              supportedFeatures: ['chat', 'completion'],
            },
          ],
        },
        anthropic: {
          models: [
            {
              id: 'claude-3-opus',
              name: 'Claude 3 Opus',
              description: 'Anthropic Claude 3 Opus',
              isLatest: true,
              category: 'cached',
              contextWindow: 200000,
              supportedFeatures: ['chat'],
            },
          ],
        },
        google: {
          models: [
            {
              id: 'gemini-pro',
              name: 'Gemini Pro',
              description: 'Google Gemini Pro',
              isLatest: true,
              category: 'cached',
              contextWindow: 30720,
              supportedFeatures: ['chat'],
            },
          ],
        },
      },
    });
  });

  describe('fetchOpenAIModels()', () => {
    it('should fetch OpenAI models successfully', async () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: 'gpt-4o',
              object: 'model',
              created: 1234567890,
              owned_by: 'openai',
            },
            {
              id: 'gpt-3.5-turbo',
              object: 'model',
              created: 1234567890,
              owned_by: 'openai',
            },
            {
              id: 'o1-preview',
              object: 'model',
              created: 1234567890,
              owned_by: 'openai',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const models = await AIProviderUtils.fetchOpenAIModels('test-api-key');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      expect(models).toHaveLength(3);
      expect(models[0]).toEqual({
        id: 'o1-preview',
        name: 'o1-preview',
        description: 'OpenAI model o1-preview',
        category: 'live',
        contextWindow: 128000,
      });
    });

    it('should handle API errors and fall back to cached models', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const models = await AIProviderUtils.fetchOpenAIModels('test-api-key');

      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('gpt-4');
      expect(models[0].category).toBe('cached');
    });

    it('should handle 401 authentication errors', async () => {
      const error = new Error('Unauthorized');
      (error as any).response = { status: 401 };
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(error);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const models = await AIProviderUtils.fetchOpenAIModels('invalid-api-key');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid API key')
      );
      expect(models).toHaveLength(1); // Fallback models

      consoleLogSpy.mockRestore();
    });

    it('should filter relevant OpenAI models only', async () => {
      const mockResponse = {
        data: {
          data: [
            { id: 'gpt-4', object: 'model' },
            { id: 'text-davinci-003', object: 'model' }, // Should be filtered out
            { id: 'gpt-3.5-turbo', object: 'model' },
            { id: 'whisper-1', object: 'model' }, // Should be filtered out
            { id: 'o1-mini', object: 'model' },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const models = await AIProviderUtils.fetchOpenAIModels('test-api-key');

      expect(models).toHaveLength(3);
      expect(models.map(m => m.id)).toEqual(['o1-mini', 'gpt-4', 'gpt-3.5-turbo']);
    });

    it('should handle malformed API response', async () => {
      mockedAxios.get.mockResolvedValue({ data: null });

      const models = await AIProviderUtils.fetchOpenAIModels('test-api-key');

      expect(models).toHaveLength(1); // Fallback models
    });
  });

  describe('fetchAnthropicModels()', () => {
    it('should return fallback models (no public API)', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const models = await AIProviderUtils.fetchAnthropicModels('test-api-key');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Fetching Anthropic models')
      );
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('claude-3-opus');

      consoleLogSpy.mockRestore();
    });
  });

  describe('fetchGoogleModels()', () => {
    it('should fetch Google Gemini models successfully', async () => {
      const mockResponse = {
        data: {
          models: [
            {
              name: 'models/gemini-pro',
              displayName: 'Gemini Pro',
              description: 'Google Gemini Pro model',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/gemini-pro-vision',
              displayName: 'Gemini Pro Vision',
              description: 'Google Gemini Pro Vision model',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/text-bison-001',
              displayName: 'PaLM 2 Text Bison',
              description: 'Legacy model', // Should be filtered out
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const models = await AIProviderUtils.fetchGoogleModels('test-api-key');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models?key=test-api-key',
        { timeout: 10000 }
      );

      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        id: 'gemini-pro',
        name: 'Gemini Pro',
        description: 'Google Gemini Pro model',
        category: 'live',
        supportedFeatures: ['generateContent'],
      });
    });

    it('should handle Google API errors', async () => {
      const error = new Error('Bad Request');
      (error as any).response = { status: 400 };
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(error);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const models = await AIProviderUtils.fetchGoogleModels('invalid-api-key');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid API key')
      );
      expect(models).toHaveLength(1); // Fallback models

      consoleLogSpy.mockRestore();
    });

    it('should handle missing displayName gracefully', async () => {
      const mockResponse = {
        data: {
          models: [
            {
              name: 'models/gemini-pro',
              description: 'Test model',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const models = await AIProviderUtils.fetchGoogleModels('test-api-key');

      expect(models[0].name).toBe('models/gemini-pro'); // Falls back to name
    });
  });

  describe('getFallbackModels()', () => {
    it('should load fallback models from file', async () => {
      const models = await AIProviderUtils.getFallbackModels('openai');

      expect(mockedFs.readJson).toHaveBeenCalled();
      expect(models).toHaveLength(1);
      expect(models[0]).toEqual({
        id: 'gpt-4',
        name: 'GPT-4',
        description: 'OpenAI GPT-4',
        isLatest: true,
        category: 'cached',
        contextWindow: 8192,
        supportedFeatures: ['chat', 'completion'],
      });
    });

    it('should handle missing provider in fallback file', async () => {
      mockedFs.readJson.mockResolvedValue({
        llm_providers: {
          // Missing the requested provider
        },
      });

      const models = await AIProviderUtils.getFallbackModels('unknown-provider');

      expect(models).toEqual([]);
    });

    it('should handle file read errors', async () => {
      mockedFs.readJson.mockRejectedValue(new Error('File not found'));
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const models = await AIProviderUtils.getFallbackModels('openai');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error loading fallback')
      );
      expect(models).toEqual([]);

      consoleLogSpy.mockRestore();
    });

    it('should handle malformed JSON structure', async () => {
      mockedFs.readJson.mockResolvedValue({
        llm_providers: {
          openai: {
            // Missing models array
          },
        },
      });

      const models = await AIProviderUtils.getFallbackModels('openai');

      expect(models).toEqual([]);
    });
  });

  describe('getContextWindowForModel()', () => {
    it('should return correct context windows for known models', () => {
      // Access private method for testing
      const getContextWindow = (AIProviderUtils as any).getContextWindowForModel;

      expect(getContextWindow('gpt-4o')).toBe(128000);
      expect(getContextWindow('gpt-4o-mini')).toBe(128000);
      expect(getContextWindow('gpt-4-turbo')).toBe(128000);
      expect(getContextWindow('gpt-4')).toBe(8192);
      expect(getContextWindow('gpt-3.5-turbo')).toBe(16385);
      expect(getContextWindow('o1')).toBe(128000);
      expect(getContextWindow('o1-mini')).toBe(128000);
    });

    it('should return default context window for unknown models', () => {
      const getContextWindow = (AIProviderUtils as any).getContextWindowForModel;

      expect(getContextWindow('unknown-model')).toBe(4096);
      expect(getContextWindow('custom-model')).toBe(4096);
    });
  });

  describe('fetchModelsForProvider()', () => {
    it('should route to correct provider methods', async () => {
      const openaiSpy = jest.spyOn(AIProviderUtils, 'fetchOpenAIModels').mockResolvedValue([]);
      const anthropicSpy = jest.spyOn(AIProviderUtils, 'fetchAnthropicModels').mockResolvedValue([]);
      const googleSpy = jest.spyOn(AIProviderUtils, 'fetchGoogleModels').mockResolvedValue([]);
      const fallbackSpy = jest.spyOn(AIProviderUtils, 'getFallbackModels').mockResolvedValue([]);

      await AIProviderUtils.fetchModelsForProvider('openai', 'api-key');
      expect(openaiSpy).toHaveBeenCalledWith('api-key');

      await AIProviderUtils.fetchModelsForProvider('anthropic', 'api-key');
      expect(anthropicSpy).toHaveBeenCalledWith('api-key');

      await AIProviderUtils.fetchModelsForProvider('google', 'api-key');
      expect(googleSpy).toHaveBeenCalledWith('api-key');

      await AIProviderUtils.fetchModelsForProvider('unknown', 'api-key');
      expect(fallbackSpy).toHaveBeenCalledWith('unknown');

      openaiSpy.mockRestore();
      anthropicSpy.mockRestore();
      googleSpy.mockRestore();
      fallbackSpy.mockRestore();
    });
  });

  describe('Integration Tests', () => {
    it('should handle network timeouts gracefully', async () => {
      const timeoutError = new Error('timeout of 10000ms exceeded');
      timeoutError.name = 'TimeoutError';
      mockedAxios.get.mockRejectedValue(timeoutError);

      const models = await AIProviderUtils.fetchOpenAIModels('test-api-key');

      expect(models).toHaveLength(1); // Should fall back to cached models
    });

    it('should handle empty API responses', async () => {
      mockedAxios.get.mockResolvedValue({ data: { data: [] } });

      const models = await AIProviderUtils.fetchOpenAIModels('test-api-key');

      expect(models).toHaveLength(0); // Empty array for no relevant models
    });

    it('should handle provider-specific API rate limits', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).response = { status: 429 };
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(rateLimitError);

      const models = await AIProviderUtils.fetchOpenAIModels('test-api-key');

      expect(models).toHaveLength(1); // Should fall back gracefully
    });

    it('should sort models correctly by ID', async () => {
      const mockResponse = {
        data: {
          data: [
            { id: 'gpt-3.5-turbo', object: 'model' },
            { id: 'gpt-4o', object: 'model' },
            { id: 'gpt-4', object: 'model' },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const models = await AIProviderUtils.fetchOpenAIModels('test-api-key');

      // Should be sorted by ID in descending order
      expect(models.map(m => m.id)).toEqual(['gpt-4o', 'gpt-4', 'gpt-3.5-turbo']);
    });
  });

  describe('Error Edge Cases', () => {
    it('should handle undefined response data', async () => {
      mockedAxios.get.mockResolvedValue(undefined);

      const models = await AIProviderUtils.fetchOpenAIModels('test-api-key');

      expect(models).toHaveLength(1); // Fallback models
    });

    it('should handle null models array', async () => {
      mockedAxios.get.mockResolvedValue({ data: { data: null } });

      const models = await AIProviderUtils.fetchOpenAIModels('test-api-key');

      expect(models).toHaveLength(1); // Fallback models
    });

    it('should handle models with missing properties', async () => {
      const mockResponse = {
        data: {
          data: [
            { id: 'gpt-4' }, // Missing other properties
            {}, // Missing ID
            { id: 'gpt-3.5-turbo', object: 'model' },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const models = await AIProviderUtils.fetchOpenAIModels('test-api-key');

      expect(models).toHaveLength(2); // Should handle gracefully
      expect(models.some(m => m.id === 'gpt-4')).toBe(true);
      expect(models.some(m => m.id === 'gpt-3.5-turbo')).toBe(true);
    });
  });
});