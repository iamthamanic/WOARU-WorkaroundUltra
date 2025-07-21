/**
 * Translation Validator
 *
 * This utility helps ensure translation keys are consistent across all language files
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';

interface TranslationIssue {
  key: string;
  issue: 'missing' | 'extra' | 'type_mismatch';
  language: string;
  details?: string;
}

export class TranslationValidator {
  private localesPath: string;

  constructor(localesPath: string = path.join(__dirname, '../../locales')) {
    this.localesPath = localesPath;
  }

  /**
   * Validates all translation files for consistency
   */
  async validateTranslations(): Promise<TranslationIssue[]> {
    const issues: TranslationIssue[] = [];

    try {
      // Get all language files
      const langFiles = await glob('*/translation.json', {
        cwd: this.localesPath,
      });

      if (langFiles.length < 2) {
        console.warn('Less than 2 language files found. Skipping validation.');
        return issues;
      }

      // Load all translations
      const translations: Record<string, Record<string, unknown>> = {};
      for (const file of langFiles) {
        const lang = path.dirname(file);
        const content = await fs.readJson(path.join(this.localesPath, file));
        translations[lang] = content;
      }

      // Get all unique keys from all languages
      const allKeys = new Set<string>();
      Object.values(translations).forEach(trans => {
        this.extractKeys(trans, '', allKeys);
      });

      // Check each language has all keys
      for (const [lang, trans] of Object.entries(translations)) {
        const langKeys = new Set<string>();
        this.extractKeys(trans, '', langKeys);

        // Check for missing keys
        for (const key of allKeys) {
          if (!langKeys.has(key)) {
            issues.push({
              key,
              issue: 'missing',
              language: lang,
              details: `Key "${key}" is missing in ${lang} translation`,
            });
          }
        }

        // Check for extra keys
        for (const key of langKeys) {
          if (!allKeys.has(key)) {
            issues.push({
              key,
              issue: 'extra',
              language: lang,
              details: `Key "${key}" exists only in ${lang} translation`,
            });
          }
        }
      }

      // Check for type mismatches (e.g., string vs object)
      for (const key of allKeys) {
        const types = new Map<string, string>();

        for (const [lang, trans] of Object.entries(translations)) {
          const value = this.getValueByKey(trans, key);
          if (value !== undefined) {
            types.set(lang, typeof value);
          }
        }

        const uniqueTypes = new Set(types.values());
        if (uniqueTypes.size > 1) {
          issues.push({
            key,
            issue: 'type_mismatch',
            language: 'multiple',
            details: `Type mismatch for key "${key}": ${Array.from(
              types.entries()
            )
              .map(([l, t]) => `${l}=${t}`)
              .join(', ')}`,
          });
        }
      }
    } catch (error) {
      console.error('Error validating translations:', error);
    }

    return issues;
  }

  /**
   * Recursively extract all keys from a translation object
   */
  private extractKeys(
    obj: Record<string, unknown>,
    prefix: string,
    keys: Set<string>
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        this.extractKeys(value as Record<string, unknown>, fullKey, keys);
      } else {
        keys.add(fullKey);
      }
    }
  }

  /**
   * Get value by dot-notation key
   */
  private getValueByKey(obj: Record<string, unknown>, key: string): unknown {
    const parts = key.split('.');
    let current = obj;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        const nextValue = (current as Record<string, unknown>)[part];
        if (typeof nextValue === 'object' && nextValue !== null) {
          current = nextValue as Record<string, unknown>;
        } else {
          return nextValue;
        }
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Generate a report of translation issues
   */
  generateReport(issues: TranslationIssue[]): string {
    if (issues.length === 0) {
      return '✅ All translations are consistent!';
    }

    const report = ['# Translation Validation Report', ''];

    // Group by issue type
    const byType = issues.reduce(
      (acc, issue) => {
        if (!acc[issue.issue]) acc[issue.issue] = [];
        acc[issue.issue].push(issue);
        return acc;
      },
      {} as Record<string, TranslationIssue[]>
    );

    if (byType.missing) {
      report.push(`## Missing Keys (${byType.missing.length})`);
      report.push('');
      byType.missing.forEach(issue => {
        report.push(`- **${issue.language}**: \`${issue.key}\``);
      });
      report.push('');
    }

    if (byType.extra) {
      report.push(`## Extra Keys (${byType.extra.length})`);
      report.push('');
      byType.extra.forEach(issue => {
        report.push(`- **${issue.language}**: \`${issue.key}\``);
      });
      report.push('');
    }

    if (byType.type_mismatch) {
      report.push(`## Type Mismatches (${byType.type_mismatch.length})`);
      report.push('');
      byType.type_mismatch.forEach(issue => {
        report.push(`- \`${issue.key}\`: ${issue.details}`);
      });
      report.push('');
    }

    return report.join('\n');
  }
}

// Export for CLI usage
export async function validateI18n(): Promise<void> {
  const validator = new TranslationValidator();
  const issues = await validator.validateTranslations();

  if (issues.length > 0) {
    console.log(validator.generateReport(issues));
    process.exit(1);
  } else {
    console.log('✅ All translations are consistent!');
  }
}
