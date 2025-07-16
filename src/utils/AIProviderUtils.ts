import axios from 'axios';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

export interface AIModel {
  id: string;
  name: string;
  description: string;
  isLatest?: boolean;
  category?: string;
  contextWindow?: number;
  supportedFeatures?: string[];
}

export class AIProviderUtils {
  private static aiModelsPath = path.resolve(__dirname, '../../ai-models.json');

  /**
   * Fetch available models from OpenAI API
   * @param apiKey - The OpenAI API key
   * @returns Promise<AIModel[]> - List of available models
   */
  static async fetchOpenAIModels(apiKey: string): Promise<AIModel[]> {
    try {
      console.log(chalk.gray('🔄 Fetching available models from OpenAI...'));
      
      const response = await axios.get('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.data) {
        // Filter and map OpenAI models
        const relevantModels = response.data.data
          .filter((model: any) => 
            model.id.includes('gpt-4') || 
            model.id.includes('gpt-3.5') ||
            model.id.includes('o1')
          )
          .map((model: any) => ({
            id: model.id,
            name: model.id,
            description: `OpenAI model ${model.id}`,
            category: 'live',
            contextWindow: this.getContextWindowForModel(model.id)
          }))
          .sort((a: AIModel, b: AIModel) => b.id.localeCompare(a.id));

        console.log(chalk.green(`✅ Found ${relevantModels.length} models from OpenAI API`));
        return relevantModels;
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️ Could not fetch live models, using fallback'));
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.log(chalk.red('❌ Invalid API key'));
      }
    }

    // Fallback to ai-models.json
    return this.getFallbackModels('openai');
  }

  /**
   * Fetch available models from Anthropic API
   * Note: Anthropic doesn't provide a models endpoint, so we use ai-models.json
   * @param apiKey - The Anthropic API key
   * @returns Promise<AIModel[]> - List of available models
   */
  static async fetchAnthropicModels(apiKey: string): Promise<AIModel[]> {
    // Anthropic doesn't have a public models endpoint
    // We could validate the API key with a test request, but for now use fallback
    console.log(chalk.gray('📋 Loading Anthropic models from configuration...'));
    return this.getFallbackModels('anthropic');
  }

  /**
   * Fetch available models from Google Gemini API
   * @param apiKey - The Google API key
   * @returns Promise<AIModel[]> - List of available models
   */
  static async fetchGoogleModels(apiKey: string): Promise<AIModel[]> {
    try {
      console.log(chalk.gray('🔄 Fetching available models from Google...'));
      
      const response = await axios.get(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        { timeout: 10000 }
      );

      if (response.data && response.data.models) {
        const relevantModels = response.data.models
          .filter((model: any) => model.name.includes('gemini'))
          .map((model: any) => ({
            id: model.name.replace('models/', ''),
            name: model.displayName || model.name,
            description: model.description || `Google ${model.name}`,
            category: 'live',
            supportedFeatures: model.supportedGenerationMethods || []
          }));

        console.log(chalk.green(`✅ Found ${relevantModels.length} models from Google API`));
        return relevantModels;
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️ Could not fetch live models, using fallback'));
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        console.log(chalk.red('❌ Invalid API key'));
      }
    }

    // Fallback to ai-models.json
    return this.getFallbackModels('google');
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
        return providerData.models.map((model: any) => ({
          id: model.id,
          name: model.name,
          description: model.description,
          isLatest: model.isLatest,
          category: model.category,
          contextWindow: model.contextWindow,
          supportedFeatures: model.supportedFeatures
        }));
      }
    } catch (error) {
      console.log(chalk.red(`❌ Error loading fallback models: ${error instanceof Error ? error.message : error}`));
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
      'o1': 128000,
      'o1-mini': 128000
    };
    
    return contextWindows[modelId] || 4096;
  }

  /**
   * Fetch models for any provider
   * @param provider - The provider ID
   * @param apiKey - The API key
   * @returns Promise<AIModel[]> - List of available models
   */
  static async fetchModelsForProvider(provider: string, apiKey: string): Promise<AIModel[]> {
    switch (provider) {
      case 'openai':
        return this.fetchOpenAIModels(apiKey);
      case 'anthropic':
        return this.fetchAnthropicModels(apiKey);
      case 'google':
        return this.fetchGoogleModels(apiKey);
      default:
        return this.getFallbackModels(provider);
    }
  }
}