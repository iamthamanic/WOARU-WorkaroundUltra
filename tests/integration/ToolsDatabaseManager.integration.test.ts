import { ToolsDatabaseManager } from '../../src/database/ToolsDatabaseManager';
import * as fs from 'fs-extra';
import * as path from 'path';
import { createTempDir, cleanupTempDir } from '../setup';

describe('ToolsDatabaseManager Integration Tests', () => {
  let manager: ToolsDatabaseManager;
  let tempDir: string;
  let mockCacheDir: string;
  let mockLocalFallbackPath: string;
  let mockAIModelsLocalFallbackPath: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
    mockCacheDir = path.join(tempDir, '.woaru', 'cache');
    mockLocalFallbackPath = path.join(tempDir, 'tools.json');
    mockAIModelsLocalFallbackPath = path.join(tempDir, 'ai-models.json');

    // Create manager with mocked paths
    manager = new ToolsDatabaseManager();
    // Override private properties for testing
    (manager as any).cacheDir = mockCacheDir;
    (manager as any).localFallbackPath = mockLocalFallbackPath;
    (manager as any).aiModelsLocalFallbackPath = mockAIModelsLocalFallbackPath;
    (manager as any).cacheFilePath = path.join(mockCacheDir, 'tools.json');
    (manager as any).aiModelsCacheFilePath = path.join(mockCacheDir, 'ai-models.json');
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('AI Models Database Loading', () => {
    it('should load ai-models.json from local fallback path', async () => {
      // Arrange: Copy mock data to local fallback path
      const mockAIModelsPath = path.join(__dirname, '../fixtures/mock-ai-models.json');
      const mockData = await fs.readJson(mockAIModelsPath);
      await fs.ensureDir(path.dirname(mockAIModelsLocalFallbackPath));
      await fs.writeJson(mockAIModelsLocalFallbackPath, mockData);

      // Act
      const database = await manager.getAIModelsDatabase();

      // Assert
      expect(database).toBeDefined();
      expect(database.version).toBe('1.0.0-test');
      expect(database).toContainAIProvider('anthropic');
      expect(database).toContainAIProvider('openai');
      expect(database).toContainAIProvider('deepseek');
      expect(database.llm_providers.anthropic.models).toHaveLength(2);
      expect(database.llm_providers.openai.models).toHaveLength(2);
      expect(database.llm_providers.deepseek.models).toHaveLength(2);
    });

    it('should handle invalid ai-models.json gracefully', async () => {
      // Arrange: Copy invalid mock data
      const invalidDataPath = path.join(__dirname, '../fixtures/invalid-ai-models.json');
      const invalidData = await fs.readJson(invalidDataPath);
      await fs.ensureDir(path.dirname(mockAIModelsLocalFallbackPath));
      await fs.writeJson(mockAIModelsLocalFallbackPath, invalidData);

      // Act & Assert: Should fall back to minimal database
      const database = await manager.getAIModelsDatabase();
      expect(database).toBeDefined();
      expect(database.version).toBe('1.0.0');
      expect(database.llm_providers.anthropic).toBeDefined();
      expect(database.llm_providers.anthropic.models.length).toBeGreaterThanOrEqual(1);
    });

    it('should fall back to minimal database when no files exist', async () => {
      // Act: No files exist, should use minimal fallback
      const database = await manager.getAIModelsDatabase();

      // Assert
      expect(database).toBeDefined();
      expect(database.version).toBe('1.0.0');
      expect(database.llm_providers.anthropic).toBeDefined();
      expect(database.llm_providers.anthropic.models.some(m => m.id.includes('claude'))).toBe(true);
    });

    it('should get models for specific provider', async () => {
      // Arrange
      const mockAIModelsPath = path.join(__dirname, '../fixtures/mock-ai-models.json');
      const mockData = await fs.readJson(mockAIModelsPath);
      await fs.ensureDir(path.dirname(mockAIModelsLocalFallbackPath));
      await fs.writeJson(mockAIModelsLocalFallbackPath, mockData);

      // Act
      const anthropicModels = await manager.getModelsForProvider('anthropic');
      const openaiModels = await manager.getModelsForProvider('openai');
      const nonExistentModels = await manager.getModelsForProvider('nonexistent');

      // Assert
      expect(anthropicModels).toHaveLength(2);
      expect(anthropicModels[0].id).toBe('claude-3-5-sonnet-20241022');
      expect(anthropicModels[0].isLatest).toBe(true);
      
      expect(openaiModels).toHaveLength(2);
      expect(openaiModels[0].id).toBe('gpt-4o');
      expect(openaiModels[0].isLatest).toBe(true);
      
      expect(nonExistentModels).toEqual([]);
    });

    it('should get provider configuration', async () => {
      // Arrange
      const mockAIModelsPath = path.join(__dirname, '../fixtures/mock-ai-models.json');
      const mockData = await fs.readJson(mockAIModelsPath);
      await fs.ensureDir(path.dirname(mockAIModelsLocalFallbackPath));
      await fs.writeJson(mockAIModelsLocalFallbackPath, mockData);

      // Act
      const anthropicConfig = await manager.getProviderConfig('anthropic');
      const nonExistentConfig = await manager.getProviderConfig('nonexistent');

      // Assert
      expect(anthropicConfig).toBeDefined();
      expect(anthropicConfig?.name).toBe('Anthropic Claude');
      expect(anthropicConfig?.apiKeyEnvVar).toBe('ANTHROPIC_API_KEY');
      expect(anthropicConfig?.baseUrl).toBe('https://api.anthropic.com/v1/messages');
      expect(anthropicConfig?.models).toHaveLength(2);
      
      expect(nonExistentConfig).toBeNull();
    });

    it('should get latest models across all providers', async () => {
      // Arrange
      const mockAIModelsPath = path.join(__dirname, '../fixtures/mock-ai-models.json');
      const mockData = await fs.readJson(mockAIModelsPath);
      await fs.ensureDir(path.dirname(mockAIModelsLocalFallbackPath));
      await fs.writeJson(mockAIModelsLocalFallbackPath, mockData);

      // Act
      const latestModels = await manager.getLatestAIModels();

      // Assert
      expect(latestModels).toHaveLength(3); // One latest from each provider
      expect(latestModels.map(m => m.id)).toContain('claude-3-5-sonnet-20241022');
      expect(latestModels.map(m => m.id)).toContain('gpt-4o');
      expect(latestModels.map(m => m.id)).toContain('deepseek-chat');
      expect(latestModels.every(m => m.isLatest)).toBe(true);
    });

    it('should get AI models statistics', async () => {
      // Arrange
      const mockAIModelsPath = path.join(__dirname, '../fixtures/mock-ai-models.json');
      const mockData = await fs.readJson(mockAIModelsPath);
      await fs.ensureDir(path.dirname(mockAIModelsLocalFallbackPath));
      await fs.writeJson(mockAIModelsLocalFallbackPath, mockData);

      // Act
      const stats = await manager.getAIModelsStats();

      // Assert
      expect(stats).toBeDefined();
      expect(stats.version).toBe('1.0.0-test');
      expect(stats.providers).toBe(3);
      expect(stats.totalModels).toBe(6); // 2 + 2 + 2 models
      expect(stats.providerNames).toEqual(['anthropic', 'openai', 'deepseek']);
      expect(stats.lastUpdated).toBe('2025-01-15T10:00:00Z');
    });
  });

  describe('Tools Database Loading', () => {
    it('should load tools.json from local fallback path', async () => {
      // Arrange: Copy mock data to local fallback path
      const mockToolsPath = path.join(__dirname, '../fixtures/mock-tools.json');
      const mockData = await fs.readJson(mockToolsPath);
      await fs.ensureDir(path.dirname(mockLocalFallbackPath));
      await fs.writeJson(mockLocalFallbackPath, mockData);

      // Act
      const database = await manager.getHybridDatabase();

      // Assert
      expect(database).toBeDefined();
      expect(database.version).toBe('3.2.0');
      expect(database.schema_version).toBe('2.0');
      expect(database.core_tools).toBeDefined();
      expect(database.core_tools.eslint).toBeDefined();
      expect(database.core_tools.prettier).toBeDefined();
      expect(database.experimental_tools).toBeDefined();
      expect(database.experimental_tools.biome).toBeDefined();
    });

    it('should get core tool configuration', async () => {
      // Arrange
      const mockToolsPath = path.join(__dirname, '../fixtures/mock-tools.json');
      const mockData = await fs.readJson(mockToolsPath);
      await fs.ensureDir(path.dirname(mockLocalFallbackPath));
      await fs.writeJson(mockLocalFallbackPath, mockData);

      // Act
      const eslintConfig = await manager.getCoreToolConfig('eslint');
      const nonExistentConfig = await manager.getCoreToolConfig('nonexistent');

      // Assert
      expect(eslintConfig).toBeDefined();
      expect(eslintConfig?.name).toBe('ESLint');
      expect(eslintConfig?.languages).toContain('javascript');
      expect(eslintConfig?.languages).toContain('typescript');
      expect(eslintConfig?.priority).toBe('high');
      
      expect(nonExistentConfig).toBeNull();
    });

    it('should get framework recommendations', async () => {
      // Arrange
      const mockToolsPath = path.join(__dirname, '../fixtures/mock-tools.json');
      const mockData = await fs.readJson(mockToolsPath);
      await fs.ensureDir(path.dirname(mockLocalFallbackPath));
      await fs.writeJson(mockLocalFallbackPath, mockData);

      // Act
      const reactRecs = await manager.getFrameworkRecommendations('react');
      const nonExistentRecs = await manager.getFrameworkRecommendations('nonexistent');

      // Assert
      expect(reactRecs).toBeDefined();
      expect(reactRecs?.core_tools).toEqual(expect.arrayContaining(['eslint', 'prettier']));
      expect(reactRecs?.experimental_tools).toEqual(['biome']);
      
      expect(nonExistentRecs).toBeNull();
    });

    it('should get deprecation information', async () => {
      // Arrange
      const mockToolsPath = path.join(__dirname, '../fixtures/mock-tools.json');
      const mockData = await fs.readJson(mockToolsPath);
      await fs.ensureDir(path.dirname(mockLocalFallbackPath));
      await fs.writeJson(mockLocalFallbackPath, mockData);

      // Act
      const tslintDeprecation = await manager.getDeprecationInfo('tslint');
      const nonExistentDeprecation = await manager.getDeprecationInfo('nonexistent');

      // Assert
      expect(tslintDeprecation).toBeDefined();
      expect(tslintDeprecation?.reason).toBe('TSLint is deprecated and no longer maintained');
      expect(tslintDeprecation?.successor).toBe('eslint');
      expect((tslintDeprecation as any)?.sunset_date).toBe('2021-12-01');
      
      expect(nonExistentDeprecation).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted JSON files gracefully', async () => {
      // Arrange: Create corrupted JSON file
      await fs.ensureDir(path.dirname(mockAIModelsLocalFallbackPath));
      await fs.writeFile(mockAIModelsLocalFallbackPath, '{invalid json}');

      // Act & Assert: Should fall back to minimal database
      const database = await manager.getAIModelsDatabase();
      expect(database).toBeDefined();
      expect(database.version).toBe('1.0.0');
    });

    it('should handle missing directories gracefully', async () => {
      // Act: Try to access database without creating directories
      const database = await manager.getAIModelsDatabase();

      // Assert: Should still work with minimal fallback
      expect(database).toBeDefined();
      expect(database.version).toBe('1.0.0');
    });
  });
});