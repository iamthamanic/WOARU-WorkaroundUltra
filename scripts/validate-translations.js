#!/usr/bin/env node
/**
 * Translation Validation Script
 * Validates that all translation files are complete and consistent
 * Used during build process to ensure translation quality
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import config from './translation-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR = path.join(__dirname, '../locales');

class TranslationValidator {
  constructor(mode = 'default') {
    this.errors = [];
    this.warnings = [];
    this.stats = {};
    this.mode = mode;
    this.config = this.getConfig(mode);
  }

  /**
   * Get configuration based on mode
   */
  getConfig(mode) {
    if (mode === 'strict') {
      return { ...config.rules, ...config.modes.strict };
    } else if (mode === 'development') {
      return { ...config.rules, ...config.modes.development };
    }
    return config.rules;
  }

  /**
   * Recursively get all translation keys from an object
   */
  getTranslationKeys(obj, prefix = '') {
    const keys = [];
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null) {
        keys.push(...this.getTranslationKeys(value, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    
    return keys;
  }

  /**
   * Check if a translation value is empty or placeholder
   */
  isEmptyOrInvalid(value, key) {
    if (typeof value !== 'string') return true;
    
    const trimmed = value.trim();
    if (!trimmed) return true;
    
    // Check if this key is allowed to be empty
    if (this.config.allowEmptyKeys && this.config.allowEmptyKeys.includes(key)) {
      return false;
    }
    
    // Check for common placeholder patterns
    const placeholders = [
      'TODO',
      'FIXME',
      'PLACEHOLDER',
      '...',
      'TBD',
      'NOT_TRANSLATED'
    ];
    
    return placeholders.some(placeholder => 
      trimmed.toUpperCase().includes(placeholder)
    );
  }

  /**
   * Validate a single translation file
   */
  async validateTranslationFile(langCode, filePath) {
    try {
      const content = await fs.readJson(filePath);
      const keys = this.getTranslationKeys(content);
      
      this.stats[langCode] = {
        totalKeys: keys.length,
        validKeys: 0,
        emptyKeys: 0,
        file: filePath
      };

      const emptyKeys = [];
      
      // Check each translation key
      for (const key of keys) {
        const value = this.getNestedValue(content, key);
        
        if (this.isEmptyOrInvalid(value, key)) {
          emptyKeys.push(key);
          this.stats[langCode].emptyKeys++;
        } else {
          this.stats[langCode].validKeys++;
        }
      }

      // Only report empty keys as errors if there are too many
      if (emptyKeys.length > 0) {
        const completionPercent = Math.round((this.stats[langCode].validKeys / this.stats[langCode].totalKeys) * 100);
        const minCompletion = this.config.minimumCompletion?.[langCode] || 90;
        
        if (completionPercent < minCompletion) {
          this.errors.push({
            type: 'empty_translations',
            language: langCode,
            file: filePath,
            keys: emptyKeys,
            message: `${langCode}: ${emptyKeys.length} empty translations (${completionPercent}% complete, minimum ${minCompletion}%)`
          });
        } else {
          this.warnings.push({
            type: 'empty_translations_warning',
            language: langCode,
            file: filePath,
            keys: emptyKeys,
            message: `${langCode}: ${emptyKeys.length} empty translations found but completion rate acceptable (${completionPercent}%)`
          });
        }
      }

      return { langCode, keys, emptyKeys };
      
    } catch (error) {
      this.errors.push({
        type: 'file_error',
        language: langCode,
        file: filePath,
        error: error.message,
        message: `${langCode}: Failed to read translation file`
      });
      
      return { langCode, keys: [], emptyKeys: [] };
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, key) {
    return key.split('.').reduce((current, prop) => {
      return current && current[prop];
    }, obj);
  }

  /**
   * Compare translation completeness between languages
   */
  compareTranslations(translations) {
    if (translations.length < 2) return;

    // Use configured reference language or find the one with the most keys
    let reference;
    if (config.referenceLanguage) {
      reference = translations.find(t => t.langCode === config.referenceLanguage);
    }
    if (!reference) {
      reference = translations.reduce((prev, current) => 
        prev.keys.length > current.keys.length ? prev : current
      );
    }

    for (const translation of translations) {
      if (translation.langCode === reference.langCode) continue;

      const missingKeys = reference.keys.filter(key => 
        !translation.keys.includes(key)
      );

      // Filter out allowed missing keys
      const allowedMissing = this.config.allowMissingKeys?.[translation.langCode] || [];
      const actualMissingKeys = missingKeys.filter(key => !allowedMissing.includes(key));
      
      const maxMissing = this.config.maxMissingKeys?.[translation.langCode] || 10;

      if (actualMissingKeys.length > 0) {
        if (actualMissingKeys.length > maxMissing) {
          this.errors.push({
            type: 'missing_keys',
            language: translation.langCode,
            reference: reference.langCode,
            keys: actualMissingKeys,
            message: `${translation.langCode}: ${actualMissingKeys.length} keys missing (max allowed: ${maxMissing})`
          });
        } else {
          this.warnings.push({
            type: 'missing_keys_warning',
            language: translation.langCode,
            reference: reference.langCode,
            keys: actualMissingKeys,
            message: `${translation.langCode}: ${actualMissingKeys.length} keys missing but within acceptable range`
          });
        }
      }

      const extraKeys = translation.keys.filter(key => 
        !reference.keys.includes(key)
      );

      if (extraKeys.length > 0) {
        this.warnings.push({
          type: 'extra_keys',
          language: translation.langCode,
          reference: reference.langCode,
          keys: extraKeys,
          message: `${translation.langCode}: ${extraKeys.length} extra keys not found in ${reference.langCode}`
        });
      }
    }
  }

  /**
   * Main validation function
   */
  async validate() {
    console.log(chalk.blue(`🔍 Validating translations (${this.mode} mode)...`));
    
    try {
      // Check if locales directory exists
      if (!(await fs.pathExists(LOCALES_DIR))) {
        this.errors.push({
          type: 'directory_missing',
          message: `Locales directory not found: ${LOCALES_DIR}`
        });
        return false;
      }

      // Get all language directories
      const languageDirs = await fs.readdir(LOCALES_DIR);
      const translations = [];

      // Validate each language
      for (const lang of languageDirs) {
        const langPath = path.join(LOCALES_DIR, lang);
        const stat = await fs.stat(langPath);
        
        if (stat.isDirectory()) {
          const translationFile = path.join(langPath, 'translation.json');
          
          if (await fs.pathExists(translationFile)) {
            const result = await this.validateTranslationFile(lang, translationFile);
            translations.push(result);
          } else {
            this.errors.push({
              type: 'file_missing',
              language: lang,
              file: translationFile,
              message: `${lang}: translation.json file not found`
            });
          }
        }
      }

      // Compare translations for consistency
      if (translations.length > 1) {
        this.compareTranslations(translations);
      }

      // Report results
      this.reportResults();

      return this.errors.length === 0;
      
    } catch (error) {
      console.error(chalk.red('❌ Validation failed:'), error.message);
      return false;
    }
  }

  /**
   * Report validation results
   */
  reportResults() {
    console.log('\n' + chalk.cyan('📊 Translation Statistics:'));
    
    // Print statistics for each language
    for (const [lang, stats] of Object.entries(this.stats)) {
      const completeness = stats.totalKeys > 0 
        ? Math.round((stats.validKeys / stats.totalKeys) * 100)
        : 0;
      
      const colorFn = completeness >= 95 ? chalk.green : completeness >= 90 ? chalk.yellow : chalk.red;
      console.log(chalk.white(`  ${lang.toUpperCase()}:`), 
        chalk.green(`${stats.validKeys} valid`),
        stats.emptyKeys > 0 ? chalk.yellow(`${stats.emptyKeys} empty`) : '',
        colorFn(`(${completeness}% complete)`)
      );
    }

    // Print errors
    if (this.errors.length > 0) {
      console.log('\n' + chalk.red('❌ Errors found:'));
      
      for (const error of this.errors) {
        console.log(chalk.red(`  • ${error.message}`));
        
        if (error.keys && error.keys.length > 0) {
          const displayKeys = error.keys.slice(0, 3);
          console.log(chalk.gray(`    Keys: ${displayKeys.join(', ')}${error.keys.length > 3 ? ` ... and ${error.keys.length - 3} more` : ''}`));
        }
      }
    }

    // Print warnings
    if (this.warnings.length > 0) {
      console.log('\n' + chalk.yellow('⚠️  Warnings:'));
      
      for (const warning of this.warnings) {
        console.log(chalk.yellow(`  • ${warning.message}`));
        
        if (warning.keys && warning.keys.length > 0 && warning.keys.length <= 5) {
          console.log(chalk.gray(`    Keys: ${warning.keys.join(', ')}`));
        }
      }
    }

    // Summary
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('\n' + chalk.green('✅ All translations are valid and complete!'));
    } else if (this.errors.length === 0) {
      console.log('\n' + chalk.green('✅ No critical errors found!'));
      console.log(chalk.yellow(`⚠️  ${this.warnings.length} warnings can be addressed later`));
    } else {
      console.log('\n' + chalk.red(`❌ Found ${this.errors.length} errors and ${this.warnings.length} warnings`));
      
      if (this.mode === 'development') {
        console.log(chalk.yellow('\n💡 Running in development mode. Some errors are acceptable.'));
        console.log(chalk.gray('   Use --strict for production validation.'));
      } else {
        console.log(chalk.red('\n💡 Please fix the above errors before building.'));
        console.log(chalk.gray('   Empty translations should be completed or marked as optional.'));
        console.log(chalk.gray('   Missing keys should be added to maintain consistency.'));
      }
    }
  }
}

// CLI execution
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const mode = args.includes('--strict') ? 'strict' : 
              args.includes('--dev') ? 'development' : 'default';
  
  const validator = new TranslationValidator(mode);
  const isValid = await validator.validate();
  
  // Exit with error code if validation failed (unless in development mode)
  if (!isValid && mode !== 'development') {
    process.exit(1);
  }
}

// Export for programmatic use
export { TranslationValidator };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(chalk.red('❌ Validation script failed:'), error.message);
    process.exit(1);
  });
}