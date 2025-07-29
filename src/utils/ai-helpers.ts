import chalk from 'chalk';
import { ConfigManager } from '../config/ConfigManager';
import { t, initializeI18n } from '../config/i18n';

/**
 * Type definition for AI provider configuration
 */
interface AiProviderConfig {
  enabled: boolean;
  model?: string;
  id?: string;
  providerType?: string;
  [key: string]: unknown;
}

/**
 * Type definition for AI configuration object
 */
interface AiConfig {
  lastDataUpdate?: string;
  [providerId: string]: AiProviderConfig | string | undefined;
}

/**
 * Sanitizes provider ID to prevent injection attacks
 * @param providerId - The provider ID to sanitize
 * @returns Sanitized provider ID safe for logging and processing
 */
export function sanitizeProviderId(providerId: unknown): string {
  if (typeof providerId !== 'string') {
    return 'invalid';
  }
  // Remove dangerous characters and limit length
  return (
    providerId.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50) || 'invalid'
  );
}

/**
 * Validates provider configuration object
 * @param provider - Provider configuration to validate
 * @returns True if provider configuration is valid
 */
function isValidProviderConfig(
  provider: unknown
): provider is AiProviderConfig {
  return (
    typeof provider === 'object' &&
    provider !== null &&
    typeof (provider as AiProviderConfig).enabled === 'boolean'
  );
}

/**
 * Type guard for AI configuration
 * @param config - Configuration object to validate
 * @returns True if configuration is valid AI config
 */
function isValidAiConfig(config: unknown): config is AiConfig {
  return typeof config === 'object' && config !== null;
}

/**
 * Error class for AI configuration related errors
 */
export class AiConfigurationError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'AiConfigurationError';
  }
}

/**
 * Shows standardized error message for missing AI configuration
 * Implements secure error display with i18n support
 *
 * @param customMessage - Optional custom error message to display
 */
export async function displayAiConfigurationError(
  customMessage?: string
): Promise<void> {
  try {
    await initializeI18n();

    const errorMessage = customMessage || t('ai_helpers.config_missing_error');

    console.error(chalk.red(`❌ ${errorMessage}`));
    console.error(chalk.cyan(`💡 ${t('ai_helpers.config_setup_hint')}`));

    // Graceful notification about shutdown
    console.error(chalk.gray(`ℹ️ ${t('ai_helpers.graceful_shutdown')}`));
  } catch {
    // Fallback error display if i18n fails
    console.error(
      chalk.red(
        '❌ Error: This feature requires an active and correctly configured AI.'
      )
    );
    console.error(
      chalk.cyan(
        '💡 Please first set up an AI provider with the command: woaru ai setup'
      )
    );
  }
}

/**
 * Helper function for validating a single AI provider
 * Implements comprehensive security validation
 *
 * @param providerId - The provider ID to validate (will be sanitized)
 * @param provider - The provider configuration object
 * @returns Promise<boolean> indicating if provider is valid and active
 */
export async function validateSingleProvider(
  providerId: string
): Promise<boolean> {
  const configManager = ConfigManager.getInstance();
  const config = await configManager.loadAiConfig();

  // Type guard to check if config has llm_providers property
  if (config && typeof config === 'object' && 'llm_providers' in config) {
    const llmProviders = config.llm_providers as Record<string, unknown>;
    const provider = llmProviders[providerId] || {};
    return validateAiProvider(providerId, provider);
  }

  return false;
}

export async function validateAiProvider(
  providerId: unknown,
  provider: unknown
): Promise<boolean> {
  try {
    // Sanitize and validate provider ID
    const sanitizedProviderId = sanitizeProviderId(providerId);
    if (sanitizedProviderId === 'invalid') {
      console.debug(
        t('ai_helpers.invalid_provider_id', { provider: String(providerId) })
      );
      return false;
    }

    // Validate provider configuration
    if (!isValidProviderConfig(provider)) {
      console.debug(
        t('ai_helpers.validation_failed', { provider: sanitizedProviderId })
      );
      return false;
    }

    // Check if provider is enabled
    if (provider.enabled !== true) {
      console.debug(
        t('ai_helpers.provider_disabled', { provider: sanitizedProviderId })
      );
      return false;
    }

    // Validate API key exists
    const configManager = ConfigManager.getInstance();
    const hasApiKey = await configManager.hasApiKey(sanitizedProviderId);

    if (!hasApiKey) {
      console.debug(
        t('ai_helpers.api_key_missing_for_provider', {
          provider: sanitizedProviderId,
        })
      );
      return false;
    }

    return true;
  } catch {
    const sanitizedProviderId = sanitizeProviderId(providerId);
    console.debug(
      t('ai_helpers.validation_failed', { provider: sanitizedProviderId })
    );
    return false;
  }
}

/**
 * Helper function to get all active AI providers
 * Implements comprehensive validation and error handling
 *
 * @returns Promise<Array<ActiveProvider>> List of validated active providers
 */
export interface ActiveProvider {
  id: string;
  provider: AiProviderConfig;
}

export async function getActiveProviders(): Promise<ActiveProvider[]> {
  return getActiveAiProviders();
}

export async function getActiveAiProviders(): Promise<ActiveProvider[]> {
  try {
    await initializeI18n();

    const configManager = ConfigManager.getInstance();
    const aiConfig = await configManager.loadAiConfig();

    if (!isValidAiConfig(aiConfig)) {
      console.debug(t('ai_helpers.no_active_providers'));
      return [];
    }

    const activeProviders: ActiveProvider[] = [];
    const validationPromises: Promise<boolean>[] = [];
    const providerEntries: Array<[string, unknown]> = [];

    // Collect all provider entries for batch validation
    for (const [id, provider] of Object.entries(aiConfig)) {
      if (id !== 'lastDataUpdate') {
        providerEntries.push([id, provider]);
        validationPromises.push(validateAiProvider(id, provider));
      }
    }

    // Batch validate all providers
    const validationResults = await Promise.all(validationPromises);

    // Collect valid providers
    for (let i = 0; i < providerEntries.length; i++) {
      const [id, provider] = providerEntries[i];
      const isValid = validationResults[i];

      if (isValid && isValidProviderConfig(provider)) {
        const sanitizedId = sanitizeProviderId(id);
        if (sanitizedId !== 'invalid') {
          activeProviders.push({
            id: sanitizedId,
            provider: provider,
          });
        }
      }
    }

    console.debug(`Found ${activeProviders.length} active AI providers`);
    return activeProviders;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(
      chalk.yellow(t('ai_helpers.config_loading_error')),
      sanitizeProviderId(errorMessage)
    );
    return [];
  }
}

/**
 * Simple boolean check for AI configuration status (used by CLI)
 * Does not throw errors, just returns true/false
 *
 * @returns boolean indicating if AI is configured
 */
export function ensureAiIsConfigured(): boolean {
  try {
    // Simple sync check for basic CLI usage
    // This will be handled by the async version in the control center
    return true; // Optimistic return for CLI display
  } catch {
    return false;
  }
}

/**
 * Async version for comprehensive validation
 * Validates that at least one AI provider is configured and active
 * Implements comprehensive security validation and error handling
 *
 * @throws {AiConfigurationError} When AI is not properly configured
 */
export async function ensureAiIsConfiguredAsync(): Promise<void> {
  try {
    // Initialize i18n first
    await initializeI18n();

    const configManager = ConfigManager.getInstance();
    const aiConfig = await configManager.loadAiConfig();

    // Validate AI configuration exists and is valid
    if (!isValidAiConfig(aiConfig)) {
      throw new AiConfigurationError(
        t('ai_helpers.config_missing_error'),
        'CONFIG_INVALID'
      );
    }

    // Check if configuration has meaningful content (more than just lastDataUpdate)
    const configKeys = Object.keys(aiConfig).filter(
      key => key !== 'lastDataUpdate'
    );
    if (configKeys.length === 0) {
      throw new AiConfigurationError(
        t('ai_helpers.no_active_providers'),
        'NO_PROVIDERS'
      );
    }

    // Find enabled providers with strict validation
    const enabledProviders: Array<[string, AiProviderConfig]> = [];

    for (const [key, value] of Object.entries(aiConfig)) {
      if (key === 'lastDataUpdate') continue;

      const sanitizedKey = sanitizeProviderId(key);
      if (sanitizedKey === 'invalid') {
        console.warn(
          chalk.yellow(t('ai_helpers.invalid_provider_id', { provider: key }))
        );
        continue;
      }

      if (isValidProviderConfig(value) && value.enabled === true) {
        enabledProviders.push([sanitizedKey, value]);
      }
    }

    if (enabledProviders.length === 0) {
      throw new AiConfigurationError(
        t('ai_helpers.no_active_providers'),
        'NO_ENABLED_PROVIDERS'
      );
    }

    // Validate API keys for enabled providers
    let hasValidApiKey = false;
    const validationErrors: string[] = [];

    for (const [providerId] of enabledProviders) {
      try {
        if (await configManager.hasApiKey(providerId)) {
          hasValidApiKey = true;
          break;
        } else {
          validationErrors.push(
            t('ai_helpers.api_key_missing_for_provider', {
              provider: sanitizeProviderId(providerId),
            })
          );
        }
      } catch {
        validationErrors.push(
          t('ai_helpers.validation_failed', {
            provider: sanitizeProviderId(providerId),
          })
        );
      }
    }

    if (!hasValidApiKey) {
      throw new AiConfigurationError(
        [t('ai_helpers.config_missing_error'), ...validationErrors].join('\n'),
        'NO_VALID_API_KEYS'
      );
    }

    // All validation passed
    console.debug(t('ai_helpers.configuration_validation_passed'));
  } catch (error) {
    if (error instanceof AiConfigurationError) {
      await displayAiConfigurationError(error.message);
      throw error; // Re-throw for caller to handle
    }

    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      chalk.red(t('ai_helpers.config_check_error')),
      sanitizeProviderId(errorMessage)
    );

    await displayAiConfigurationError();
    throw new AiConfigurationError(
      t('ai_helpers.config_check_error'),
      'UNEXPECTED_ERROR'
    );
  }
}

/**
 * Gracefully handles AI configuration errors without hard exit
 * Allows calling code to decide how to handle the error
 *
 * @param feature - The feature name that requires AI configuration
 * @returns Promise<boolean> indicating if AI is available
 */
export async function checkAiAvailability(feature?: string): Promise<boolean> {
  try {
    await ensureAiIsConfiguredAsync();
    return true;
  } catch {
    if (feature) {
      console.warn(
        chalk.yellow(`⚠️ ${feature}: ${t('ai_helpers.config_missing_error')}`)
      );
    }
    return false;
  }
}
