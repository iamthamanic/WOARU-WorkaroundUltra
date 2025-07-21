import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  SupportedLanguage,
  SUPPORTED_LANGUAGES,
  LANGUAGE_NAMES,
  setUserLanguage,
  isFirstRun,
  t,
  initializeI18n,
} from './i18n';

/**
 * Sanitizes user input to prevent injection attacks
 * @param input - The input string to sanitize
 * @returns Sanitized string safe for display
 */
function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  // Remove potentially dangerous characters while preserving international characters
  return input
    .replace(/[<>"'&]/g, '')
    .trim()
    .substring(0, 100);
}

/**
 * Validates language code against supported languages
 * @param language - Language code to validate
 * @returns True if language is supported and valid
 */
function isValidLanguage(language: unknown): language is SupportedLanguage {
  return (
    typeof language === 'string' &&
    SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)
  );
}

/**
 * Interactive language selection for first-time users
 * Implements security validation and proper i18n
 */
export async function promptLanguageSelection(): Promise<SupportedLanguage> {
  // Initialize i18n before using translations
  await initializeI18n();

  console.log(chalk.cyan(`\n${t('language_setup.welcome_multilingual')}\n`));

  const { language } = await inquirer.prompt([
    {
      type: 'list',
      name: 'language',
      message: t('language_selection.prompt'),
      choices: SUPPORTED_LANGUAGES.map(lang => ({
        name: `${LANGUAGE_NAMES[lang]} (${lang})`,
        value: lang,
      })),
      default: 'en',
      validate: (input: unknown) => {
        if (!isValidLanguage(input)) {
          return 'Invalid language selection. Please choose a supported language.';
        }
        return true;
      },
    },
  ]);

  // Additional security validation
  if (!isValidLanguage(language)) {
    throw new Error(
      `Invalid language selection: ${sanitizeInput(String(language))}`
    );
  }

  return language;
}

/**
 * Handle first-time language setup with comprehensive error handling
 * Implements security validation and proper i18n throughout
 */
export async function handleFirstTimeLanguageSetup(): Promise<void> {
  try {
    const firstRun = await isFirstRun();

    if (!firstRun) {
      return; // Not first run, nothing to do
    }

    // Initialize i18n with default language for first-time setup message
    await initializeI18n();

    console.log(chalk.yellow(`\n${t('language_setup.first_time_message')}\n`));

    const selectedLanguage = await promptLanguageSelection();

    // Validate language before proceeding
    if (!isValidLanguage(selectedLanguage)) {
      throw new Error(
        `Invalid language selected: ${sanitizeInput(String(selectedLanguage))}`
      );
    }

    // Save the language preference with error handling
    try {
      await setUserLanguage(selectedLanguage);
    } catch (error) {
      console.error(chalk.red('Failed to save language preference:'), error);
      throw error;
    }

    // Re-initialize i18n with the selected language
    await initializeI18n();

    // Show confirmation in the selected language
    const languageName = sanitizeInput(
      LANGUAGE_NAMES[selectedLanguage] || selectedLanguage
    );
    console.log(
      chalk.green(
        t('language_setup.language_set_confirmation', {
          language: languageName,
        })
      )
    );

    console.log(chalk.gray(`\n${t('language_setup.change_language_hint')}\n`));
  } catch (error) {
    console.error(chalk.red('Error during language setup:'), error);
    // Fallback to English if setup fails
    console.log(chalk.yellow('Falling back to English language...'));
    try {
      await setUserLanguage('en');
    } catch (fallbackError) {
      console.error(
        chalk.red('Critical: Failed to set fallback language'),
        fallbackError
      );
    }
  }
}

/**
 * Show current language configuration with proper i18n and security
 */
export async function showLanguageStatus(): Promise<void> {
  try {
    // Initialize i18n first
    await initializeI18n();

    const { getUserLanguage } = await import('./i18n');
    const currentLang = await getUserLanguage();

    // Validate current language
    if (!isValidLanguage(currentLang)) {
      console.error(
        chalk.red(
          `Invalid current language: ${sanitizeInput(String(currentLang))}`
        )
      );
      return;
    }

    console.log(chalk.cyan(`\n${t('language_setup.current_configuration')}`));

    const currentLanguageName = sanitizeInput(
      LANGUAGE_NAMES[currentLang] || currentLang
    );
    console.log(
      `   ${t('language_setup.current_language_display', {
        name: currentLanguageName,
        code: sanitizeInput(currentLang),
      })}`
    );

    const availableLanguages = SUPPORTED_LANGUAGES.map(
      lang => `${sanitizeInput(LANGUAGE_NAMES[lang])} (${sanitizeInput(lang)})`
    ).join(', ');

    console.log(
      `   ${t('language_setup.available_languages_display', {
        languages: availableLanguages,
      })}`
    );

    console.log(
      chalk.gray(
        `\n   ${t('language_setup.change_command_hint', {
          options: SUPPORTED_LANGUAGES.join('|'),
        })}\n`
      )
    );
  } catch (error) {
    console.error(chalk.red('Error displaying language status:'), error);
    // Fallback display in English
    console.log(
      chalk.yellow('\n🌍 Language Configuration (Error - showing fallback)')
    );
    console.log('   Unable to load current language configuration.');
  }
}
