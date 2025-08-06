// Removed unused fs and path imports
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
  async loadConfig(_projectPath?: string): Promise<AIReviewConfig | null> {
    if (this.config) {
      return this.config;
    }

    try {
      const configManager = ConfigManager.getInstance();
      const aiConfig = await configManager.loadAiConfig();

      if (aiConfig && Object.keys(aiConfig).length > 1) {
        // More than just metadata
        console.log(
          `📄 Loading AI config from: ${configManager.getAiConfigFilePath()}`
        );

        // Check Multi-AI Review configuration and log the mode
        const multiAiReviewEnabled = aiConfig.multi_ai_review_enabled || false;
        const primaryProvider = aiConfig.primary_review_provider_id || null;

        if (multiAiReviewEnabled) {
          console.log(
            `🔄 Multi-AI Review mode: All configured providers will be contacted`
          );
        } else if (primaryProvider) {
          console.log(
            `🎯 Single-AI Review mode: Only ${primaryProvider} will be contacted`
          );
        } else {
          console.log(
            `⚠️ No primary provider set - all providers will be contacted`
          );
        }

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
   * Respects Multi-AI Review configuration settings
   */
  private convertAiConfigToAIConfig(
    aiConfig: Record<string, unknown>
  ): AIReviewConfig {
    const providers = [];

    // Check Multi-AI Review configuration
    const multiAiReviewEnabled = aiConfig.multi_ai_review_enabled || false;
    const primaryProvider = aiConfig.primary_review_provider_id || null;

    // Validate Single-AI Review mode configuration
    if (!multiAiReviewEnabled && primaryProvider) {
      const availableProviders = Object.keys(aiConfig).filter(
        key =>
          ![
            '_metadata',
            'multi_ai_review_enabled',
            'primary_review_provider_id',
            'multiAi',
            'primaryProvider',
            'lastDataUpdate',
          ].includes(key) && !key.startsWith('_') // Exclude any metadata keys
      );

      if (!availableProviders.includes(primaryProvider as string)) {
        console.warn(
          `⚠️ Primary provider '${primaryProvider}' not found in configuration. Available providers: ${availableProviders.join(', ')}`
        );
        console.log(`🔄 Falling back to Multi-AI Review mode`);
      }
    }

    // Convert each configured AI provider to AI review format
    for (const [providerId, providerConfig] of Object.entries(aiConfig)) {
      if (
        providerId === '_metadata' ||
        providerId === 'multi_ai_review_enabled' ||
        providerId === 'primary_review_provider_id' ||
        providerId === 'multiAi' ||
        providerId === 'primaryProvider' ||
        providerId === 'lastDataUpdate' ||
        providerId.startsWith('_') // Any key starting with underscore is metadata
      )
        continue;

      const config = providerConfig as Record<string, unknown>;

      // Determine if this provider should be enabled based on Multi-AI Review settings
      let shouldEnable = config.enabled !== false;

      if (!multiAiReviewEnabled && primaryProvider) {
        // Single-AI Review mode: only enable the primary provider
        shouldEnable = shouldEnable && providerId === primaryProvider;
      } else if (!multiAiReviewEnabled && !primaryProvider) {
        // Single-AI Review mode but no primary provider set: enable all (fallback)
        // shouldEnable remains unchanged (all providers enabled in fallback)
      }
      // In Multi-AI Review mode: enable all configured providers (default behavior)

      providers.push({
        id: providerId,
        providerType: ((config.providerType as string) || 'openai') as
          | 'openai'
          | 'anthropic'
          | 'google'
          | 'custom-ollama'
          | 'azure-openai',
        apiKeyEnvVar:
          (config.apiKeyEnvVar as string) ||
          `${providerId.toUpperCase()}_API_KEY`,
        baseUrl:
          (config.baseUrl as string) ||
          'https://api.openai.com/v1/chat/completions',
        model: (config.model as string) || 'gpt-4',
        headers: (config.headers as Record<string, string>) || {},
        bodyTemplate:
          (config.bodyTemplate as string) ||
          JSON.stringify({
            model: '{model}',
            messages: [
              {
                role: 'user',
                content:
                  '{prompt}\n\nCode to analyze:\n```{language}\n{code}\n```',
              },
            ],
            max_tokens: 4000,
            temperature: 0.1,
          }),
        timeout: (config.timeout as number) || 30000,
        maxTokens: (config.maxTokens as number) || 4000,
        temperature: (config.temperature as number) || 0.1,
        enabled: shouldEnable,
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
  private validateConfig(config: unknown): config is AIReviewConfig {
    if (!config || typeof config !== 'object') {
      return false;
    }

    const configObj = config as Record<string, unknown>;
    if (!Array.isArray(configObj.providers)) {
      console.warn('Config validation failed: providers must be an array');
      return false;
    }

    for (const provider of configObj.providers as unknown[]) {
      const providerObj = provider as Record<string, unknown>;
      if (
        !providerObj.id ||
        !providerObj.providerType ||
        !providerObj.baseUrl ||
        !providerObj.model
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
  async isAIAvailable(_projectPath?: string): Promise<boolean> {
    const config = await this.loadConfig(_projectPath);
    return config !== null && config.providers.some(p => p.enabled);
  }

  /**
   * Get enabled providers
   */
  async getEnabledProviders(_projectPath?: string): Promise<string[]> {
    const config = await this.loadConfig(_projectPath);
    return config?.providers.filter(p => p.enabled).map(p => p.id) || [];
  }

  /**
   * Get Multi-AI Review configuration status
   */
  async getMultiAiReviewConfig(): Promise<{
    enabled: boolean;
    primaryProvider: string | null;
    mode: string;
  }> {
    try {
      const configManager = ConfigManager.getInstance();
      const aiConfig = await configManager.loadAiConfig();

      const multiAiReviewEnabled = aiConfig.multi_ai_review_enabled || false;
      const primaryProvider = aiConfig.primary_review_provider_id || null;

      let mode = 'Multi-AI Review';
      if (!multiAiReviewEnabled && primaryProvider) {
        mode = `Single-AI Review (${primaryProvider})`;
      } else if (!multiAiReviewEnabled && !primaryProvider) {
        mode = 'Multi-AI Review (fallback)';
      }

      return {
        enabled: Boolean(multiAiReviewEnabled),
        primaryProvider: (primaryProvider as string) || null,
        mode,
      };
    } catch {
      return {
        enabled: false,
        primaryProvider: null,
        mode: 'Not configured',
      };
    }
  }

  /**
   * Reset cached configuration (for testing)
   */
  resetConfig(): void {
    this.config = null;
  }
}
