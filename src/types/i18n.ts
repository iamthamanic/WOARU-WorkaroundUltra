/**
 * Type definitions for i18n integration
 */

/**
 * AI Model structure from ai-models.json
 */
export interface AIModel {
  id: string;
  name: string;
  description: string;
  isLatest?: boolean;
  contextWindow?: number;
  maxOutput?: number;
  pricing?: {
    input: number;
    output: number;
  };
}

/**
 * AI Provider configuration
 */
export interface AIProviderConfig {
  enabled: boolean;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  endpoint?: string;
  deploymentName?: string;
  apiVersion?: string;
}

/**
 * Translation function parameters
 */
export interface TranslationParams {
  [key: string]: string | number;
}

/**
 * Supported language codes
 */
export type SupportedLanguage = 'en' | 'de';

/**
 * Translation key paths - helps with type safety for translation keys
 */
export type TranslationKey =
  | `cli.commands.${string}.description`
  | `cli.commands.${string}.${string}`
  | `version_manager.${string}`
  | `solid.srp.${string}.${string}`
  | `report_generator.${string}.${string}`
  | `config.${string}`
  | `ui.${string}`;
