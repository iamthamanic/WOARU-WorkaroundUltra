/**
 * Example usage of the TranslationValidator
 *
 * This file demonstrates how to use the enhanced TranslationValidator
 * with various configuration options.
 */

import { TranslationValidator } from './translationValidator';
import * as path from 'path';

async function runValidationExamples() {
  console.log('🔍 Running Translation Validation Examples\n');

  // Example 1: Basic validation with default options
  console.log('📋 Example 1: Basic Validation');
  const basicValidator = new TranslationValidator();
  const basicIssues = await basicValidator.validateTranslations();
  console.log(`Found ${basicIssues.length} issues with basic validation`);

  if (basicIssues.length > 0) {
    const summary = basicValidator.generateSummary(basicIssues);
    console.log(
      `Errors: ${summary.errorCount}, Warnings: ${summary.warningCount}`
    );
    console.log(`Language completeness:`, summary.completeness);
  }
  console.log('');

  // Example 2: Validation with custom options
  console.log('📋 Example 2: Custom Validation Options');
  const customValidator = new TranslationValidator(
    path.join(__dirname, '../../locales'),
    {
      checkEmptyValues: true,
      checkPlaceholders: true,
      baseLanguage: 'en',
      requiredLanguages: ['en', 'de'],
      ignorePaths: ['internal.*', 'debug.*'], // Ignore internal and debug keys
    }
  );

  const customIssues = await customValidator.validateTranslations();
  console.log(`Found ${customIssues.length} issues with custom validation`);
  console.log('');

  // Example 3: Language comparison
  console.log('📋 Example 3: Language Comparison');
  try {
    const comparison = await basicValidator.compareLanguages('en', 'de');
    console.log(`🔍 EN vs DE Comparison:`);
    console.log(`- Common keys: ${comparison.common.length}`);
    console.log(`- Only in EN: ${comparison.onlyInLang1.length}`);
    console.log(`- Only in DE: ${comparison.onlyInLang2.length}`);
    console.log(`- Value differences: ${comparison.differences.length}`);

    if (comparison.onlyInLang1.length > 0) {
      console.log(`\nFirst 5 keys only in EN:`);
      comparison.onlyInLang1
        .slice(0, 5)
        .forEach(key => console.log(`  - ${key}`));
    }

    if (comparison.onlyInLang2.length > 0) {
      console.log(`\nFirst 5 keys only in DE:`);
      comparison.onlyInLang2
        .slice(0, 5)
        .forEach(key => console.log(`  - ${key}`));
    }
  } catch (error) {
    console.error('Error comparing languages:', error);
  }
  console.log('');

  // Example 4: Generate detailed report
  console.log('📋 Example 4: Detailed Report Generation');
  if (basicIssues.length > 0) {
    const report = basicValidator.generateReport(basicIssues.slice(0, 10)); // Only first 10 for brevity
    console.log('Sample report (first 10 issues):');
    console.log(report.substring(0, 500) + '...\n');
  }

  // Example 5: Check specific validation scenarios
  console.log('📋 Example 5: Validation Scenarios');

  // Filter issues by type
  const missingKeys = basicIssues.filter(issue => issue.issue === 'missing');
  const typeMismatches = basicIssues.filter(
    issue => issue.issue === 'type_mismatch'
  );
  const placeholderIssues = basicIssues.filter(
    issue => issue.issue === 'placeholder_mismatch'
  );

  console.log(`📊 Issue breakdown:`);
  console.log(`- Missing keys: ${missingKeys.length}`);
  console.log(`- Type mismatches: ${typeMismatches.length}`);
  console.log(`- Placeholder mismatches: ${placeholderIssues.length}`);

  // Show severity distribution
  const errors = basicIssues.filter(issue => issue.severity === 'error');
  const warnings = basicIssues.filter(issue => issue.severity === 'warning');

  console.log(`📊 Severity distribution:`);
  console.log(`- Errors: ${errors.length}`);
  console.log(`- Warnings: ${warnings.length}`);

  console.log('\n✅ Translation validation examples completed!');
}

// Run the examples if this file is executed directly
if (require.main === module) {
  runValidationExamples().catch(console.error);
}

export { runValidationExamples };
