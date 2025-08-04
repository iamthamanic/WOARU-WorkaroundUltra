import axios from 'axios';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { t } from '../config/i18n';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface AIModel {
  id: string;
  name: string;
  description: string;
  isLatest?: boolean;
  category?: string;
  contextWindow?: number;
  supportedFeatures?: string[];
  isRecommended?: boolean;
  isDeprecated?: boolean;
  tier?: 'flagship' | 'balanced' | 'fast' | 'legacy';
}

export class AIProviderUtils {
  private static aiModelsPath = path.resolve(__dirname, '../../ai-models.json');

  // Recommended models for better UX - only show these by default
  private static RECOMMENDED_MODELS = {
    openai: [
      'gpt-4o', // Latest flagship
      'gpt-4o-mini', // Fast & cheap
      'gpt-4-turbo', // Previous flagship
      'gpt-4', // Stable version
      'gpt-3.5-turbo', // Legacy but popular
      'o1-preview', // Reasoning model
      'o1-mini', // Reasoning mini
    ],
    anthropic: [
      'claude-4-opus-20250115',
      'claude-4-sonnet-20250115',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
    ],
    google: [
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro-latest',
      'gemini-1.5-flash-latest',
    ],
    deepseek: [
      'deepseek-reasoner', // Latest reasoning model
      'deepseek-chat', // General purpose
      'deepseek-coder', // Code-focused
    ],
    ollama: [
      'llama3.2:latest', // Meta's latest
      'qwen2.5-coder:latest', // Coding specialist
      'deepseek-coder:33b', // Large coding model
    ],
  } as const;

  /**
   * Fetch available models from OpenAI API
   * @param apiKey - The OpenAI API key
   * @returns Promise<AIModel[]> - List of available models
   */
  static async fetchOpenAIModels(apiKey: string): Promise<AIModel[]> {
    try {
      console.log(chalk.gray(t('ai_provider_utils.fetching_openai_models')));

      const response = await axios.get('https://api.openai.com/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      if (response.data && response.data.data) {
        // Filter and map OpenAI models
        const relevantModels = response.data.data
          .filter(
            (model: Record<string, unknown>) =>
              typeof model.id === 'string' &&
              (model.id.includes('gpt-4') ||
                model.id.includes('gpt-3.5') ||
                model.id.includes('o1'))
          )
          .map((model: Record<string, unknown>) => {
            const modelId = model.id as string;
            const isRecommended = (
              this.RECOMMENDED_MODELS.openai as readonly string[]
            ).includes(modelId);
            const isDeprecated = this.isDeprecatedModel(modelId);

            return {
              id: modelId,
              name: this.getModelDisplayName(modelId),
              description: this.getModelDescription(modelId),
              category: 'live',
              contextWindow: this.getContextWindowForModel(modelId),
              isRecommended,
              isDeprecated,
              tier: this.getModelTier(modelId),
            };
          })
          .sort((a: AIModel, b: AIModel) => {
            // Sort: recommended first, then by tier, then alphabetically
            if (a.isRecommended !== b.isRecommended) {
              return b.isRecommended ? 1 : -1;
            }
            return b.id.localeCompare(a.id);
          });

        console.log(
          chalk.green(
            t('ai_provider_utils.models_found_openai', {
              count: relevantModels.length,
            })
          )
        );
        return relevantModels;
      }
    } catch (error) {
      console.log(
        chalk.yellow(t('ai_provider_utils.could_not_fetch_fallback'))
      );
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.log(chalk.red(t('ai_provider_utils.invalid_api_key_error')));
      }
    }

    // Fallback to ai-models.json
    return this.getFallbackModels('openai');
  }

  /**
   * Get only recommended models for better UX
   */
  static async getRecommendedModels(
    provider: string,
    apiKey?: string
  ): Promise<AIModel[]> {
    const allModels = await this.fetchModelsForProvider(provider, apiKey || '');
    return allModels.filter((model: AIModel) => model.isRecommended);
  }

  /**
   * Check if a model is deprecated
   */
  private static isDeprecatedModel(modelId: string): boolean {
    const deprecatedPatterns = [
      /gpt-3\.5-turbo-0301/, // Old snapshot
      /gpt-3\.5-turbo-0613/, // Old snapshot
      /gpt-4-0314/, // Old snapshot
      /gpt-4-0613/, // Old snapshot
      /text-davinci/, // Legacy GPT-3
      /text-curie/, // Legacy GPT-3
      /text-babbage/, // Legacy GPT-3
      /text-ada/, // Legacy GPT-3
      /davinci/, // Legacy
      /curie/, // Legacy
      /babbage/, // Legacy
      /ada/, // Legacy
    ];
    return deprecatedPatterns.some(pattern => pattern.test(modelId));
  }

  /**
   * Get user-friendly model display name
   */
  private static getModelDisplayName(modelId: string): string {
    const nameMap: Record<string, string> = {
      'gpt-4o': 'GPT-4o (Latest)',
      'gpt-4o-mini': 'GPT-4o Mini (Fast & Cheap)',
      'gpt-4-turbo': 'GPT-4 Turbo (Previous Flagship)',
      'gpt-4': 'GPT-4 (Stable)',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo (Legacy)',
      'o1-preview': 'O1 Preview (Reasoning)',
      'o1-mini': 'O1 Mini (Reasoning Fast)',
    };
    return nameMap[modelId] || modelId;
  }

  /**
   * Get detailed model description
   */
  private static getModelDescription(modelId: string): string {
    const descMap: Record<string, string> = {
      'gpt-4o': 'Latest and most capable GPT-4 model, multimodal',
      'gpt-4o-mini': 'Smaller, faster, cheaper version of GPT-4o',
      'gpt-4-turbo': 'Previous flagship with 128k context window',
      'gpt-4': 'Reliable GPT-4 with 8k context window',
      'gpt-3.5-turbo': 'Fast and cost-effective for simple tasks',
      'o1-preview': 'Advanced reasoning model for complex problems',
      'o1-mini': 'Faster reasoning model for simpler logic tasks',
    };
    return descMap[modelId] || `OpenAI model ${modelId}`;
  }

  /**
   * Get model tier for sorting
   */
  private static getModelTier(
    modelId: string
  ): 'flagship' | 'balanced' | 'fast' | 'legacy' {
    if (modelId.includes('gpt-4o') && !modelId.includes('mini'))
      return 'flagship';
    if (modelId.includes('o1-preview')) return 'flagship';
    if (modelId.includes('gpt-4-turbo')) return 'balanced';
    if (modelId.includes('gpt-4o-mini') || modelId.includes('o1-mini'))
      return 'fast';
    if (modelId.includes('gpt-4')) return 'balanced';
    if (modelId.includes('gpt-3.5')) return 'legacy';
    return 'legacy';
  }

  /**
   * Fetch available models from Anthropic API
   * Note: Anthropic doesn't provide a models endpoint, so we use ai-models.json
   * @param apiKey - The Anthropic API key
   * @returns Promise<AIModel[]> - List of available models
   */
  static async fetchAnthropicModels(_apiKey: string): Promise<AIModel[]> {
    // Anthropic doesn't have a public models endpoint
    // We use ai-models.json with recommendation flags
    console.log(chalk.gray(t('ai_provider_utils.fetching_anthropic_models')));
    const fallbackModels = await this.getFallbackModels('anthropic');

    // Add recommendation and deprecation flags to Anthropic models
    return fallbackModels.map(model => ({
      ...model,
      isRecommended: (
        this.RECOMMENDED_MODELS.anthropic as readonly string[]
      ).includes(model.id),
      isDeprecated: this.isDeprecatedAnthropicModel(model.id),
      tier: this.getAnthropicModelTier(model.id),
    }));
  }

  /**
   * Check if an Anthropic model is deprecated
   */
  private static isDeprecatedAnthropicModel(modelId: string): boolean {
    const deprecatedPatterns = [
      /claude-1/, // Legacy Claude 1
      /claude-2\.0/, // Old Claude 2.0
      /claude-instant-1/, // Legacy Instant
    ];
    return deprecatedPatterns.some(pattern => pattern.test(modelId));
  }

  /**
   * Get Anthropic model tier
   */
  private static getAnthropicModelTier(
    modelId: string
  ): 'flagship' | 'balanced' | 'fast' | 'legacy' {
    if (modelId.includes('claude-4-opus')) return 'flagship';
    if (modelId.includes('claude-4-sonnet')) return 'balanced';
    if (modelId.includes('claude-3-5-sonnet')) return 'balanced';
    if (modelId.includes('claude-3-5-haiku')) return 'fast';
    if (modelId.includes('claude-3')) return 'legacy';
    return 'legacy';
  }

  /**
   * Fetch available models from Google Gemini API
   * @param apiKey - The Google API key
   * @returns Promise<AIModel[]> - List of available models
   */
  static async fetchGoogleModels(apiKey: string): Promise<AIModel[]> {
    try {
      console.log(chalk.gray(t('ai_provider_utils.fetching_google_models')));

      const response = await axios.get(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        { timeout: 10000 }
      );

      if (response.data && response.data.models) {
        const relevantModels = response.data.models
          .filter(
            (model: Record<string, unknown>) =>
              typeof model.name === 'string' && model.name.includes('gemini')
          )
          .map((model: Record<string, unknown>) => {
            const modelId = (model.name as string).replace('models/', '');
            const isRecommended = (
              this.RECOMMENDED_MODELS.google as readonly string[]
            ).includes(modelId);
            const isDeprecated = this.isDeprecatedGoogleModel(modelId);

            return {
              id: modelId,
              name: (model.displayName as string) || (model.name as string),
              description:
                (model.description as string) || `Google ${model.name}`,
              category: 'live',
              isRecommended,
              isDeprecated,
              tier: this.getGoogleModelTier(modelId),
              supportedFeatures:
                (model.supportedGenerationMethods as string[]) || [],
            };
          });

        console.log(
          chalk.green(
            t('ai_provider_utils.models_found_google', {
              count: relevantModels.length,
            })
          )
        );
        return relevantModels;
      }
    } catch (error) {
      console.log(
        chalk.yellow(t('ai_provider_utils.could_not_fetch_fallback'))
      );
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        console.log(chalk.red(t('ai_provider_utils.invalid_api_key_error')));
      }
    }

    // Fallback to ai-models.json
    return this.getFallbackModels('google');
  }

  /**
   * Check if a Google model is deprecated
   */
  private static isDeprecatedGoogleModel(modelId: string): boolean {
    const deprecatedPatterns = [
      /gemini-pro$/, // Old gemini-pro (without version)
      /gemini-pro-vision$/, // Legacy vision model
      /gemini-1\.0/, // Old 1.0 models
    ];
    return deprecatedPatterns.some(pattern => pattern.test(modelId));
  }

  /**
   * Get Google model tier
   */
  private static getGoogleModelTier(
    modelId: string
  ): 'flagship' | 'balanced' | 'fast' | 'legacy' {
    if (modelId.includes('gemini-2.0')) return 'flagship';
    if (modelId.includes('gemini-1.5-pro')) return 'balanced';
    if (modelId.includes('gemini-1.5-flash')) return 'fast';
    if (modelId.includes('gemini-1.0')) return 'legacy';
    return 'balanced';
  }

  /**
   * Fetch available models from DeepSeek API
   * Note: DeepSeek uses OpenAI-compatible API but with fixed models
   */
  static async fetchDeepSeekModels(_apiKey: string): Promise<AIModel[]> {
    console.log(chalk.gray(t('ai_provider_utils.fetching_deepseek_models')));
    const fallbackModels = await this.getFallbackModels('deepseek');

    // Add recommendation and deprecation flags to DeepSeek models
    return fallbackModels.map(model => ({
      ...model,
      isRecommended: (
        this.RECOMMENDED_MODELS.deepseek as readonly string[]
      ).includes(model.id),
      isDeprecated: this.isDeprecatedDeepSeekModel(model.id),
      tier: this.getDeepSeekModelTier(model.id),
    }));
  }

  /**
   * Fetch available models from Ollama
   * Note: Ollama is local and uses fixed model list from ai-models.json
   */
  static async fetchOllamaModels(_apiKey: string): Promise<AIModel[]> {
    console.log(chalk.gray(t('ai_provider_utils.fetching_ollama_models')));
    const fallbackModels = await this.getFallbackModels('ollama');

    // Add recommendation and deprecation flags to Ollama models
    return fallbackModels.map(model => ({
      ...model,
      isRecommended: (
        this.RECOMMENDED_MODELS.ollama as readonly string[]
      ).includes(model.id),
      isDeprecated: this.isDeprecatedOllamaModel(model.id),
      tier: this.getOllamaModelTier(model.id),
    }));
  }

  /**
   * Check if a DeepSeek model is deprecated
   */
  private static isDeprecatedDeepSeekModel(modelId: string): boolean {
    // DeepSeek models are relatively new, no deprecated ones yet
    const deprecatedPatterns = [
      /deepseek-v1/, // Legacy v1 models if they exist
    ];
    return deprecatedPatterns.some(pattern => pattern.test(modelId));
  }

  /**
   * Get DeepSeek model tier
   */
  private static getDeepSeekModelTier(
    modelId: string
  ): 'flagship' | 'balanced' | 'fast' | 'legacy' {
    if (modelId.includes('deepseek-reasoner')) return 'flagship';
    if (modelId.includes('deepseek-coder')) return 'balanced';
    if (modelId.includes('deepseek-chat')) return 'balanced';
    return 'balanced';
  }

  /**
   * Check if an Ollama model is deprecated
   */
  private static isDeprecatedOllamaModel(modelId: string): boolean {
    const deprecatedPatterns = [
      /llama2/, // Old Llama 2 models
      /codellama:7b/, // Smaller, less capable versions
      /mistral:7b/, // Smaller versions
    ];
    return deprecatedPatterns.some(pattern => pattern.test(modelId));
  }

  /**
   * Get Ollama model tier
   */
  private static getOllamaModelTier(
    modelId: string
  ): 'flagship' | 'balanced' | 'fast' | 'legacy' {
    if (modelId.includes('llama3.2:latest')) return 'flagship';
    if (modelId.includes('deepseek-coder:33b')) return 'flagship';
    if (modelId.includes('qwen2.5-coder:latest')) return 'balanced';
    if (modelId.includes('codellama:34b')) return 'balanced';
    if (modelId.includes(':7b')) return 'fast';
    return 'balanced';
  }

  /**
   * Get fallback models from ai-models.json
   * @param provider - The provider ID
   * @returns Promise<AIModel[]> - List of fallback models
   */
  static async getFallbackModels(provider: string): Promise<AIModel[]> {
    try {
      const aiModelsData = await fs.readJson(this.aiModelsPath);
      const providerData = aiModelsData.llm_providers[provider];

      if (providerData && providerData.models) {
        return providerData.models.map((model: Record<string, unknown>) => ({
          id: model.id,
          name: model.name,
          description: model.description,
          isLatest: model.isLatest,
          category: model.category,
          contextWindow: model.contextWindow,
          supportedFeatures: model.supportedFeatures,
        }));
      }
    } catch (error) {
      console.log(
        chalk.red(
          t('ai_provider_utils.error_loading_fallback', {
            error: error instanceof Error ? error.message : error,
          })
        )
      );
    }

    return [];
  }

  /**
   * Get context window size for known OpenAI models
   * @param modelId - The model ID
   * @returns number - Context window size
   */
  private static getContextWindowForModel(modelId: string): number {
    const contextWindows: Record<string, number> = {
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'gpt-4-turbo': 128000,
      'gpt-4': 8192,
      'gpt-3.5-turbo': 16385,
      o1: 128000,
      'o1-mini': 128000,
    };

    return contextWindows[modelId] || 4096;
  }

  /**
   * Fetch models for any provider
   * @param provider - The provider ID
   * @param apiKey - The API key
   * @returns Promise<AIModel[]> - List of available models
   */
  static async fetchModelsForProvider(
    provider: string,
    apiKey: string
  ): Promise<AIModel[]> {
    switch (provider) {
      case 'openai':
        return this.fetchOpenAIModels(apiKey);
      case 'anthropic':
        return this.fetchAnthropicModels(apiKey);
      case 'google':
        return this.fetchGoogleModels(apiKey);
      case 'deepseek':
        return this.fetchDeepSeekModels(apiKey);
      case 'ollama':
        return this.fetchOllamaModels(apiKey);
      default:
        return this.getFallbackModels(provider);
    }
  }
}
