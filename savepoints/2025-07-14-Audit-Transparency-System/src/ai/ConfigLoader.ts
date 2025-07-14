import * as fs from 'fs-extra';
import * as path from 'path';
import { AIReviewConfig } from '../types/ai-review';

export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: AIReviewConfig | null = null;

  private constructor() {}

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  /**
   * Load AI review configuration from woaru.config.js
   */
  async loadConfig(projectPath?: string): Promise<AIReviewConfig | null> {
    if (this.config) {
      return this.config;
    }

    const searchPaths = [
      projectPath ? path.join(projectPath, 'woaru.config.js') : null,
      path.join(process.cwd(), 'woaru.config.js'),
      path.join(process.cwd(), '.woaru', 'config.js'),
      path.join(process.env.HOME || '~', '.woaru', 'config.js')
    ].filter(Boolean) as string[];

    for (const configPath of searchPaths) {
      try {
        if (await fs.pathExists(configPath)) {
          console.log(`📄 Loading AI config from: ${configPath}`);
          
          // Clear require cache to allow hot reloading
          delete require.cache[require.resolve(configPath)];
          
          const configModule = require(configPath);
          const config = configModule.ai || configModule.default?.ai || configModule;
          
          if (this.validateConfig(config)) {
            this.config = config;
            return this.config;
          } else {
            console.warn(`⚠️ Invalid AI config in ${configPath}`);
          }
        }
      } catch (error) {
        console.warn(`⚠️ Failed to load config from ${configPath}:`, error instanceof Error ? error.message : error);
      }
    }

    console.log('🤖 No AI review configuration found. AI features disabled.');
    console.log('💡 Create woaru.config.js to enable AI code review. See woaru.config.example.js for template.');
    
    return null;
  }

  /**
   * Get default configuration for testing
   */
  getDefaultConfig(): AIReviewConfig {
    return {
      providers: [
        {
          id: "anthropic-claude",
          providerType: "anthropic",
          apiKeyEnvVar: "ANTHROPIC_API_KEY",
          baseUrl: "https://api.anthropic.com/v1/messages",
          model: "claude-3-5-sonnet-20241022",
          headers: {
            "anthropic-version": "2023-06-01"
          },
          bodyTemplate: JSON.stringify({
            model: "{model}",
            max_tokens: 4000,
            temperature: 0.1,
            messages: [
              {
                role: "user", 
                content: "{prompt}\n\nCode to analyze:\n```{language}\n{code}\n```"
              }
            ]
          }),
          timeout: 30000,
          maxTokens: 4000,
          temperature: 0.1,
          enabled: true
        }
      ],
      parallelRequests: true,
      consensusMode: false,
      minConsensusCount: 2,
      tokenLimit: 8000,
      costThreshold: 0.50
    };
  }

  /**
   * Validate configuration structure
   */
  private validateConfig(config: any): config is AIReviewConfig {
    if (!config || typeof config !== 'object') {
      return false;
    }

    if (!Array.isArray(config.providers)) {
      console.warn('Config validation failed: providers must be an array');
      return false;
    }

    for (const provider of config.providers) {
      if (!provider.id || !provider.providerType || !provider.baseUrl || !provider.model) {
        console.warn('Config validation failed: provider missing required fields', provider);
        return false;
      }
    }

    return true;
  }

  /**
   * Check if AI features are available
   */
  async isAIAvailable(projectPath?: string): Promise<boolean> {
    const config = await this.loadConfig(projectPath);
    return config !== null && config.providers.some(p => p.enabled);
  }

  /**
   * Get enabled providers
   */
  async getEnabledProviders(projectPath?: string): Promise<string[]> {
    const config = await this.loadConfig(projectPath);
    return config?.providers.filter(p => p.enabled).map(p => p.id) || [];
  }

  /**
   * Reset cached configuration (for testing)
   */
  resetConfig(): void {
    this.config = null;
  }
}