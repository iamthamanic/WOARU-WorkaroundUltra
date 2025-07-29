import i18next from 'i18next';
import { ConfigManager } from './ConfigManager';
import {
  bundledTranslations,
  type SupportedLanguage,
} from '../generated/translations';

export type { SupportedLanguage };

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = Object.keys(
  bundledTranslations
) as SupportedLanguage[];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: '🇺🇸 English',
  de: '🇩🇪 Deutsch',
};

// Track initialization state
let isI18nInitialized = false;

/**
 * Initialize i18next synchronously with embedded translations
 * This function is now synchronous and uses pre-bundled translations
 */
export function initializeI18n(): void {
  // Skip initialization if already initialized
  if (isI18nInitialized) {
    return;
  }

  try {
    // Get user's preferred language synchronously
    const userLanguage = getUserLanguageSync();

    // Initialize i18next synchronously with embedded translations
    i18next.init({
      lng: userLanguage,
      fallbackLng: 'en',
      debug: false,

      // Namespace configuration
      ns: ['translation'],
      defaultNS: 'translation',

      // Interpolation options
      interpolation: {
        escapeValue: false,
      },

      // Use the pre-bundled translations
      resources: bundledTranslations,
    });

    isI18nInitialized = true;
  } catch (error) {
    console.error('[i18n] Failed to initialize i18next:', error);
    // Fall back to English and continue
    i18next.init({
      lng: 'en',
      fallbackLng: 'en',
      debug: false,
      ns: ['translation'],
      defaultNS: 'translation',
      interpolation: {
        escapeValue: false,
      },
      resources: {
        en: bundledTranslations.en || { translation: {} },
      },
    });
    isI18nInitialized = true;
  }
}

/**
 * Get the user's preferred language from configuration (synchronous)
 */
function getUserLanguageSync(): SupportedLanguage {
  try {
    // For now, we'll use a simple fallback to English
    // In the future, we could implement synchronous config reading if needed
    // For most use cases, English as default is fine until user explicitly sets language
    return 'en';
  } catch {
    // If anything fails, fall back to English
  }

  return 'en'; // Default fallback
}

/**
 * Get the user's preferred language from configuration (async version for compatibility)
 */
export async function getUserLanguage(): Promise<SupportedLanguage> {
  try {
    const configManager = ConfigManager.getInstance();
    const userConfig = await configManager.loadUserConfig();

    if (
      userConfig &&
      userConfig.language &&
      SUPPORTED_LANGUAGES.includes(userConfig.language as SupportedLanguage)
    ) {
      return userConfig.language as SupportedLanguage;
    }
  } catch {
    // If config doesn't exist or is invalid, fall back to English
  }

  return 'en'; // Default fallback
}

/**
 * Set the user's preferred language and save to configuration
 */
export async function setUserLanguage(
  language: SupportedLanguage
): Promise<void> {
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const configManager = ConfigManager.getInstance();
  await configManager.setUserLanguage(language);

  // Change the current i18next language
  await i18next.changeLanguage(language);
}

/**
 * Check if this is the first time WOARU is being run
 */
export async function isFirstRun(): Promise<boolean> {
  try {
    const configManager = ConfigManager.getInstance();
    const userConfig = await configManager.loadUserConfig();

    // If user config exists and has language set, it's not first run
    return !userConfig || !userConfig.language;
  } catch {
    // If config can't be loaded, assume it's first run
    return true;
  }
}

/**
 * Get translation function (shorthand)
 */
export function t(key: string, options?: Record<string, unknown>): string {
  if (!isI18nInitialized) {
    // Initialize if not done yet
    initializeI18n();
  }

  const result = i18next.t(key, options) as string;
  return result;
}

/**
 * Get current language
 */
export function getCurrentLanguage(): SupportedLanguage {
  if (!isI18nInitialized) {
    initializeI18n();
  }
  return i18next.language as SupportedLanguage;
}

/**
 * Check if i18next is initialized
 */
export function isInitialized(): boolean {
  return isI18nInitialized && i18next.isInitialized;
}

/**
 * Get language instruction for AI prompts
 */
export function getAILanguageInstruction(): string {
  return t('ai_prompts.language_instruction') as string;
}
