/**
 * Enhanced Translation Validator
 *
 * This utility ensures translation keys are consistent across all language files
 * and provides comprehensive validation for internationalization requirements.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TranslationIssue {
  key: string;
  issue:
    | 'missing'
    | 'extra'
    | 'type_mismatch'
    | 'empty_value'
    | 'placeholder_mismatch';
  language: string;
  details?: string;
  severity: 'error' | 'warning' | 'info';
}

interface ValidationOptions {
  checkEmptyValues?: boolean;
  checkPlaceholders?: boolean;
  requiredLanguages?: string[];
  baseLanguage?: string;
  ignorePaths?: string[];
}

interface ValidationSummary {
  totalKeys: number;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  languages: string[];
  completeness: Record<string, number>;
}

export class TranslationValidator {
  private localesPath: string;
  private options: ValidationOptions;

  constructor(
    localesPath: string = path.join(__dirname, '../../locales'),
    options: ValidationOptions = {}
  ) {
    this.localesPath = localesPath;
    this.options = {
      checkEmptyValues: true,
      checkPlaceholders: true,
      baseLanguage: 'en',
      requiredLanguages: ['en', 'de'],
      ignorePaths: [],
      ...options,
    };
  }

  /**
   * Validates all translation files for consistency and completeness
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
          if (this.shouldIgnoreKey(key)) continue;

          if (!langKeys.has(key)) {
            issues.push({
              key,
              issue: 'missing',
              language: lang,
              details: `Key "${key}" is missing in ${lang} translation`,
              severity: 'error',
            });
          }
        }

        // Check for extra keys
        for (const key of langKeys) {
          if (this.shouldIgnoreKey(key)) continue;

          if (!allKeys.has(key)) {
            issues.push({
              key,
              issue: 'extra',
              language: lang,
              details: `Key "${key}" exists only in ${lang} translation`,
              severity: 'warning',
            });
          }
        }

        // Check for empty values if enabled
        if (this.options.checkEmptyValues) {
          this.checkEmptyValues(trans, lang, '', issues);
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
            severity: 'error',
          });
        }
      }

      // Check placeholder consistency if enabled
      if (this.options.checkPlaceholders && this.options.baseLanguage) {
        const baseTranslation = translations[this.options.baseLanguage];
        if (baseTranslation) {
          this.checkPlaceholderConsistency(translations, issues);
        }
      }

      // Check required languages
      if (this.options.requiredLanguages) {
        for (const requiredLang of this.options.requiredLanguages) {
          if (!translations[requiredLang]) {
            issues.push({
              key: '',
              issue: 'missing',
              language: requiredLang,
              details: `Required language "${requiredLang}" is missing`,
              severity: 'error',
            });
          }
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
   * Check for empty or whitespace-only values
   */
  private checkEmptyValues(
    obj: Record<string, unknown>,
    language: string,
    prefix: string,
    issues: TranslationIssue[]
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        this.checkEmptyValues(
          value as Record<string, unknown>,
          language,
          fullKey,
          issues
        );
      } else if (typeof value === 'string') {
        if (value.trim() === '') {
          issues.push({
            key: fullKey,
            issue: 'empty_value',
            language,
            details: `Empty or whitespace-only value for key "${fullKey}" in ${language}`,
            severity: 'warning',
          });
        }
      }
    }
  }

  /**
   * Check placeholder consistency between languages
   */
  private checkPlaceholderConsistency(
    translations: Record<string, Record<string, unknown>>,
    issues: TranslationIssue[]
  ): void {
    const baseLanguage = this.options.baseLanguage;
    if (!baseLanguage) {
      throw new Error(
        'Base language is required for placeholder consistency check'
      );
    }
    const baseTranslation = translations[baseLanguage];
    const basePlaceholders = this.extractPlaceholders(baseTranslation);

    for (const [lang, translation] of Object.entries(translations)) {
      if (lang === this.options.baseLanguage) continue;

      const langPlaceholders = this.extractPlaceholders(translation);

      for (const [key, basePlaceholder] of basePlaceholders) {
        const langPlaceholder = langPlaceholders.get(key);

        if (!langPlaceholder) {
          if (basePlaceholder.length > 0) {
            issues.push({
              key,
              issue: 'placeholder_mismatch',
              language: lang,
              details: `Missing placeholders in ${lang}: ${basePlaceholder.join(', ')}`,
              severity: 'error',
            });
          }
          continue;
        }

        const missingPlaceholders = basePlaceholder.filter(
          p => !langPlaceholder.includes(p)
        );
        const extraPlaceholders = langPlaceholder.filter(
          p => !basePlaceholder.includes(p)
        );

        if (missingPlaceholders.length > 0) {
          issues.push({
            key,
            issue: 'placeholder_mismatch',
            language: lang,
            details: `Missing placeholders in ${lang}: ${missingPlaceholders.join(', ')}`,
            severity: 'error',
          });
        }

        if (extraPlaceholders.length > 0) {
          issues.push({
            key,
            issue: 'placeholder_mismatch',
            language: lang,
            details: `Extra placeholders in ${lang}: ${extraPlaceholders.join(', ')}`,
            severity: 'warning',
          });
        }
      }
    }
  }

  /**
   * Extract placeholders from translation object
   */
  private extractPlaceholders(
    obj: Record<string, unknown>,
    prefix: string = ''
  ): Map<string, string[]> {
    const placeholders = new Map<string, string[]>();

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const nested = this.extractPlaceholders(
          value as Record<string, unknown>,
          fullKey
        );
        nested.forEach((placeholderList, nestedKey) => {
          placeholders.set(nestedKey, placeholderList);
        });
      } else if (typeof value === 'string') {
        const matches = value.match(/\{\{[^}]+\}\}/g) || [];
        if (matches.length > 0) {
          placeholders.set(fullKey, matches);
        }
      }
    }

    return placeholders;
  }

  /**
   * Check if a key should be ignored based on ignore patterns
   */
  private shouldIgnoreKey(key: string): boolean {
    if (!this.options.ignorePaths) return false;

    return this.options.ignorePaths.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(key);
      }
      return key.startsWith(pattern);
    });
  }

  /**
   * Generate a comprehensive validation summary
   */
  generateSummary(issues: TranslationIssue[]): ValidationSummary {
    const summary: ValidationSummary = {
      totalKeys: 0,
      totalIssues: issues.length,
      errorCount: issues.filter(i => i.severity === 'error').length,
      warningCount: issues.filter(i => i.severity === 'warning').length,
      infoCount: issues.filter(i => i.severity === 'info').length,
      languages: [],
      completeness: {},
    };

    // Calculate completeness for each language
    const langStats = new Map<string, { total: number; missing: number }>();

    issues.forEach(issue => {
      if (issue.language !== 'multiple') {
        if (!langStats.has(issue.language)) {
          langStats.set(issue.language, { total: 0, missing: 0 });
        }

        const stats = langStats.get(issue.language);
        if (!stats) {
          langStats.set(issue.language, {
            total: 1,
            missing: issue.issue === 'missing' ? 1 : 0,
          });
        } else {
          if (issue.issue === 'missing') {
            stats.missing++;
          }
          stats.total++;
        }
      }
    });

    summary.languages = Array.from(langStats.keys());

    langStats.forEach((stats, lang) => {
      const completeness = Math.max(
        0,
        100 - (stats.missing / Math.max(stats.total, 1)) * 100
      );
      summary.completeness[lang] = Math.round(completeness * 100) / 100;
    });

    return summary;
  }

  /**
   * Compare specific languages and return detailed comparison
   */
  async compareLanguages(
    lang1: string,
    lang2: string
  ): Promise<{
    onlyInLang1: string[];
    onlyInLang2: string[];
    common: string[];
    differences: Array<{
      key: string;
      lang1Value: unknown;
      lang2Value: unknown;
    }>;
  }> {
    const translation1Path = path.join(
      this.localesPath,
      lang1,
      'translation.json'
    );
    const translation2Path = path.join(
      this.localesPath,
      lang2,
      'translation.json'
    );

    const [trans1, trans2] = await Promise.all([
      fs.readJson(translation1Path),
      fs.readJson(translation2Path),
    ]);

    const keys1 = new Set<string>();
    const keys2 = new Set<string>();

    this.extractKeys(trans1, '', keys1);
    this.extractKeys(trans2, '', keys2);

    const onlyInLang1 = Array.from(keys1).filter(k => !keys2.has(k));
    const onlyInLang2 = Array.from(keys2).filter(k => !keys1.has(k));
    const common = Array.from(keys1).filter(k => keys2.has(k));

    const differences: Array<{
      key: string;
      lang1Value: unknown;
      lang2Value: unknown;
    }> = [];

    for (const key of common) {
      const val1 = this.getValueByKey(trans1, key);
      const val2 = this.getValueByKey(trans2, key);

      if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        differences.push({ key, lang1Value: val1, lang2Value: val2 });
      }
    }

    return { onlyInLang1, onlyInLang2, common, differences };
  }

  /**
   * Generate a report of translation issues
   */
  generateReport(issues: TranslationIssue[]): string {
    if (issues.length === 0) {
      return '✅ All translations are consistent!';
    }

    const summary = this.generateSummary(issues);
    const report = ['# Translation Validation Report', ''];

    // Add summary section
    report.push('## Summary');
    report.push('');
    report.push(`- **Total Issues**: ${summary.totalIssues}`);
    report.push(`- **Errors**: ${summary.errorCount}`);
    report.push(`- **Warnings**: ${summary.warningCount}`);
    report.push(`- **Languages**: ${summary.languages.join(', ')}`);
    report.push('');

    // Add completeness section
    if (Object.keys(summary.completeness).length > 0) {
      report.push('## Translation Completeness');
      report.push('');
      Object.entries(summary.completeness).forEach(([lang, percentage]) => {
        const status = percentage >= 95 ? '✅' : percentage >= 80 ? '⚠️' : '❌';
        report.push(`- **${lang}**: ${percentage}% ${status}`);
      });
      report.push('');
    }

    // Group by severity first, then by issue type
    const bySeverity = issues.reduce(
      (acc, issue) => {
        if (!acc[issue.severity]) acc[issue.severity] = [];
        acc[issue.severity].push(issue);
        return acc;
      },
      {} as Record<string, TranslationIssue[]>
    );

    // Process each severity level
    (['error', 'warning', 'info'] as const).forEach(severity => {
      const severityIssues = bySeverity[severity];
      if (!severityIssues || severityIssues.length === 0) return;

      const severityIcon =
        severity === 'error' ? '🔴' : severity === 'warning' ? '🟡' : '🔵';
      report.push(
        `## ${severityIcon} ${severity.toUpperCase()} (${severityIssues.length})`
      );
      report.push('');

      // Group by issue type within severity
      const byType = severityIssues.reduce(
        (acc, issue) => {
          if (!acc[issue.issue]) acc[issue.issue] = [];
          acc[issue.issue].push(issue);
          return acc;
        },
        {} as Record<string, TranslationIssue[]>
      );

      this.addIssueTypeSection(report, byType, 'missing', 'Missing Keys');
      this.addIssueTypeSection(report, byType, 'extra', 'Extra Keys');
      this.addIssueTypeSection(
        report,
        byType,
        'type_mismatch',
        'Type Mismatches'
      );
      this.addIssueTypeSection(report, byType, 'empty_value', 'Empty Values');
      this.addIssueTypeSection(
        report,
        byType,
        'placeholder_mismatch',
        'Placeholder Mismatches'
      );
    });

    return report.join('\n');
  }

  /**
   * Helper method to add issue type sections to report
   */
  private addIssueTypeSection(
    report: string[],
    byType: Record<string, TranslationIssue[]>,
    issueType: string,
    title: string
  ): void {
    if (byType[issueType]) {
      report.push(`### ${title} (${byType[issueType].length})`);
      report.push('');
      byType[issueType].forEach(issue => {
        if (issue.language === 'multiple') {
          report.push(`- \`${issue.key}\`: ${issue.details}`);
        } else {
          report.push(
            `- **${issue.language}**: \`${issue.key}\`${issue.details ? ` - ${issue.details}` : ''}`
          );
        }
      });
      report.push('');
    }
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
