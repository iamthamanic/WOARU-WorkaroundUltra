import { ensureAiIsConfigured, validateAiProvider, getActiveAiProviders } from '../../src/utils/ai-helpers';
import { ConfigManager } from '../../src/config/ConfigManager';

// Mock ConfigManager
jest.mock('../../src/config/ConfigManager');

// Mock console methods and process.exit
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  throw new Error(`process.exit() was called with code ${code}`);
});

describe('AI Helpers', () => {
  let mockConfigManager: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigManager = {
      loadAiConfig: jest.fn(),
    } as any;

    (ConfigManager.getInstance as jest.Mock).mockReturnValue(mockConfigManager);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ensureAiIsConfigured', () => {
    it('should pass when AI is properly configured', async () => {
      // Arrange
      const mockAiConfig = {
        provider1: {
          enabled: true,
          apiKey: 'test-api-key'
        },
        lastDataUpdate: new Date().toISOString()
      };
      
      mockConfigManager.loadAiConfig.mockResolvedValue(mockAiConfig);

      // Act & Assert - should not throw or exit
      await expect(ensureAiIsConfigured()).resolves.toBeUndefined();
      expect(mockProcessExit).not.toHaveBeenCalled();
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it('should exit when no AI config exists', async () => {
      // Arrange
      mockConfigManager.loadAiConfig.mockResolvedValue(null);

      // Act & Assert
      await expect(ensureAiIsConfigured()).rejects.toThrow('process.exit() was called with code 1');
      
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('❌ Fehler: Dieses Feature erfordert eine aktive und korrekt konfigurierte AI.')
      );
    });

    it('should exit when AI config is empty', async () => {
      // Arrange
      const emptyConfig = { lastDataUpdate: new Date().toISOString() };
      mockConfigManager.loadAiConfig.mockResolvedValue(emptyConfig);

      // Act & Assert
      await expect(ensureAiIsConfigured()).rejects.toThrow('process.exit() was called with code 1');
      
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('❌ Fehler: Dieses Feature erfordert eine aktive und korrekt konfigurierte AI.')
      );
    });

    it('should exit when no providers are enabled', async () => {
      // Arrange
      const mockAiConfig = {
        provider1: {
          enabled: false,
          apiKey: 'test-api-key'
        },
        provider2: {
          enabled: false,
          apiKey: 'test-api-key-2'
        },
        lastDataUpdate: new Date().toISOString()
      };
      
      mockConfigManager.loadAiConfig.mockResolvedValue(mockAiConfig);

      // Act & Assert
      await expect(ensureAiIsConfigured()).rejects.toThrow('process.exit() was called with code 1');
      
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('❌ Fehler: Dieses Feature erfordert eine aktive und korrekt konfigurierte AI.')
      );
    });

    it('should exit when enabled providers have no API keys', async () => {
      // Arrange
      const mockAiConfig = {
        provider1: {
          enabled: true,
          apiKey: ''
        },
        provider2: {
          enabled: true,
          apiKey: '   '  // whitespace only
        },
        lastDataUpdate: new Date().toISOString()
      };
      
      mockConfigManager.loadAiConfig.mockResolvedValue(mockAiConfig);

      // Act & Assert
      await expect(ensureAiIsConfigured()).rejects.toThrow('process.exit() was called with code 1');
      
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('❌ Fehler: Dieses Feature erfordert eine aktive und korrekt konfigurierte AI.')
      );
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockConfigManager.loadAiConfig.mockRejectedValue(new Error('Config load failed'));

      // Act & Assert
      await expect(ensureAiIsConfigured()).rejects.toThrow('process.exit() was called with code 1');
      
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('❌ Fehler beim Prüfen der AI-Konfiguration:'),
        expect.any(Error)
      );
    });
  });

  describe('validateAiProvider', () => {
    it('should return true for valid provider', () => {
      const validProvider = {
        enabled: true,
        apiKey: 'valid-api-key'
      };

      expect(validateAiProvider(validProvider)).toBe(true);
    });

    it('should return false for disabled provider', () => {
      const disabledProvider = {
        enabled: false,
        apiKey: 'valid-api-key'
      };

      expect(validateAiProvider(disabledProvider)).toBe(false);
    });

    it('should return false for provider without API key', () => {
      const providerWithoutKey = {
        enabled: true,
        apiKey: ''
      };

      expect(validateAiProvider(providerWithoutKey)).toBe(false);
    });

    it('should return false for null/undefined provider', () => {
      expect(validateAiProvider(null)).toBe(false);
      expect(validateAiProvider(undefined)).toBe(false);
    });

    it('should return false for provider with whitespace-only API key', () => {
      const providerWithWhitespaceKey = {
        enabled: true,
        apiKey: '   '
      };

      expect(validateAiProvider(providerWithWhitespaceKey)).toBe(false);
    });
  });

  describe('getActiveAiProviders', () => {
    it('should return active providers', async () => {
      // Arrange
      const mockAiConfig = {
        provider1: {
          enabled: true,
          apiKey: 'key1'
        },
        provider2: {
          enabled: false,
          apiKey: 'key2'
        },
        provider3: {
          enabled: true,
          apiKey: 'key3'
        },
        lastDataUpdate: new Date().toISOString()
      };
      
      mockConfigManager.loadAiConfig.mockResolvedValue(mockAiConfig);

      // Act
      const activeProviders = await getActiveAiProviders();

      // Assert
      expect(activeProviders).toHaveLength(2);
      expect(activeProviders[0].id).toBe('provider1');
      expect(activeProviders[1].id).toBe('provider3');
    });

    it('should return empty array when no config', async () => {
      // Arrange
      mockConfigManager.loadAiConfig.mockResolvedValue(null);

      // Act
      const activeProviders = await getActiveAiProviders();

      // Assert
      expect(activeProviders).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockConfigManager.loadAiConfig.mockRejectedValue(new Error('Load failed'));
      const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      // Act
      const activeProviders = await getActiveAiProviders();

      // Assert
      expect(activeProviders).toEqual([]);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Warnung: Fehler beim Laden der AI-Provider:'),
        expect.any(Error)
      );
      
      mockConsoleWarn.mockRestore();
    });
  });
});