import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { APP_CONFIG } from './constants';
import chalk from 'chalk';

/**
 * ConfigManager - Secure management of WOARU configuration and API keys
 * Handles global .env file creation, security measures, and key storage
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private woaruDir: string;
  private envFile: string;

  private constructor() {
    this.woaruDir = path.join(os.homedir(), APP_CONFIG.DIRECTORIES.BASE);
    this.envFile = path.join(this.woaruDir, '.env');
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

      // Set up security measures
      await this.setupGitIgnoreProtection();

      // Ensure .env file exists (create empty if not)
      if (!(await fs.pathExists(this.envFile))) {
        await this.createEmptyEnvFile();
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
        dotenv.config({ path: this.envFile });
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
   * Set secure file permissions (600 - owner read/write only)
   */
  private async setSecurePermissions(): Promise<void> {
    try {
      if (process.platform !== 'win32') {
        await fs.chmod(this.envFile, 0o600);
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
      const ignoreEntry = '~/.woaru/.env';
      const content = await fs.readFile(gitIgnorePath, 'utf-8').catch(() => '');

      if (!content.includes(ignoreEntry)) {
        const newContent =
          content +
          (content.endsWith('\n') ? '' : '\n') +
          `\n# WOARU API keys protection\n${ignoreEntry}\n`;
        await fs.writeFile(gitIgnorePath, newContent);
        console.log(
          chalk.green(`✅ Added .env protection to ${gitIgnorePath}`)
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
}
