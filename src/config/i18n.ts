import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import * as path from 'path';
import * as fs from 'fs-extra';
import { ConfigManager } from './ConfigManager';

export type SupportedLanguage = 'en' | 'de';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'de'];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: '🇺🇸 English',
  de: '🇩🇪 Deutsch',
};

/**
 * Initialize i18next with filesystem backend (optimized)
 */
export async function initializeI18n(): Promise<void> {
  // Skip initialization if already initialized
  if (i18next.isInitialized) {
    return;
  }

  const configManager = ConfigManager.getInstance();

  // Load user's preferred language from config
  const userLanguage = await getUserLanguage();

  // Get the locales directory path (relative to the built JS files in dist/)
  const localesPath = getLocalesPath();

  await i18next.use(Backend).init({
    lng: userLanguage,
    fallbackLng: 'en',
    debug: false,

    backend: {
      loadPath: path.join(localesPath, '{{lng}}/{{ns}}.json'),
    },

    // Namespace configuration
    ns: ['translation'],
    defaultNS: 'translation',

    // Interpolation options
    interpolation: {
      escapeValue: false, // Not needed for server-side usage
    },

    // Resource configuration
    resources: undefined, // Will be loaded from files
  });
}

/**
 * Get the user's preferred language from configuration
 */
export async function getUserLanguage(): Promise<SupportedLanguage> {
  try {
    const configManager = ConfigManager.getInstance();
    const userConfig = await configManager.loadUserConfig();

    if (
      userConfig &&
      userConfig.language &&
      SUPPORTED_LANGUAGES.includes(userConfig.language)
    ) {
      return userConfig.language as SupportedLanguage;
    }
  } catch (error) {
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
 * Get the locales directory path
 * This works both in development (src/) and production (dist/)
 */
function getLocalesPath(): string {
  // Try to find locales directory relative to current file
  const currentDir = __dirname;

  // In development: src/config/i18n.ts -> ../../locales
  // In production: dist/config/i18n.js -> ../../locales
  let localesPath = path.resolve(currentDir, '../../locales');

  // Check if locales directory exists
  if (fs.existsSync(localesPath)) {
    return localesPath;
  }

  // Fallback: try from process.cwd()
  localesPath = path.resolve(process.cwd(), 'locales');
  if (fs.existsSync(localesPath)) {
    return localesPath;
  }

  // Last resort: create a default path
  return path.resolve(process.cwd(), 'locales');
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
  } catch (error) {
    // If config can't be loaded, assume it's first run
    return true;
  }
}

/**
 * Get translation function (shorthand)
 */
export function t(key: string, options?: any): string {
  return i18next.t(key, options) as string;
}

/**
 * Get current language
 */
export function getCurrentLanguage(): SupportedLanguage {
  return i18next.language as SupportedLanguage;
}

/**
 * Check if i18next is initialized
 */
export function isInitialized(): boolean {
  return i18next.isInitialized;
}

/**
 * Get language instruction for AI prompts
 */
export function getAILanguageInstruction(): string {
  return t('ai_prompts.language_instruction') as string;
}
