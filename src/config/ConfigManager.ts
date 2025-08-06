import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { APP_CONFIG } from './constants';
import chalk from 'chalk';
import {
  SchemaValidator,
  type AIConfigFile,
  type UserConfig,
} from '../schemas/ai-config.schema';
import { triggerHook, type ConfigLoadHookData } from '../core/HookSystem';

/**
 * ConfigManager - Secure management of WOARU configuration and API keys
 * Handles global .env file creation, security measures, and key storage
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private woaruDir: string;
  private configDir: string;
  private envFile: string;
  private aiConfigFile: string;
  private userConfigFile: string;

  private constructor() {
    this.woaruDir = path.join(os.homedir(), APP_CONFIG.DIRECTORIES.BASE);
    this.configDir = path.join(this.woaruDir, 'config');
    this.envFile = path.join(this.woaruDir, '.env');
    this.aiConfigFile = path.join(this.configDir, 'ai_config.json');
    this.userConfigFile = path.join(this.configDir, 'user.json');
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Initialize the WOARU configuration directory and security measures
   */
  async initialize(): Promise<void> {
    try {
      // Ensure .woaru directory exists
      await fs.ensureDir(this.woaruDir);

      // Ensure config subdirectory exists
      await fs.ensureDir(this.configDir);

      // Set up security measures
      await this.setupGitIgnoreProtection();

      // Ensure .env file exists (create empty if not)
      if (!(await fs.pathExists(this.envFile))) {
        await this.createEmptyEnvFile();
      }

      // Migration: Check for legacy llm_config.json and migrate to ai_config.json
      await this.migrateLegacyConfiguration();

      // Ensure AI config file exists (create empty if not)
      if (!(await fs.pathExists(this.aiConfigFile))) {
        await this.createEmptyAiConfigFile();
      }

      // Set secure permissions
      await this.setSecurePermissions();
    } catch (error) {
      console.warn(
        chalk.yellow(
          `⚠️ Warning: Could not fully initialize config security: ${error instanceof Error ? error.message : error}`
        )
      );
    }
  }

  /**
   * Store an API key securely in the global .env file
   */
  async storeApiKey(provider: string, apiKey: string): Promise<void> {
    try {
      await this.initialize();

      const envVarName = `${provider.toUpperCase()}_API_KEY`;

      // Read existing .env content
      let envContent = '';
      if (await fs.pathExists(this.envFile)) {
        envContent = await fs.readFile(this.envFile, 'utf-8');
      }

      // Remove existing entry for this provider if it exists
      const lines = envContent
        .split('\n')
        .filter(line => !line.startsWith(`${envVarName}=`));

      // Add new entry
      lines.push(`${envVarName}="${apiKey}"`);

      // Write back to file
      await fs.writeFile(this.envFile, lines.join('\n') + '\n');

      // Set secure permissions
      await this.setSecurePermissions();

      console.log(
        chalk.green(
          `✅ API key for ${provider} stored securely in ${this.envFile}`
        )
      );
    } catch (error) {
      throw new Error(
        `Failed to store API key: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Load all environment variables from the global .env file
   */
  async loadEnvironmentVariables(): Promise<void> {
    try {
      if (await fs.pathExists(this.envFile)) {
        const dotenv = await import('dotenv');
        // Suppress dotenv console output
        const originalLog = console.log;
        console.log = () => {};
        dotenv.config({ path: this.envFile });
        console.log = originalLog;
      }
    } catch (error) {
      console.warn(
        chalk.yellow(
          `⚠️ Warning: Could not load environment variables: ${error instanceof Error ? error.message : error}`
        )
      );
    }
  }

  /**
   * Get the path to the .env file
   */
  getEnvFilePath(): string {
    return this.envFile;
  }

  /**
   * Check if an API key exists for a provider
   */
  async hasApiKey(provider: string): Promise<boolean> {
    await this.loadEnvironmentVariables();
    const envVarName = `${provider.toUpperCase()}_API_KEY`;
    return !!process.env[envVarName];
  }

  /**
   * Alias for storeApiKey to maintain API compatibility
   */
  async saveApiKey(provider: string, apiKey: string): Promise<void> {
    return this.storeApiKey(provider, apiKey);
  }

  /**
   * Get an API key for a provider
   */
  async getApiKey(provider: string): Promise<string | undefined> {
    await this.loadEnvironmentVariables();
    const envVarName = `${provider.toUpperCase()}_API_KEY`;
    return process.env[envVarName];
  }

  /**
   * List all configured providers
   */
  async getConfiguredProviders(): Promise<string[]> {
    try {
      if (!(await fs.pathExists(this.envFile))) {
        return [];
      }

      const envContent = await fs.readFile(this.envFile, 'utf-8');
      const providers: string[] = [];

      envContent.split('\n').forEach(line => {
        const match = line.match(/^([A-Z_]+)_API_KEY=/);
        if (match) {
          providers.push(match[1].toLowerCase());
        }
      });

      return providers;
    } catch (error) {
      console.warn(
        chalk.yellow(
          `⚠️ Warning: Could not read providers: ${error instanceof Error ? error.message : error}`
        )
      );
      return [];
    }
  }

  /**
   * Remove an API key for a provider
   */
  async removeApiKey(provider: string): Promise<void> {
    try {
      if (!(await fs.pathExists(this.envFile))) {
        return;
      }

      const envVarName = `${provider.toUpperCase()}_API_KEY`;
      const envContent = await fs.readFile(this.envFile, 'utf-8');

      const lines = envContent
        .split('\n')
        .filter(line => !line.startsWith(`${envVarName}=`));

      await fs.writeFile(this.envFile, lines.join('\n'));
      await this.setSecurePermissions();

      console.log(chalk.green(`✅ API key for ${provider} removed`));
    } catch (error) {
      throw new Error(
        `Failed to remove API key: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Store AI configuration in global config file with Zod schema validation
   * 🛡️ REGEL: Alle Konfigurationsdateien MÜSSEN vor dem Speichern validiert werden
   */
  async storeAiConfig(config: Record<string, unknown>): Promise<void> {
    try {
      await this.initialize();

      // 🔒 Schema-Validierung vor dem Speichern - KI-freundliche Regelwelt
      const validation = SchemaValidator.validateAIConfig(config);

      if (!validation.success) {
        console.error(chalk.red('❌ Cannot store invalid AI config:'));
        validation.errors?.forEach(error => {
          console.error(chalk.red(`   • ${error}`));
        });
        throw new Error('AI configuration validation failed');
      }

      await fs.writeFile(
        this.aiConfigFile,
        JSON.stringify(validation.data, null, 2)
      );
      await this.setSecurePermissions();
      console.log(
        chalk.green(
          `✅ AI configuration validated and stored in ${this.aiConfigFile}`
        )
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('validation failed')
      ) {
        throw error; // Re-throw validation errors
      }
      throw new Error(
        `Failed to store AI config: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Load AI configuration from global config file with Zod schema validation
   * 🛡️ REGEL: Alle Konfigurationsdateien MÜSSEN validiert werden
   */
  async loadAiConfig(): Promise<AIConfigFile | Record<string, unknown>> {
    try {
      if (!(await fs.pathExists(this.aiConfigFile))) {
        console.log(
          chalk.gray('📄 No AI config file found, creating default config...')
        );
        return {};
      }

      const content = await fs.readFile(this.aiConfigFile, 'utf-8');
      const rawData = JSON.parse(content);

      // 🔒 Schema-Validierung - KI-freundliche Regelwelt
      const validation = SchemaValidator.validateAIConfig(rawData);

      if (validation.success && validation.data) {
        console.log(
          chalk.green('✅ AI config successfully validated against schema')
        );
        return validation.data;
      } else {
        console.error(chalk.red('❌ AI config validation failed:'));
        validation.errors?.forEach(error => {
          console.error(chalk.red(`   • ${error}`));
        });
        console.error(
          chalk.yellow('⚠️ Using fallback empty config to prevent crashes')
        );
        return {};
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error(chalk.red('❌ AI config contains invalid JSON:'));
        console.error(chalk.red(`   ${error.message}`));
        console.error(chalk.yellow('💡 Please fix the JSON syntax in:'));
        console.error(chalk.gray(`   ${this.aiConfigFile}`));
      } else {
        console.warn(
          chalk.yellow(
            `⚠️ Warning: Could not load AI config: ${error instanceof Error ? error.message : error}`
          )
        );
      }
      return {};
    }
  }

  /**
   * Save AI configuration to global config file
   */
  async saveAiConfig(config: Record<string, unknown>): Promise<void> {
    try {
      await this.initialize();
      await fs.writeFile(this.aiConfigFile, JSON.stringify(config, null, 2));
      await this.setSecurePermissions();
    } catch (error) {
      console.warn(
        chalk.yellow(
          `⚠️ Warning: Could not save AI config: ${error instanceof Error ? error.message : error}`
        )
      );
    }
  }

  /**
   * Check if a key is a metadata or configuration key (not a provider)
   */
  private isMetadataKey(key: string): boolean {
    return (
      key === '_metadata' ||
      key === 'multi_ai_review_enabled' ||
      key === 'primary_review_provider_id' ||
      key === 'multiAi' ||
      key === 'primaryProvider' ||
      key === 'lastDataUpdate' ||
      key.startsWith('_') // Any key starting with underscore is metadata
    );
  }

  /**
   * Get all configured AI providers
   */
  async getConfiguredAiProviders(): Promise<string[]> {
    try {
      const config = await this.loadAiConfig();
      const providers = [];

      for (const [key, value] of Object.entries(config)) {
        // Skip metadata and configuration entries
        if (this.isMetadataKey(key)) {
          continue;
        }

        // Only include actual provider objects
        if (
          value &&
          typeof value === 'object' &&
          Object.prototype.hasOwnProperty.call(value, 'enabled')
        ) {
          providers.push(key);
        }
      }

      return providers;
    } catch (error) {
      console.warn(
        chalk.yellow(
          `⚠️ Warning: Could not get AI providers: ${error instanceof Error ? error.message : error}`
        )
      );
      return [];
    }
  }

  /**
   * Get AI config file path
   */
  getAiConfigFilePath(): string {
    return this.aiConfigFile;
  }

  // Backward compatibility aliases
  /**
   * @deprecated Use storeAiConfig() instead
   * Backward compatibility alias for storing AI configuration
   */
  async storeLlmConfig(config: Record<string, unknown>): Promise<void> {
    return this.storeAiConfig(config);
  }

  /**
   * @deprecated Use loadAiConfig() instead
   * Backward compatibility alias for loading AI configuration
   */
  async loadLlmConfig(): Promise<Record<string, unknown>> {
    return this.loadAiConfig();
  }

  /**
   * @deprecated Use getConfiguredAiProviders() instead
   * Backward compatibility alias for getting configured providers
   */
  async getConfiguredLlmProviders(): Promise<string[]> {
    return this.getConfiguredAiProviders();
  }

  /**
   * @deprecated Use getAiConfigFilePath() instead
   * Backward compatibility alias for getting config file path
   */
  getLlmConfigFilePath(): string {
    return this.getAiConfigFilePath();
  }

  /**
   * Get config directory path
   */
  getConfigDirPath(): string {
    return this.configDir;
  }

  /**
   * Get Multi-AI Review configuration
   */
  async getMultiAiReviewConfig(): Promise<{
    enabled: boolean;
    primaryProvider: string | null;
  }> {
    const config = await this.loadAiConfig();
    return {
      enabled: Boolean(config.multi_ai_review_enabled) || false,
      primaryProvider: (config.primary_review_provider_id as string) || null,
    };
  }

  /**
   * Update Multi-AI Review configuration
   */
  async updateMultiAiReviewConfig(
    enabled: boolean,
    primaryProvider: string | null = null
  ): Promise<void> {
    const config = await this.loadAiConfig();
    config.multi_ai_review_enabled = enabled;
    config.primary_review_provider_id = primaryProvider;
    await this.storeAiConfig(config);
  }

  /**
   * Get all enabled AI providers
   */
  async getEnabledAiProviders(): Promise<string[]> {
    const config = await this.loadAiConfig();
    const enabledProviders = [];

    for (const [providerId, providerConfig] of Object.entries(config)) {
      // Skip metadata and configuration entries
      if (this.isMetadataKey(providerId)) {
        continue;
      }

      // Only include actual provider objects that are enabled
      if (
        providerConfig &&
        typeof providerConfig === 'object' &&
        Object.prototype.hasOwnProperty.call(providerConfig, 'enabled') &&
        (providerConfig as Record<string, unknown>).enabled
      ) {
        enabledProviders.push(providerId);
      }
    }

    return enabledProviders;
  }

  /**
   * Count configured AI providers
   */
  async getConfiguredProviderCount(): Promise<number> {
    const config = await this.loadAiConfig();
    let count = 0;

    for (const [providerId, providerConfig] of Object.entries(config)) {
      // Skip metadata and configuration entries
      if (this.isMetadataKey(providerId)) {
        continue;
      }

      // Only count actual provider objects
      if (
        providerConfig &&
        typeof providerConfig === 'object' &&
        Object.prototype.hasOwnProperty.call(providerConfig, 'enabled')
      ) {
        count++;
      }
    }

    return count;
  }

  /**
   * Create an empty .env file with header
   */
  private async createEmptyEnvFile(): Promise<void> {
    const header = `# WOARU API Keys - Managed by ConfigManager
# This file contains sensitive API keys - never commit to version control
# Generated on ${new Date().toISOString()}

`;
    await fs.writeFile(this.envFile, header);
  }

  /**
   * Create an empty AI config file
   */
  private async createEmptyAiConfigFile(): Promise<void> {
    const defaultConfig = {
      _metadata: {
        created: new Date().toISOString(),
        description: 'WOARU Global AI Configuration - Managed by ConfigManager',
      },
      multi_ai_review_enabled: false,
      primary_review_provider_id: null,
    };
    await fs.writeFile(
      this.aiConfigFile,
      JSON.stringify(defaultConfig, null, 2)
    );
  }

  /**
   * Set secure file permissions (600 - owner read/write only)
   */
  private async setSecurePermissions(): Promise<void> {
    try {
      if (process.platform !== 'win32') {
        await fs.chmod(this.envFile, 0o600);
        if (await fs.pathExists(this.aiConfigFile)) {
          await fs.chmod(this.aiConfigFile, 0o600);
        }
      }
    } catch (error) {
      console.warn(
        chalk.yellow(
          `⚠️ Warning: Could not set secure permissions: ${error instanceof Error ? error.message : error}`
        )
      );
    }
  }

  /**
   * Setup git ignore protection to prevent accidental commits
   */
  private async setupGitIgnoreProtection(): Promise<void> {
    const gitIgnorePaths = [
      path.join(os.homedir(), '.config', 'git', 'ignore'),
      path.join(os.homedir(), '.gitignore_global'),
      path.join(os.homedir(), '.gitignore'),
    ];

    let foundGitIgnore = false;

    for (const gitIgnorePath of gitIgnorePaths) {
      if (await fs.pathExists(gitIgnorePath)) {
        await this.addToGitIgnore(gitIgnorePath);
        foundGitIgnore = true;
        break;
      }
    }

    if (!foundGitIgnore) {
      console.log(
        chalk.yellow(
          '⚠️  Warning: No global .gitignore found. Consider creating one to prevent accidental commits:'
        )
      );
      console.log(chalk.gray('   echo "~/.woaru/.env" >> ~/.gitignore_global'));
      console.log(
        chalk.gray(
          '   git config --global core.excludesfile ~/.gitignore_global'
        )
      );
    }
  }

  /**
   * Add .env protection to gitignore file
   */
  private async addToGitIgnore(gitIgnorePath: string): Promise<void> {
    try {
      const ignoreEntries = ['~/.woaru/.env', '~/.woaru/config/'];
      const content = await fs.readFile(gitIgnorePath, 'utf-8').catch(() => '');

      let newContent = content;
      let hasChanges = false;

      for (const entry of ignoreEntries) {
        if (!content.includes(entry)) {
          newContent +=
            (newContent.endsWith('\n') ? '' : '\n') +
            `\n# WOARU configuration protection\n${entry}\n`;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await fs.writeFile(gitIgnorePath, newContent);
        console.log(
          chalk.green(`✅ Added WOARU config protection to ${gitIgnorePath}`)
        );
      }
    } catch (error) {
      console.warn(
        chalk.yellow(
          `⚠️ Warning: Could not update gitignore: ${error instanceof Error ? error.message : error}`
        )
      );
    }
  }

  /**
   * Migration function: Automatically migrate legacy llm_config.json to ai_config.json
   * This ensures existing user configurations are not lost during refactoring
   */
  private async migrateLegacyConfiguration(): Promise<void> {
    try {
      const legacyConfigFile = path.join(this.configDir, 'llm_config.json');

      // Check conditions for migration:
      // a. Legacy llm_config.json exists
      // b. New ai_config.json does NOT exist
      const legacyExists = await fs.pathExists(legacyConfigFile);
      const newExists = await fs.pathExists(this.aiConfigFile);

      if (legacyExists && !newExists) {
        // Perform automatic migration
        await fs.move(legacyConfigFile, this.aiConfigFile);

        // Inform user about the migration
        console.log(
          chalk.cyan(
            "ℹ️ WOARU-Konfiguration wurde automatisch auf das neue 'ai'-Format migriert."
          )
        );
        console.log(
          chalk.gray(`   ${legacyConfigFile} → ${this.aiConfigFile}`)
        );
        console.log(
          chalk.gray('   Alle bestehenden Einstellungen bleiben erhalten.')
        );
      }
    } catch (error) {
      console.warn(
        chalk.yellow(
          `⚠️ Warning: Could not migrate legacy configuration: ${error instanceof Error ? error.message : error}`
        )
      );
    }
  }

  /**
   * Load user configuration from global user config file with schema validation
   * 🛡️ REGEL: Alle User-Konfigurationen MÜSSEN validiert werden
   */
  async loadUserConfig(): Promise<Record<string, unknown>> {
    try {
      // 🪝 HOOK: beforeConfigLoad - KI-freundliche Regelwelt
      try {
        await triggerHook('onConfigLoad', {
          configType: 'user' as const,
          configPath: this.userConfigFile,
          configData: null,
          timestamp: new Date()
        } as ConfigLoadHookData);
      } catch (hookError) {
        console.debug(`Hook error (onConfigLoad user): ${hookError}`);
      }

      if (!(await fs.pathExists(this.userConfigFile))) {
        return {};
      }
      
      const content = await fs.readFile(this.userConfigFile, 'utf-8');
      const rawData = JSON.parse(content);

      // 🛡️ SCHEMA-VALIDIERUNG: User Config - KI-freundliche Regelwelt
      const validation = SchemaValidator.validateUserConfig(rawData);
      if (validation.success && validation.data) {
        console.log(chalk.green('✅ User-Konfiguration erfolgreich validiert'));
        
        // 🪝 HOOK: afterConfigLoad - KI-freundliche Regelwelt
        try {
          await triggerHook('onConfigLoad', {
            configType: 'user' as const,
            configPath: this.userConfigFile,
            configData: validation.data,
            timestamp: new Date()
          } as ConfigLoadHookData);
        } catch (hookError) {
          console.debug(`Hook error (onConfigLoad user after): ${hookError}`);
        }

        return validation.data as Record<string, unknown>;
      } else {
        console.warn(chalk.yellow('⚠️ User-Config Schema-Validierung fehlgeschlagen:'));
        validation.errors?.forEach(error => {
          console.warn(chalk.yellow(`   • ${error}`));
        });
        console.warn(chalk.yellow('💡 Verwende Fallback für Kompatibilität'));
        return rawData; // Fallback to raw data for compatibility
      }
    } catch (error) {
      console.warn(
        chalk.yellow(
          `⚠️ Warning: Could not load user config: ${error instanceof Error ? error.message : error}`
        )
      );
      return {};
    }
  }

  /**
   * Store user configuration in global user config file with schema validation
   * 🛡️ REGEL: Alle User-Konfigurationen MÜSSEN vor dem Speichern validiert werden
   */
  async storeUserConfig(config: Record<string, unknown>): Promise<void> {
    try {
      await this.initialize();

      // 🛡️ SCHEMA-VALIDIERUNG vor dem Speichern - KI-freundliche Regelwelt
      const validation = SchemaValidator.validateUserConfig(config);
      if (!validation.success) {
        console.error(chalk.red('❌ Cannot store invalid User config:'));
        validation.errors?.forEach(error => {
          console.error(chalk.red(`   • ${error}`));
        });
        throw new Error('User configuration validation failed');
      }

      await fs.writeFile(this.userConfigFile, JSON.stringify(validation.data, null, 2));
      await this.setSecurePermissions();
      
      console.log(chalk.green(`✅ User-Konfiguration validiert und gespeichert in ${this.userConfigFile}`));
    } catch (error) {
      if (error instanceof Error && error.message.includes('validation failed')) {
        throw error; // Re-throw validation errors
      }
      throw new Error(
        `Failed to store user config: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Set user's preferred language
   */
  async setUserLanguage(language: string): Promise<void> {
    const config = await this.loadUserConfig();
    config.language = language;
    config.lastModified = new Date().toISOString();
    await this.storeUserConfig(config);
  }

  /**
   * Get user's preferred language
   */
  async getUserLanguage(): Promise<string | null> {
    const config = await this.loadUserConfig();
    return (config.language as string) || null;
  }

  /**
   * Get user config file path
   */
  getUserConfigFilePath(): string {
    return this.userConfigFile;
  }
}
