import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import https from 'https';

// Core Tool Definition - Secure plugins with dynamic configuration
export interface CoreTool {
  name: string;
  description: string;
  languages: string[];
  fileExtensions: string[];
  frameworks: string[];
  recommended_flags: string[];
  config_files: string[];
  isDeprecated: boolean;
  popularity: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  plugin_class: string; // Maps to actual plugin implementation
  metadata: {
    npm_package?: string;
    pypi_package?: string;
    crate_name?: string;
    github_repo: string;
    weekly_downloads: number;
    last_check: string;
  };
}

// Experimental Tool Definition - Dynamic command templates
export interface ExperimentalTool {
  name: string;
  description: string;
  languages: string[];
  fileExtensions: string[];
  frameworks: string[];
  commandTemplate: string; // Template like "npx biome lint {filePath} --apply"
  installCommand: string;
  configFiles: string[];
  isExperimental: boolean;
  popularity: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  metadata: {
    npm_package?: string;
    pypi_package?: string;
    github_repo: string;
    weekly_downloads: number;
    trending: boolean;
    last_check: string;
  };
}

// Hybrid Tools Database Interface
export interface HybridToolsDatabase {
  version: string;
  lastUpdated: string;
  schema_version: string;

  // Core secure plugins with dynamic configuration
  core_tools: {
    [toolName: string]: CoreTool;
  };

  // Experimental tools with command templates
  experimental_tools: {
    [toolName: string]: ExperimentalTool;
  };

  // Deprecation warnings
  deprecation_warnings: {
    [toolName: string]: {
      name: string;
      reason: string;
      successor: string;
      migration_guide: string;
      sunset_date: string | null;
    };
  };

  // Framework-specific recommendations
  framework_recommendations: {
    [frameworkName: string]: {
      core_tools: string[];
      experimental_tools: string[];
      [configType: string]: any; // eslint_config, prettier_config, etc.
    };
  };

  // Legacy category structure for backward compatibility
  legacy_categories?: {
    [categoryName: string]: {
      description: string;
      tools: {
        [toolName: string]: any;
      };
    };
  };

  meta: {
    source_url: string;
    update_frequency: string;
    maintainers: string[];
    schema_documentation: string;
    version_history: Array<{
      version: string;
      date: string;
      changes: string;
    }>;
  };
}

// Backward compatibility interface
export interface ToolsDatabase {
  version: string;
  lastUpdated: string;
  categories: {
    [categoryName: string]: {
      description: string;
      tools: {
        [toolName: string]: {
          name: string;
          languages: string[];
          frameworks: string[] | { [framework: string]: string };
          popularity: number;
          keywords: string[];
          installCommand: string | { [platform: string]: string };
          configFiles?: string[];
          description: string;
          homepage: string;
          isRecommended: boolean;
          isNewAndTrending?: boolean;
          successorOf?: string;
          priority?: 'critical' | 'high' | 'medium' | 'low';
          filePatterns?: { [type: string]: string[] };

          // Enriched ecosystem data (added by update script)
          downloads?: {
            weekly: number;
            lastWeek: string;
          };
          stars?: number;
          lastCommit?: string;
          lastRelease?: string;
          openIssues?: number;
          contributors?: number;
          isDeprecated?: boolean;
          successor?: string;
          lastDataUpdate?: string;
        };
      };
    };
  };
  frameworks: {
    [frameworkName: string]: {
      name: string;
      language: string;
      keywords: string[];
      recommendedTools: {
        [category: string]: string[];
      };
    };
  };
  meta: {
    sourceUrl: string;
    updateFrequency: string;
    maintainers: string[];
    schemaVersion: string;
  };
}

// AI Models Database Interface
export interface AIModel {
  id: string;
  name: string;
  description: string;
  isLatest: boolean;
  category: 'flagship' | 'fast' | 'balanced' | 'specialized' | 'reliable';
  contextWindow: number;
  supportedFeatures: string[];
}

export interface AIProvider {
  name: string;
  description: string;
  apiKeyEnvVar: string;
  baseUrl: string;
  providerType: string;
  headers: Record<string, string>;
  bodyTemplate: string;
  timeout: number;
  maxTokens: number;
  temperature: number;
  models: AIModel[];
}

export interface AIModelsDatabase {
  version: string;
  lastUpdated: string;
  llm_providers: Record<string, AIProvider>;
}

export class ToolsDatabaseManager {
  private cacheDir: string;
  private cacheFilePath: string;
  private aiModelsCacheFilePath: string;
  private defaultSourceUrl: string;
  private aiModelsSourceUrl: string;
  private localFallbackPath: string;
  private aiModelsLocalFallbackPath: string;

  constructor() {
    this.cacheDir = path.join(os.homedir(), '.woaru', 'cache');
    this.cacheFilePath = path.join(this.cacheDir, 'tools.json');
    this.aiModelsCacheFilePath = path.join(this.cacheDir, 'ai-models.json');
    this.defaultSourceUrl =
      'https://raw.githubusercontent.com/iamthamanic/WOARU-WorkaroundUltra/main/tools.json';
    this.aiModelsSourceUrl =
      'https://raw.githubusercontent.com/iamthamanic/WOARU-WorkaroundUltra/main/ai-models.json';

    // Fallback to local files in project root
    this.localFallbackPath = path.join(__dirname, '..', '..', 'tools.json');
    this.aiModelsLocalFallbackPath = path.join(
      __dirname,
      '..',
      '..',
      'ai-models.json'
    );
  }

  /**
   * Gets the hybrid tools database, loading from cache or downloading if needed
   */
  async getHybridDatabase(): Promise<HybridToolsDatabase> {
    try {
      // Ensure cache directory exists
      await fs.ensureDir(this.cacheDir);

      // Check if cached version exists
      if (await fs.pathExists(this.cacheFilePath)) {
        try {
          const cachedData = await fs.readJson(this.cacheFilePath);

          // Check if it's the new hybrid format
          if (
            cachedData.schema_version === '2.0' &&
            cachedData.core_tools &&
            cachedData.experimental_tools
          ) {
            return cachedData as HybridToolsDatabase;
          } else {
            console.log(
              '🔄 WOARU: Outdated database format, downloading hybrid version...'
            );
          }
        } catch (error) {
          console.warn(
            '🔄 WOARU: Cached tools database is corrupted, downloading fresh copy...'
          );
        }
      }

      // No cache or outdated format - download fresh copy
      console.log('📥 WOARU: Downloading hybrid tools database...');
      const freshData = await this.downloadHybridDatabase();

      // Save to cache
      await fs.writeJson(this.cacheFilePath, freshData, { spaces: 2 });
      console.log('✅ WOARU: Hybrid tools database cached successfully');

      return freshData;
    } catch (error) {
      console.warn(
        '⚠️ WOARU: Failed to download hybrid database, using local fallback'
      );
      return this.loadHybridLocalFallback();
    }
  }

  /**
   * Gets the legacy tools database format (for backward compatibility)
   */
  async getDatabase(): Promise<ToolsDatabase> {
    try {
      const hybridDb = await this.getHybridDatabase();

      // Convert hybrid database to legacy format for backward compatibility
      return this.convertHybridToLegacy(hybridDb);
    } catch (error) {
      console.warn(
        '⚠️ WOARU: Failed to get hybrid database, falling back to legacy'
      );
      return this.loadLegacyDatabase();
    }
  }

  /**
   * Downloads the hybrid tools database from remote source
   */
  async downloadHybridDatabase(): Promise<HybridToolsDatabase> {
    return new Promise((resolve, reject) => {
      const request = https.get(this.defaultSourceUrl, response => {
        if (response.statusCode !== 200) {
          reject(
            new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`)
          );
          return;
        }

        let data = '';
        response.on('data', chunk => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            const parsedData = JSON.parse(data) as HybridToolsDatabase;

            // Validate hybrid format
            if (!parsedData.core_tools || !parsedData.experimental_tools) {
              reject(new Error('Invalid hybrid database format'));
              return;
            }

            resolve(parsedData);
          } catch (error) {
            reject(new Error(`Failed to parse hybrid JSON: ${error}`));
          }
        });
      });

      request.on('error', error => {
        reject(error);
      });

      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });
    });
  }

  /**
   * Legacy database loading for backward compatibility
   */
  private async loadLegacyDatabase(): Promise<ToolsDatabase> {
    try {
      // Ensure cache directory exists
      await fs.ensureDir(this.cacheDir);

      // Check if cached version exists
      if (await fs.pathExists(this.cacheFilePath)) {
        try {
          const cachedData = await fs.readJson(this.cacheFilePath);

          // Check if cached data has legacy format
          if (cachedData.categories && !cachedData.core_tools) {
            return cachedData as ToolsDatabase;
          } else {
            console.log(
              '🔄 WOARU: Cached database is hybrid format, converting to legacy...'
            );
            const hybridData = cachedData as HybridToolsDatabase;
            return this.convertHybridToLegacy(hybridData);
          }
        } catch (error) {
          console.warn(
            '🔄 WOARU: Cached tools database is corrupted, downloading fresh copy...'
          );
        }
      }

      // No cache - download fresh copy
      console.log('📥 WOARU: Downloading tools database...');
      const freshData = await this.downloadDatabase();

      // Save to cache
      await fs.writeJson(this.cacheFilePath, freshData, { spaces: 2 });
      console.log('✅ WOARU: Tools database cached successfully');

      return freshData;
    } catch (error) {
      console.warn(
        '⚠️ WOARU: Failed to download tools database, using local fallback'
      );
      return this.loadLocalFallback();
    }
  }

  /**
   * Downloads the tools database from the remote source
   */
  private async downloadDatabase(): Promise<ToolsDatabase> {
    return new Promise((resolve, reject) => {
      const request = https.get(this.defaultSourceUrl, response => {
        if (response.statusCode !== 200) {
          reject(
            new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`)
          );
          return;
        }

        let data = '';
        response.on('data', chunk => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            const parsedData = JSON.parse(data);
            resolve(parsedData as ToolsDatabase);
          } catch (error) {
            reject(new Error(`Failed to parse JSON: ${error}`));
          }
        });
      });

      request.on('error', error => {
        reject(error);
      });

      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });
    });
  }

  /**
   * Loads the local fallback tools.json from project root
   */
  private async loadLocalFallback(): Promise<ToolsDatabase> {
    try {
      if (await fs.pathExists(this.localFallbackPath)) {
        const localData = await fs.readJson(this.localFallbackPath);
        return localData as ToolsDatabase;
      }
    } catch (error) {
      console.warn('⚠️ WOARU: Local fallback also failed');
    }

    // Ultimate fallback - minimal database
    return this.getMinimalDatabase();
  }

  /**
   * Returns a minimal database as last resort
   */
  private getMinimalDatabase(): ToolsDatabase {
    return {
      version: '1.0.0-minimal',
      lastUpdated: new Date().toISOString(),
      categories: {
        linting: {
          description: 'Code quality tools',
          tools: {
            eslint: {
              name: 'ESLint',
              languages: ['javascript', 'typescript'],
              frameworks: ['react', 'vue', 'angular'],
              popularity: 95,
              keywords: ['eslint'],
              installCommand: 'npm install -D eslint',
              description: 'JavaScript and TypeScript linter',
              homepage: 'https://eslint.org',
              isRecommended: true,
            },
          },
        },
      },
      frameworks: {},
      meta: {
        sourceUrl: 'fallback',
        updateFrequency: 'manual',
        maintainers: ['WOARU'],
        schemaVersion: '1.0',
      },
    };
  }

  /**
   * Gets the last update time of the cached database
   */
  async getCacheInfo(): Promise<{
    exists: boolean;
    lastModified?: Date;
    version?: string;
  }> {
    try {
      if (await fs.pathExists(this.cacheFilePath)) {
        const stats = await fs.stat(this.cacheFilePath);
        const data = await fs.readJson(this.cacheFilePath);
        return {
          exists: true,
          lastModified: stats.mtime,
          version: data.version,
        };
      }
    } catch (error) {
      // Ignore errors
    }

    return { exists: false };
  }

  /**
   * Forces a fresh download and cache update
   */
  async forceUpdate(): Promise<ToolsDatabase> {
    try {
      console.log('🔄 WOARU: Force updating tools database...');
      const freshData = await this.downloadDatabase();

      // Ensure cache directory exists
      await fs.ensureDir(this.cacheDir);

      // Save to cache
      await fs.writeJson(this.cacheFilePath, freshData, { spaces: 2 });
      console.log('✅ WOARU: Tools database updated successfully');

      return freshData;
    } catch (error) {
      console.error('❌ WOARU: Failed to force update tools database:', error);
      throw error;
    }
  }

  /**
   * Clears the cache
   */
  async clearCache(): Promise<void> {
    try {
      if (await fs.pathExists(this.cacheFilePath)) {
        await fs.remove(this.cacheFilePath);
        console.log('🗑️ WOARU: Tools database cache cleared');
      }
    } catch (error) {
      console.warn('⚠️ WOARU: Failed to clear cache:', error);
    }
  }

  /**
   * Gets tools by category
   */
  async getToolsByCategory(category: string): Promise<any> {
    const database = await this.getDatabase();
    return database.categories[category]?.tools || {};
  }

  /**
   * Gets recommended tools for a framework
   */
  async getRecommendedToolsForFramework(
    framework: string
  ): Promise<{ [category: string]: string[] }> {
    const database = await this.getDatabase();
    return database.frameworks[framework]?.recommendedTools || {};
  }

  /**
   * Searches for tools by keywords
   */
  async searchToolsByKeywords(keywords: string[]): Promise<any[]> {
    const database = await this.getDatabase();
    const results: any[] = [];

    Object.entries(database.categories).forEach(([categoryName, category]) => {
      Object.entries(category.tools).forEach(([toolKey, tool]) => {
        const hasKeyword = keywords.some(keyword =>
          tool.keywords.some(toolKeyword =>
            toolKeyword.toLowerCase().includes(keyword.toLowerCase())
          )
        );

        if (hasKeyword) {
          results.push({
            ...tool,
            key: toolKey,
            category: categoryName,
          });
        }
      });
    });

    return results;
  }

  /**
   * Checks for updates in the background and updates cache if newer version available
   * Enhanced version with version comparison and detailed logging
   */
  async checkForUpdates(): Promise<boolean> {
    try {
      // Get cache info
      const cacheInfo = await this.getCacheInfo();

      if (!cacheInfo.exists) {
        // No cache exists, download fresh copy
        console.log('📥 WOARU: No local tools database found, downloading...');
        await this.getDatabase();
        return true;
      }

      // Check remote version info
      const remoteVersionInfo = await this.getRemoteVersionInfo();

      if (!remoteVersionInfo) {
        return false; // Cannot determine remote version
      }

      // Compare versions and timestamps
      const needsUpdate = this.shouldUpdate(cacheInfo, remoteVersionInfo);

      if (needsUpdate) {
        console.log('🔄 WOARU: Newer tools database found, updating...');
        console.log(
          `   Local: ${cacheInfo.version || 'unknown'} → Remote: ${remoteVersionInfo.version}`
        );

        // Download and cache new version
        const freshData = await this.downloadDatabase();
        await fs.writeJson(this.cacheFilePath, freshData, { spaces: 2 });

        // Log update details
        const toolCount = this.countToolsInDatabase(freshData);
        console.log('💡 WOARU tools database updated successfully');
        console.log(
          `   📊 ${toolCount.total} tools across ${toolCount.categories} categories`
        );
        console.log(
          `   🆕 Version: ${freshData.version} (${freshData.lastUpdated})`
        );

        return true;
      }

      return false; // No update needed
    } catch (error) {
      // Enhanced error handling for debugging
      if (process.env.WOARU_DEBUG) {
        console.warn('⚠️ WOARU: Database update check failed:', error);
      }
      return false;
    }
  }

  /**
   * Gets the last-modified date from remote source using HEAD request
   */
  private async getRemoteLastModified(): Promise<Date | null> {
    return new Promise(resolve => {
      const request = https.request(
        this.defaultSourceUrl,
        { method: 'HEAD' },
        response => {
          const lastModified = response.headers['last-modified'];
          if (lastModified) {
            resolve(new Date(lastModified));
          } else {
            resolve(null);
          }
        }
      );

      request.on('error', () => {
        resolve(null);
      });

      request.setTimeout(5000, () => {
        request.destroy();
        resolve(null);
      });

      request.end();
    });
  }

  /**
   * Starts background update checking (call this when WOARU starts)
   */
  async startBackgroundUpdates(): Promise<void> {
    // Check for updates immediately (but don't wait)
    this.checkForUpdates().catch(() => {
      // Silently ignore errors in background
    });

    // Set up periodic checking every 24 hours
    setInterval(
      async () => {
        this.checkForUpdates().catch(() => {
          // Silently ignore errors in background
        });
      },
      24 * 60 * 60 * 1000
    ); // 24 hours
  }

  /**
   * Gets remote version information including version and last modified date
   */
  private async getRemoteVersionInfo(): Promise<{
    version: string;
    lastModified: Date;
  } | null> {
    try {
      // First try to get the file to read version
      const remoteData = await this.downloadDatabase();
      const lastModified = await this.getRemoteLastModified();

      return {
        version: remoteData.version,
        lastModified: lastModified || new Date(),
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Determines if local cache should be updated based on version and timestamp
   */
  private shouldUpdate(
    localInfo: { exists: boolean; lastModified?: Date; version?: string },
    remoteInfo: { version: string; lastModified: Date }
  ): boolean {
    // Always update if no local version exists
    if (!localInfo.exists || !localInfo.version) {
      return true;
    }

    // Compare versions (semantic versioning)
    if (this.isNewerVersion(remoteInfo.version, localInfo.version)) {
      return true;
    }

    // Fallback to timestamp comparison if versions are same
    if (
      localInfo.lastModified &&
      remoteInfo.lastModified > localInfo.lastModified
    ) {
      return true;
    }

    return false;
  }

  /**
   * Compares two semantic version strings
   */
  private isNewerVersion(remoteVersion: string, localVersion: string): boolean {
    const parseVersion = (version: string) => {
      const parts = version.replace(/^v/, '').split('.').map(Number);
      return {
        major: parts[0] || 0,
        minor: parts[1] || 0,
        patch: parts[2] || 0,
      };
    };

    const remote = parseVersion(remoteVersion);
    const local = parseVersion(localVersion);

    if (remote.major !== local.major) return remote.major > local.major;
    if (remote.minor !== local.minor) return remote.minor > local.minor;
    return remote.patch > local.patch;
  }

  /**
   * Counts tools and categories in database for logging
   */
  private countToolsInDatabase(database: ToolsDatabase): {
    total: number;
    categories: number;
  } {
    let total = 0;
    const categories = Object.keys(database.categories).length;

    Object.values(database.categories).forEach(category => {
      total += Object.keys(category.tools).length;
    });

    return { total, categories };
  }

  /**
   * Gets database statistics for debugging
   */
  async getDatabaseStats(): Promise<{
    version: string;
    toolCount: number;
    categories: string[];
    lastUpdated: string;
  }> {
    const database = await this.getDatabase();
    const toolCount = this.countToolsInDatabase(database);

    return {
      version: database.version,
      toolCount: toolCount.total,
      categories: Object.keys(database.categories),
      lastUpdated: database.lastUpdated,
    };
  }

  // ========== HYBRID DATABASE METHODS ==========

  /**
   * Gets core tool configuration for a specific tool
   */
  async getCoreToolConfig(toolName: string): Promise<CoreTool | null> {
    try {
      const hybridDb = await this.getHybridDatabase();
      return hybridDb.core_tools[toolName] || null;
    } catch (error) {
      console.warn(`Failed to get core tool config for ${toolName}:`, error);
      return null;
    }
  }

  /**
   * Gets experimental tool configuration for a specific tool
   */
  async getExperimentalToolConfig(
    toolName: string
  ): Promise<ExperimentalTool | null> {
    try {
      const hybridDb = await this.getHybridDatabase();
      return hybridDb.experimental_tools[toolName] || null;
    } catch (error) {
      console.warn(
        `Failed to get experimental tool config for ${toolName}:`,
        error
      );
      return null;
    }
  }

  /**
   * Gets all core tools that support a specific file extension
   */
  async getCoreToolsForFileExtension(
    fileExtension: string
  ): Promise<CoreTool[]> {
    try {
      const hybridDb = await this.getHybridDatabase();
      const coreTools: CoreTool[] = [];

      Object.values(hybridDb.core_tools).forEach(tool => {
        if (tool.fileExtensions.includes(fileExtension)) {
          coreTools.push(tool);
        }
      });

      return coreTools.sort((a, b) => b.popularity - a.popularity);
    } catch (error) {
      console.warn(
        `Failed to get core tools for extension ${fileExtension}:`,
        error
      );
      return [];
    }
  }

  /**
   * Gets all experimental tools that support a specific file extension
   */
  async getExperimentalToolsForFileExtension(
    fileExtension: string
  ): Promise<ExperimentalTool[]> {
    try {
      const hybridDb = await this.getHybridDatabase();
      const experimentalTools: ExperimentalTool[] = [];

      Object.values(hybridDb.experimental_tools).forEach(tool => {
        if (tool.fileExtensions.includes(fileExtension)) {
          experimentalTools.push(tool);
        }
      });

      return experimentalTools.sort((a, b) => b.popularity - a.popularity);
    } catch (error) {
      console.warn(
        `Failed to get experimental tools for extension ${fileExtension}:`,
        error
      );
      return [];
    }
  }

  /**
   * Gets framework-specific tool recommendations
   */
  async getFrameworkRecommendations(
    framework: string
  ): Promise<{ core_tools: string[]; experimental_tools: string[] } | null> {
    try {
      const hybridDb = await this.getHybridDatabase();
      const recommendations = hybridDb.framework_recommendations[framework];

      if (recommendations) {
        return {
          core_tools: recommendations.core_tools || [],
          experimental_tools: recommendations.experimental_tools || [],
        };
      }

      return null;
    } catch (error) {
      console.warn(
        `Failed to get framework recommendations for ${framework}:`,
        error
      );
      return null;
    }
  }

  /**
   * Checks if a tool is deprecated and returns successor info
   */
  async getDeprecationInfo(toolName: string): Promise<{
    name: string;
    reason: string;
    successor: string;
    migration_guide: string;
  } | null> {
    try {
      const hybridDb = await this.getHybridDatabase();
      return hybridDb.deprecation_warnings[toolName] || null;
    } catch (error) {
      return null;
    }
  }

  // ========== HELPER METHODS ==========

  /**
   * Converts hybrid database to legacy format for backward compatibility
   */
  private convertHybridToLegacy(hybridDb: HybridToolsDatabase): ToolsDatabase {
    const legacyDb: ToolsDatabase = {
      version: hybridDb.version,
      lastUpdated: hybridDb.lastUpdated,
      categories: {},
      frameworks: {},
      meta: {
        sourceUrl: hybridDb.meta.source_url,
        updateFrequency: hybridDb.meta.update_frequency,
        maintainers: hybridDb.meta.maintainers,
        schemaVersion: hybridDb.schema_version,
      },
    };

    // Use legacy_categories if available, otherwise create from core_tools
    if (hybridDb.legacy_categories) {
      legacyDb.categories = hybridDb.legacy_categories;
    } else {
      // Convert core_tools to legacy category format
      legacyDb.categories = this.createLegacyCategoriesFromCoreTools(hybridDb);
    }

    return legacyDb;
  }

  /**
   * Creates legacy categories structure from core tools
   */
  private createLegacyCategoriesFromCoreTools(
    hybridDb: HybridToolsDatabase
  ): ToolsDatabase['categories'] {
    const categories: ToolsDatabase['categories'] = {
      linting: {
        description: 'Code quality and style checking tools',
        tools: {},
      },
      formatting: { description: 'Code formatting tools', tools: {} },
      security: {
        description: 'Security and vulnerability scanning tools',
        tools: {},
      },
    };

    // Map core tools to categories based on tool type
    Object.entries(hybridDb.core_tools).forEach(([toolKey, tool]) => {
      let category = 'linting'; // default

      if (
        tool.name.toLowerCase().includes('format') ||
        toolKey === 'prettier'
      ) {
        category = 'formatting';
      } else if (
        tool.name.toLowerCase().includes('security') ||
        tool.name.toLowerCase().includes('secure')
      ) {
        category = 'security';
      }

      categories[category].tools[toolKey] = {
        name: tool.name,
        languages: tool.languages,
        frameworks: tool.frameworks,
        popularity: tool.popularity,
        keywords: [tool.metadata.npm_package || toolKey],
        installCommand: `npm install -D ${tool.metadata.npm_package || toolKey}`,
        configFiles: tool.config_files,
        description: tool.description,
        homepage: `https://github.com/${tool.metadata.github_repo}`,
        isRecommended: tool.priority === 'high' || tool.priority === 'critical',
        isDeprecated: tool.isDeprecated,
      };
    });

    return categories;
  }

  /**
   * Loads hybrid local fallback
   */
  private async loadHybridLocalFallback(): Promise<HybridToolsDatabase> {
    try {
      if (await fs.pathExists(this.localFallbackPath)) {
        const localData = await fs.readJson(this.localFallbackPath);

        // Check if it's hybrid format
        if (localData.schema_version === '2.0' && localData.core_tools) {
          return localData as HybridToolsDatabase;
        }
      }
    } catch (error) {
      console.warn('⚠️ WOARU: Local hybrid fallback also failed');
    }

    // Ultimate fallback - minimal hybrid database
    return this.getMinimalHybridDatabase();
  }

  /**
   * Returns minimal hybrid database as last resort
   */
  private getMinimalHybridDatabase(): HybridToolsDatabase {
    return {
      version: '3.2.0-minimal',
      lastUpdated: new Date().toISOString(),
      schema_version: '2.0',
      core_tools: {
        eslint: {
          name: 'ESLint',
          description: 'JavaScript and TypeScript linter',
          languages: ['javascript', 'typescript'],
          fileExtensions: ['.js', '.jsx', '.ts', '.tsx'],
          frameworks: ['react', 'vue', 'angular'],
          recommended_flags: ['--fix'],
          config_files: ['.eslintrc.js', '.eslintrc.json'],
          isDeprecated: false,
          popularity: 95,
          priority: 'high',
          plugin_class: 'EslintPlugin',
          metadata: {
            npm_package: 'eslint',
            github_repo: 'eslint/eslint',
            weekly_downloads: 25000000,
            last_check: new Date().toISOString(),
          },
        },
      },
      experimental_tools: {},
      deprecation_warnings: {},
      framework_recommendations: {},
      meta: {
        source_url: 'fallback',
        update_frequency: 'manual',
        maintainers: ['WOARU'],
        schema_documentation: '',
        version_history: [],
      },
    };
  }

  // ========== AI MODELS DATABASE METHODS ==========

  /**
   * Gets the AI models database, loading from cache or downloading if needed
   */
  async getAIModelsDatabase(): Promise<AIModelsDatabase> {
    try {
      // First try local file for development
      if (await fs.pathExists(this.aiModelsLocalFallbackPath)) {
        try {
          const localData = await fs.readJson(this.aiModelsLocalFallbackPath);
          if (localData.llm_providers && localData.version) {
            console.log('✅ WOARU: Using local AI models database');
            return localData as AIModelsDatabase;
          }
        } catch (error) {
          // Continue to cache/remote fallback
        }
      }

      // Ensure cache directory exists
      await fs.ensureDir(this.cacheDir);

      // Check if cached version exists
      if (await fs.pathExists(this.aiModelsCacheFilePath)) {
        try {
          const cachedData = await fs.readJson(this.aiModelsCacheFilePath);

          // Check if it's a valid AI models database
          if (cachedData.llm_providers && cachedData.version) {
            return cachedData as AIModelsDatabase;
          } else {
            console.log(
              '🔄 WOARU: Outdated AI models database format, downloading new version...'
            );
          }
        } catch (error) {
          console.warn(
            '🔄 WOARU: Cached AI models database is corrupted, downloading fresh copy...'
          );
        }
      }

      // No cache or outdated format - download fresh copy
      console.log('📥 WOARU: Downloading AI models database...');
      const freshData = await this.downloadAIModelsDatabase();

      // Save to cache
      await fs.writeJson(this.aiModelsCacheFilePath, freshData, { spaces: 2 });
      console.log('✅ WOARU: AI models database cached successfully');

      return freshData;
    } catch (error) {
      console.warn(
        '⚠️ WOARU: Failed to download AI models database, using local fallback'
      );
      return this.loadAIModelsLocalFallback();
    }
  }

  /**
   * Downloads the AI models database from remote source
   */
  private async downloadAIModelsDatabase(): Promise<AIModelsDatabase> {
    return new Promise((resolve, reject) => {
      const request = https.get(this.aiModelsSourceUrl, response => {
        if (response.statusCode !== 200) {
          reject(
            new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`)
          );
          return;
        }

        let data = '';
        response.on('data', chunk => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            const parsedData = JSON.parse(data) as AIModelsDatabase;

            // Validate AI models database format
            if (!parsedData.llm_providers || !parsedData.version) {
              reject(new Error('Invalid AI models database format'));
              return;
            }

            resolve(parsedData);
          } catch (error) {
            reject(new Error(`Failed to parse AI models JSON: ${error}`));
          }
        });
      });

      request.on('error', error => {
        reject(error);
      });

      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });
    });
  }

  /**
   * Loads the local fallback ai-models.json from project root
   */
  private async loadAIModelsLocalFallback(): Promise<AIModelsDatabase> {
    try {
      if (await fs.pathExists(this.aiModelsLocalFallbackPath)) {
        const localData = await fs.readJson(this.aiModelsLocalFallbackPath);
        return localData as AIModelsDatabase;
      }
    } catch (error) {
      console.warn('⚠️ WOARU: Local AI models fallback also failed');
    }

    // Ultimate fallback - minimal AI models database
    return this.getMinimalAIModelsDatabase();
  }

  /**
   * Returns a minimal AI models database as last resort
   */
  private getMinimalAIModelsDatabase(): AIModelsDatabase {
    return {
      version: '1.0.0-minimal',
      lastUpdated: new Date().toISOString(),
      llm_providers: {
        anthropic: {
          name: 'Anthropic Claude',
          description: 'Advanced AI assistant models by Anthropic',
          apiKeyEnvVar: 'ANTHROPIC_API_KEY',
          baseUrl: 'https://api.anthropic.com/v1/messages',
          providerType: 'anthropic',
          headers: {
            'anthropic-version': '2023-06-01',
          },
          bodyTemplate:
            '{"model":"{model}","max_tokens":4000,"temperature":0.1,"messages":[{"role":"user","content":"{prompt}\\n\\nCode to analyze:\\n```{language}\\n{code}\\n```"}]}',
          timeout: 30000,
          maxTokens: 4000,
          temperature: 0.1,
          models: [
            {
              id: 'claude-3-5-sonnet-20241022',
              name: 'Claude 3.5 Sonnet',
              description: 'Most capable model with superior reasoning',
              isLatest: true,
              category: 'flagship',
              contextWindow: 200000,
              supportedFeatures: ['code_analysis', 'reasoning', 'writing'],
            },
          ],
        },
      },
    };
  }

  /**
   * Gets all available AI providers
   */
  async getAIProviders(): Promise<Record<string, AIProvider>> {
    const database = await this.getAIModelsDatabase();
    return database.llm_providers;
  }

  /**
   * Gets models for a specific provider
   */
  async getModelsForProvider(providerName: string): Promise<AIModel[]> {
    const database = await this.getAIModelsDatabase();
    return database.llm_providers[providerName]?.models || [];
  }

  /**
   * Gets all available models from all providers
   */
  async getAllAIModels(): Promise<Array<AIModel & { provider: string }>> {
    const database = await this.getAIModelsDatabase();
    const allModels: Array<AIModel & { provider: string }> = [];

    Object.entries(database.llm_providers).forEach(
      ([providerName, provider]) => {
        provider.models.forEach(model => {
          allModels.push({
            ...model,
            provider: providerName,
          });
        });
      }
    );

    return allModels;
  }

  /**
   * Gets latest/flagship models from all providers
   */
  async getLatestAIModels(): Promise<Array<AIModel & { provider: string }>> {
    const allModels = await this.getAllAIModels();
    return allModels.filter(
      model => model.isLatest || model.category === 'flagship'
    );
  }

  /**
   * Gets models by category (flagship, fast, balanced, etc.)
   */
  async getModelsByCategory(
    category: string
  ): Promise<Array<AIModel & { provider: string }>> {
    const allModels = await this.getAllAIModels();
    return allModels.filter(model => model.category === category);
  }

  /**
   * Gets a specific model by ID across all providers
   */
  async getModelById(
    modelId: string
  ): Promise<(AIModel & { provider: string }) | null> {
    const allModels = await this.getAllAIModels();
    return allModels.find(model => model.id === modelId) || null;
  }

  /**
   * Gets provider configuration for a specific provider
   */
  async getProviderConfig(providerName: string): Promise<AIProvider | null> {
    const database = await this.getAIModelsDatabase();
    return database.llm_providers[providerName] || null;
  }

  /**
   * Forces update of AI models database
   */
  async forceUpdateAIModels(): Promise<AIModelsDatabase> {
    try {
      console.log('🔄 WOARU: Force updating AI models database...');
      const freshData = await this.downloadAIModelsDatabase();

      // Ensure cache directory exists
      await fs.ensureDir(this.cacheDir);

      // Save to cache
      await fs.writeJson(this.aiModelsCacheFilePath, freshData, { spaces: 2 });
      console.log('✅ WOARU: AI models database updated successfully');

      return freshData;
    } catch (error) {
      console.error(
        '❌ WOARU: Failed to force update AI models database:',
        error
      );
      throw error;
    }
  }

  /**
   * Gets AI models database statistics
   */
  async getAIModelsStats(): Promise<{
    version: string;
    providers: number;
    totalModels: number;
    providerNames: string[];
    lastUpdated: string;
  }> {
    const database = await this.getAIModelsDatabase();
    const providers = Object.keys(database.llm_providers);
    let totalModels = 0;

    providers.forEach(providerName => {
      totalModels += database.llm_providers[providerName].models.length;
    });

    return {
      version: database.version,
      providers: providers.length,
      totalModels,
      providerNames: providers,
      lastUpdated: database.lastUpdated,
    };
  }
}
