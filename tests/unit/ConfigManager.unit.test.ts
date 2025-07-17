// @ts-nocheck
import { ConfigManager } from '../../src/config/ConfigManager';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

// Mock fs-extra
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn(),
  pathExists: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  chmod: jest.fn(),
  writeJson: jest.fn(),
  readJSON: jest.fn(),
  move: jest.fn(),
  stat: jest.fn()
}));

// @ts-ignore
const mockedFs = fs;

// Mock os
jest.mock('os');
const mockedOs = os as jest.Mocked<typeof os>;

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

// Mock process.env
const originalEnv = process.env;

describe('ConfigManager Unit Tests', () => {
  let configManager: ConfigManager;
  let mockHomeDir: string;
  let mockWoaruDir: string;
  let mockConfigDir: string;
  let mockEnvFile: string;
  let mockAiConfigFile: string;
  let mockUserConfigFile: string;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset process.env
    process.env = { ...originalEnv };

    // Setup mock paths
    mockHomeDir = '/home/testuser';
    mockWoaruDir = path.join(mockHomeDir, '.woaru');
    mockConfigDir = path.join(mockWoaruDir, 'config');
    mockEnvFile = path.join(mockWoaruDir, '.env');
    mockAiConfigFile = path.join(mockConfigDir, 'ai_config.json');
    mockUserConfigFile = path.join(mockConfigDir, 'user.json');

    // Mock os.homedir
    mockedOs.homedir.mockReturnValue(mockHomeDir);

    // Reset singleton instance
    (ConfigManager as any).instance = undefined;
    configManager = ConfigManager.getInstance();
  });

  afterEach(() => {
    // Restore original process.env
    process.env = originalEnv;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = ConfigManager.getInstance();
      const instance2 = ConfigManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should initialize with correct directory paths', () => {
      expect(configManager.getEnvFilePath()).toBe(mockEnvFile);
      expect(configManager.getAiConfigFilePath()).toBe(mockAiConfigFile);
      expect(configManager.getConfigDirPath()).toBe(mockConfigDir);
      expect(configManager.getUserConfigFilePath()).toBe(mockUserConfigFile);
    });
  });

  describe('Initialization', () => {
    it('should create directories during initialization', async () => {
      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.pathExists.mockResolvedValue(false);
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue('');

      await configManager.initialize();

      expect(mockedFs.ensureDir).toHaveBeenCalledWith(mockWoaruDir);
      expect(mockedFs.ensureDir).toHaveBeenCalledWith(mockConfigDir);
    });

    it('should create empty env file if it does not exist', async () => {
      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.pathExists.mockResolvedValue(false);
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue('');

      await configManager.initialize();

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        mockEnvFile,
        expect.stringContaining('# WOARU API Keys - Managed by ConfigManager')
      );
    });

    it('should create empty AI config file if it does not exist', async () => {
      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.pathExists.mockResolvedValue(false);
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue('');

      await configManager.initialize();

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        mockAiConfigFile,
        expect.stringContaining('_metadata')
      );
    });

    it('should handle initialization errors gracefully', async () => {
      mockedFs.ensureDir.mockRejectedValue(new Error('Permission denied'));
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await configManager.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Warning: Could not fully initialize config security')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('API Key Management', () => {
    beforeEach(() => {
      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.chmod.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue('');
      mockedFs.writeFile.mockResolvedValue(undefined);
    });

    describe('storeApiKey', () => {
      it('should store API key in env file', async () => {
        mockedFs.readFile.mockResolvedValue('# Existing content\n');
        
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        await configManager.storeApiKey('openai', 'sk-test-key');

        expect(mockedFs.writeFile).toHaveBeenCalledWith(
          mockEnvFile,
          expect.stringContaining('OPENAI_API_KEY="sk-test-key"')
        );
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('✅ API key for openai stored securely')
        );
        
        consoleSpy.mockRestore();
      });

      it('should replace existing API key for the same provider', async () => {
        mockedFs.readFile.mockResolvedValue('OPENAI_API_KEY="old-key"\nOTHER_KEY="value"\n');

        await configManager.storeApiKey('openai', 'new-key');

        expect(mockedFs.writeFile).toHaveBeenCalledWith(
          mockEnvFile,
          expect.stringMatching(/OPENAI_API_KEY="new-key"/)
        );
        expect(mockedFs.writeFile).toHaveBeenCalledWith(
          mockEnvFile,
          expect.stringMatching(/OTHER_KEY="value"/)
        );
      });

      it('should handle store errors', async () => {
        mockedFs.writeFile.mockRejectedValue(new Error('Write failed'));

        await expect(configManager.storeApiKey('openai', 'key')).rejects.toThrow(
          'Failed to store API key: Write failed'
        );
      });
    });

    describe('hasApiKey', () => {
      it('should return true when API key exists in environment', async () => {
        process.env.OPENAI_API_KEY = 'test-key';

        const result = await configManager.hasApiKey('openai');

        expect(result).toBe(true);
      });

      it('should return false when API key does not exist', async () => {
        delete process.env.OPENAI_API_KEY;

        const result = await configManager.hasApiKey('openai');

        expect(result).toBe(false);
      });

      it('should handle case insensitive provider names', async () => {
        process.env.OPENAI_API_KEY = 'test-key';

        const result = await configManager.hasApiKey('OpenAI');

        expect(result).toBe(true);
      });
    });

    describe('getApiKey', () => {
      it('should return API key from environment', async () => {
        process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

        const result = await configManager.getApiKey('anthropic');

        expect(result).toBe('test-anthropic-key');
      });

      it('should return undefined when API key does not exist', async () => {
        delete process.env.NONEXISTENT_API_KEY;

        const result = await configManager.getApiKey('nonexistent');

        expect(result).toBeUndefined();
      });
    });

    describe('removeApiKey', () => {
      it('should remove API key from env file', async () => {
        mockedFs.readFile.mockResolvedValue('OPENAI_API_KEY="key"\nOTHER_KEY="value"\n');
        
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        await configManager.removeApiKey('openai');

        expect(mockedFs.writeFile).toHaveBeenCalledWith(
          mockEnvFile,
          expect.not.stringMatching(/OPENAI_API_KEY/)
        );
        expect(mockedFs.writeFile).toHaveBeenCalledWith(
          mockEnvFile,
          expect.stringMatching(/OTHER_KEY="value"/)
        );
        
        consoleSpy.mockRestore();
      });

      it('should handle removal when env file does not exist', async () => {
        mockedFs.pathExists.mockResolvedValue(false);

        await configManager.removeApiKey('openai');

        expect(mockedFs.readFile).not.toHaveBeenCalled();
        expect(mockedFs.writeFile).not.toHaveBeenCalled();
      });

      it('should handle removal errors', async () => {
        mockedFs.readFile.mockRejectedValue(new Error('Read failed'));

        await expect(configManager.removeApiKey('openai')).rejects.toThrow(
          'Failed to remove API key: Read failed'
        );
      });
    });

    describe('getConfiguredProviders', () => {
      it('should return list of configured providers from env file', async () => {
        mockedFs.readFile.mockResolvedValue(
          'OPENAI_API_KEY="key1"\nANTHROPIC_API_KEY="key2"\nOTHER_VAR="value"\n'
        );

        const result = await configManager.getConfiguredProviders();

        expect(result).toEqual(['openai', 'anthropic']);
      });

      it('should return empty array when no providers configured', async () => {
        mockedFs.readFile.mockResolvedValue('OTHER_VAR="value"\n');

        const result = await configManager.getConfiguredProviders();

        expect(result).toEqual([]);
      });

      it('should handle env file not existing', async () => {
        mockedFs.pathExists.mockResolvedValue(false);

        const result = await configManager.getConfiguredProviders();

        expect(result).toEqual([]);
      });
    });
  });

  describe('Environment Variable Loading', () => {
    it('should load environment variables from env file', async () => {
      mockedFs.pathExists.mockResolvedValue(true);
      
      const dotenv = require('dotenv');
      const configSpy = jest.spyOn(dotenv, 'config').mockImplementation();

      await configManager.loadEnvironmentVariables();

      expect(configSpy).toHaveBeenCalledWith({ path: mockEnvFile });
      
      configSpy.mockRestore();
    });

    it('should handle missing env file gracefully', async () => {
      mockedFs.pathExists.mockResolvedValue(false);
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await configManager.loadEnvironmentVariables();

      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle dotenv errors gracefully', async () => {
      mockedFs.pathExists.mockResolvedValue(true);
      
      const dotenv = require('dotenv');
      const configSpy = jest.spyOn(dotenv, 'config').mockImplementation(() => {
        throw new Error('Dotenv error');
      });
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await configManager.loadEnvironmentVariables();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Warning: Could not load environment variables')
      );
      
      configSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('AI Configuration Management', () => {
    const mockAiConfig = {
      '_metadata': {
        'created': '2024-01-01T00:00:00.000Z',
        'description': 'Test config'
      },
      'multi_ai_review_enabled': true,
      'primary_review_provider_id': 'openai-gpt4',
      'openai-gpt4': {
        enabled: true,
        model: 'gpt-4',
        apiKeyEnvVar: 'OPENAI_API_KEY'
      },
      'anthropic-claude': {
        enabled: false,
        model: 'claude-3-opus',
        apiKeyEnvVar: 'ANTHROPIC_API_KEY'
      }
    };

    beforeEach(() => {
      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue('');
    });

    describe('storeAiConfig', () => {
      it('should store AI configuration to file', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        await configManager.storeAiConfig(mockAiConfig);

        expect(mockedFs.writeFile).toHaveBeenCalledWith(
          mockAiConfigFile,
          JSON.stringify(mockAiConfig, null, 2)
        );
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('✅ AI configuration stored')
        );
        
        consoleSpy.mockRestore();
      });

      it('should handle store errors', async () => {
        mockedFs.writeFile.mockRejectedValue(new Error('Write failed'));

        await expect(configManager.storeAiConfig(mockAiConfig)).rejects.toThrow(
          'Failed to store AI config: Write failed'
        );
      });
    });

    describe('loadAiConfig', () => {
      it('should load AI configuration from file', async () => {
        mockedFs.readFile.mockResolvedValue(JSON.stringify(mockAiConfig));

        const result = await configManager.loadAiConfig();

        expect(result).toEqual(mockAiConfig);
      });

      it('should return empty object when file does not exist', async () => {
        mockedFs.pathExists.mockResolvedValue(false);

        const result = await configManager.loadAiConfig();

        expect(result).toEqual({});
      });

      it('should handle invalid JSON gracefully', async () => {
        mockedFs.readFile.mockResolvedValue('invalid json');
        
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        const result = await configManager.loadAiConfig();

        expect(result).toEqual({});
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('⚠️ Warning: Could not load AI config')
        );
        
        consoleSpy.mockRestore();
      });
    });

    describe('getConfiguredAiProviders', () => {
      it('should return list of configured AI providers', async () => {
        mockedFs.readFile.mockResolvedValue(JSON.stringify(mockAiConfig));

        const result = await configManager.getConfiguredAiProviders();

        expect(result).toEqual(['openai-gpt4', 'anthropic-claude']);
      });

      it('should exclude metadata and configuration entries', async () => {
        mockedFs.readFile.mockResolvedValue(JSON.stringify(mockAiConfig));

        const result = await configManager.getConfiguredAiProviders();

        expect(result).not.toContain('_metadata');
        expect(result).not.toContain('multi_ai_review_enabled');
        expect(result).not.toContain('primary_review_provider_id');
      });

      it('should handle empty configuration', async () => {
        mockedFs.readFile.mockResolvedValue('{}');

        const result = await configManager.getConfiguredAiProviders();

        expect(result).toEqual([]);
      });
    });

    describe('getEnabledAiProviders', () => {
      it('should return only enabled AI providers', async () => {
        mockedFs.readFile.mockResolvedValue(JSON.stringify(mockAiConfig));

        const result = await configManager.getEnabledAiProviders();

        expect(result).toEqual(['openai-gpt4']);
        expect(result).not.toContain('anthropic-claude');
      });

      it('should return empty array when no providers are enabled', async () => {
        const disabledConfig = {
          ...mockAiConfig,
          'openai-gpt4': { ...mockAiConfig['openai-gpt4'], enabled: false }
        };
        mockedFs.readFile.mockResolvedValue(JSON.stringify(disabledConfig));

        const result = await configManager.getEnabledAiProviders();

        expect(result).toEqual([]);
      });
    });
  });

  describe('Multi-AI Review Configuration', () => {
    beforeEach(() => {
      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);
    });

    describe('getMultiAiReviewConfig', () => {
      it('should return multi-AI review configuration', async () => {
        const config = {
          multi_ai_review_enabled: true,
          primary_review_provider_id: 'openai-gpt4'
        };
        mockedFs.readFile.mockResolvedValue(JSON.stringify(config));

        const result = await configManager.getMultiAiReviewConfig();

        expect(result).toEqual({
          enabled: true,
          primaryProvider: 'openai-gpt4'
        });
      });

      it('should return default values when not configured', async () => {
        mockedFs.readFile.mockResolvedValue('{}');

        const result = await configManager.getMultiAiReviewConfig();

        expect(result).toEqual({
          enabled: false,
          primaryProvider: null
        });
      });
    });

    describe('updateMultiAiReviewConfig', () => {
      it('should update multi-AI review configuration', async () => {
        mockedFs.readFile.mockResolvedValue('{}');

        await configManager.updateMultiAiReviewConfig(true, 'anthropic-claude');

        expect(mockedFs.writeFile).toHaveBeenCalledWith(
          mockAiConfigFile,
          expect.stringContaining('"multi_ai_review_enabled": true')
        );
        expect(mockedFs.writeFile).toHaveBeenCalledWith(
          mockAiConfigFile,
          expect.stringContaining('"primary_review_provider_id": "anthropic-claude"')
        );
      });

      it('should preserve existing configuration when updating', async () => {
        const existingConfig = {
          'openai-gpt4': { enabled: true, model: 'gpt-4' }
        };
        mockedFs.readFile.mockResolvedValue(JSON.stringify(existingConfig));

        await configManager.updateMultiAiReviewConfig(false, null);

        expect(mockedFs.writeFile).toHaveBeenCalledWith(
          mockAiConfigFile,
          expect.stringContaining('"openai-gpt4"')
        );
      });
    });
  });

  describe('Security and Permissions', () => {
    it('should set secure permissions on Unix systems', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue('');

      await configManager.initialize();

      expect(mockedFs.chmod).toHaveBeenCalledWith(mockEnvFile, 0o600);
      expect(mockedFs.chmod).toHaveBeenCalledWith(mockAiConfigFile, 0o600);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should skip permission setting on Windows', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue('');

      await configManager.initialize();

      expect(mockedFs.chmod).not.toHaveBeenCalled();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should handle permission errors gracefully', async () => {
      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.chmod.mockRejectedValue(new Error('Permission denied'));
      mockedFs.readFile.mockResolvedValue('');
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await configManager.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Warning: Could not set secure permissions')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Legacy Configuration Migration', () => {
    it('should migrate legacy llm_config.json to ai_config.json', async () => {
      const legacyConfigPath = path.join(mockConfigDir, 'llm_config.json');
      
      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.pathExists.mockImplementation((filePath) => {
        if (filePath === legacyConfigPath) return Promise.resolve(true);
        if (filePath === mockAiConfigFile) return Promise.resolve(false);
        return Promise.resolve(true);
      });
      mockedFs.move.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue('');
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await configManager.initialize();

      expect(mockedFs.move).toHaveBeenCalledWith(legacyConfigPath, mockAiConfigFile);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ℹ️ WOARU-Konfiguration wurde automatisch auf das neue \'ai\'-Format migriert')
      );
      
      consoleSpy.mockRestore();
    });

    it('should not migrate when new config already exists', async () => {
      const legacyConfigPath = path.join(mockConfigDir, 'llm_config.json');
      
      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.pathExists.mockResolvedValue(true); // Both files exist
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue('');

      await configManager.initialize();

      expect(mockedFs.move).not.toHaveBeenCalled();
    });
  });

  describe('Backward Compatibility', () => {
    it('should provide backward compatibility for LLM methods', async () => {
      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.writeFile.mockResolvedValue(undefined);
      
      // First mock empty config for initial load, then mock with test config after store
      mockedFs.readFile.mockResolvedValueOnce('{}');
      mockedFs.readFile.mockResolvedValue('{"test": "config"}');

      // Test deprecated methods
      await configManager.storeLlmConfig({ test: 'config' });
      const loadedConfig = await configManager.loadLlmConfig();
      const providers = await configManager.getConfiguredLlmProviders();
      const configPath = configManager.getLlmConfigFilePath();

      expect(loadedConfig).toEqual({ test: 'config' });
      expect(providers).toEqual([]);
      expect(configPath).toBe(mockAiConfigFile);
    });
  });

  describe('User Configuration', () => {
    beforeEach(() => {
      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);
    });

    describe('User language preferences', () => {
      it('should set and get user language', async () => {
        mockedFs.readFile.mockResolvedValue('{}');

        await configManager.setUserLanguage('de');
        
        expect(mockedFs.writeFile).toHaveBeenCalledWith(
          mockUserConfigFile,
          expect.stringContaining('"language": "de"')
        );

        mockedFs.readFile.mockResolvedValue('{"language": "de"}');
        const language = await configManager.getUserLanguage();
        
        expect(language).toBe('de');
      });

      it('should return null when no language is set', async () => {
        mockedFs.readFile.mockResolvedValue('{}');

        const language = await configManager.getUserLanguage();
        
        expect(language).toBeNull();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle filesystem errors gracefully during initialization', async () => {
      mockedFs.ensureDir.mockRejectedValue(new Error('Filesystem error'));
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await configManager.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Warning: Could not fully initialize config security')
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle concurrent access correctly', async () => {
      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue('{}');

      // Simulate concurrent calls
      const promises = [
        configManager.loadAiConfig(),
        configManager.loadAiConfig(),
        configManager.loadAiConfig()
      ];

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toEqual({});
      });
    });

    it('should handle malformed environment variable names', async () => {
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readFile.mockResolvedValue('INVALID_VAR=value\nOPENAI_API_KEY=valid\n');

      const providers = await configManager.getConfiguredProviders();

      expect(providers).toEqual(['openai']);
    });
  });
});