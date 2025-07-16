import inquirer from 'inquirer';
import chalk from 'chalk';
import { SupportedLanguage, SUPPORTED_LANGUAGES, LANGUAGE_NAMES, setUserLanguage, isFirstRun } from './i18n';

/**
 * Interactive language selection for first-time users
 */
export async function promptLanguageSelection(): Promise<SupportedLanguage> {
  console.log(chalk.cyan('\n🌍 Welcome to WOARU / Willkommen bei WOARU\n'));
  
  const { language } = await inquirer.prompt([
    {
      type: 'list',
      name: 'language',
      message: 'Please select your preferred language / Bitte wählen Sie Ihre bevorzugte Sprache:',
      choices: SUPPORTED_LANGUAGES.map(lang => ({
        name: `${LANGUAGE_NAMES[lang]} (${lang})`,
        value: lang
      })),
      default: 'en'
    }
  ]);

  return language as SupportedLanguage;
}

/**
 * Handle first-time language setup
 */
export async function handleFirstTimeLanguageSetup(): Promise<void> {
  const firstRun = await isFirstRun();
  
  if (firstRun) {
    console.log(chalk.yellow('🚀 First time running WOARU! Let\'s set up your language preference.\n'));
    
    const selectedLanguage = await promptLanguageSelection();
    
    // Save the language preference
    await setUserLanguage(selectedLanguage);
    
    // Show confirmation in the selected language
    if (selectedLanguage === 'de') {
      console.log(chalk.green(`✅ Sprache auf 🇩🇪 Deutsch gesetzt! WOARU ist jetzt bereit.`));
    } else {
      console.log(chalk.green(`✅ Language set to 🇺🇸 English! WOARU is now ready.`));
    }
    
    console.log(chalk.gray(`\n💡 You can change your language anytime with: woaru config set language <en|de>\n`));
  }
}

/**
 * Show current language configuration
 */
export async function showLanguageStatus(): Promise<void> {
  const { getUserLanguage } = await import('./i18n');
  const currentLang = await getUserLanguage();
  
  console.log(chalk.cyan('\n🌍 Language Configuration:'));
  console.log(`   Current: ${LANGUAGE_NAMES[currentLang as SupportedLanguage] || currentLang} (${currentLang})`);
  console.log(`   Available: ${SUPPORTED_LANGUAGES.map(lang => `${LANGUAGE_NAMES[lang]} (${lang})`).join(', ')}`);
  console.log(chalk.gray(`\n   Change with: woaru config set language <${SUPPORTED_LANGUAGES.join('|')}>\n`));
}