#!/usr/bin/env node
/**
 * Strict Translation Validation Script
 * For CI/production builds - requires all translations to be complete
 */

const { TranslationValidator } = require('./validate-translations');
const chalk = require('chalk');

async function main() {
  console.log(chalk.blue('🔒 Running strict translation validation for production build...'));
  
  const validator = new TranslationValidator('strict');
  const isValid = await validator.validate();
  
  if (!isValid) {
    console.error(chalk.red('\n🚨 PRODUCTION BUILD BLOCKED'));
    console.error(chalk.red('Translation validation failed in strict mode.'));
    console.error(chalk.yellow('\n💡 To fix these issues:'));
    console.error(chalk.gray('   1. Complete all empty translations'));
    console.error(chalk.gray('   2. Add missing translation keys'));  
    console.error(chalk.gray('   3. Remove unused translation keys'));
    console.error(chalk.gray('   4. Run "npm run validate:translations --dev" for development validation'));
    process.exit(1);
  }
  
  console.log(chalk.green('\n🎉 Strict validation passed! Build can proceed.'));
}

main().catch(error => {
  console.error(chalk.red('❌ Strict validation script failed:'), error.message);
  process.exit(1);
});