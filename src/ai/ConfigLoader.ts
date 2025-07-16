import * as fs from 'fs-extra';
import * as path from 'path';
import { AIReviewConfig } from '../types/ai-review';
import { ConfigManager } from '../config/ConfigManager';

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
   * Load AI review configuration from global ~/.woaru/config/ai_config.json
   */
  async loadConfig(projectPath?: string): Promise<AIReviewConfig | null> {
    if (this.config) {
      return this.config;
    }

    try {
      const configManager = ConfigManager.getInstance();
      const aiConfig = await configManager.loadAiConfig();

      if (aiConfig && Object.keys(aiConfig).length > 1) { // More than just metadata
        console.log(`📄 Loading AI config from: ${configManager.getAiConfigFilePath()}`);

        // Convert from global AI config to AIReviewConfig format
        const reviewConfig = this.convertAiConfigToAIConfig(aiConfig);

        if (this.validateConfig(reviewConfig)) {
          this.config = reviewConfig;
          return this.config;
        } else {
          console.warn(`⚠️ Invalid AI config in global configuration`);
        }
      }

      console.log('🤖 No AI review configuration found. AI features disabled.');
      console.log(
        '💡 Run "woaru ai setup" to configure AI providers for code review.'
      );

      return null;
    } catch (error) {
      console.warn(
        `⚠️ Failed to load global AI config:`,
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }

  /**
   * Get default configuration for testing
   */
  getDefaultConfig(): AIReviewConfig {
    return {
      providers: [
        {
          id: 'anthropic-claude',
          providerType: 'anthropic',
          apiKeyEnvVar: 'ANTHROPIC_API_KEY',
          baseUrl: 'https://api.anthropic.com/v1/messages',
          model: 'claude-3-5-sonnet-20241022',
          headers: {
            'anthropic-version': '2023-06-01',
          },
          bodyTemplate: JSON.stringify({
            model: '{model}',
            max_tokens: 4000,
            temperature: 0.1,
            messages: [
              {
                role: 'user',
                content:
                  '{prompt}\n\nCode to analyze:\n```{language}\n{code}\n```',
              },
            ],
          }),
          timeout: 30000,
          maxTokens: 4000,
          temperature: 0.1,
          enabled: true,
        },
      ],
      parallelRequests: true,
      consensusMode: false,
      minConsensusCount: 2,
      tokenLimit: 8000,
      costThreshold: 0.5,
    };
  }

  /**
   * Convert global AI config to AIReviewConfig format
   */
  private convertAiConfigToAIConfig(aiConfig: any): AIReviewConfig {
    const providers = [];
    
    // Convert each configured AI provider to AI review format
    for (const [providerId, providerConfig] of Object.entries(aiConfig)) {
      if (providerId === '_metadata') continue;
      
      const config = providerConfig as any;
      providers.push({
        id: providerId,
        providerType: config.providerType || 'openai',
        apiKeyEnvVar: config.apiKeyEnvVar || `${providerId.toUpperCase()}_API_KEY`,
        baseUrl: config.baseUrl || 'https://api.openai.com/v1/chat/completions',
        model: config.model || 'gpt-4',
        headers: config.headers || {},
        bodyTemplate: config.bodyTemplate || JSON.stringify({
          model: '{model}',
          messages: [{ role: 'user', content: '{prompt}\n\nCode to analyze:\n```{language}\n{code}\n```' }],
          max_tokens: 4000,
          temperature: 0.1,
        }),
        timeout: config.timeout || 30000,
        maxTokens: config.maxTokens || 4000,
        temperature: config.temperature || 0.1,
        enabled: config.enabled !== false,
      });
    }

    return {
      providers,
      parallelRequests: true,
      consensusMode: false,
      minConsensusCount: 2,
      tokenLimit: 8000,
      costThreshold: 0.5,
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
      if (
        !provider.id ||
        !provider.providerType ||
        !provider.baseUrl ||
        !provider.model
      ) {
        console.warn(
          'Config validation failed: provider missing required fields',
          provider
        );
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
