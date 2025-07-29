/**
 * Single Responsibility Principle (SRP) Checker
 * Erkennt Klassen und Methoden, die zu viele Verantwortlichkeiten haben
 */

import { BaseSOLIDChecker } from './BaseSOLIDChecker';
import {
  SOLIDViolation,
  SOLIDPrinciple,
  ClassAnalysis,
  MethodAnalysis,
} from '../types/solid-types';
import { TypeScriptParser } from '../parsers/TypeScriptParser';
import { APP_CONFIG } from '../../config/constants';
import { t } from '../../config/i18n';

export class SRPChecker extends BaseSOLIDChecker {
  protected principle: SOLIDPrinciple = 'SRP';
  protected supportedLanguages = ['typescript', 'javascript'];

  private parser: TypeScriptParser;

  constructor() {
    super();
    this.parser = new TypeScriptParser();
  }

  /**
   * Führt SRP-Analyse für eine Datei durch
   */
  async check(filePath: string, language: string): Promise<SOLIDViolation[]> {
    if (!this.supportsLanguage(language)) {
      return [];
    }

    const violations: SOLIDViolation[] = [];

    try {
      // Parse die Datei
      const analysis = await this.parser.parseFile(filePath);

      // Analysiere jede Klasse
      for (const classAnalysis of analysis.classes) {
        // Füge Import-Concerns zur Klassen-Analyse hinzu
        classAnalysis.concerns = this.analyzeImportConcerns(analysis.imports);

        // 1. Check für zu viele Methoden (High Method Count)
        violations.push(...this.checkMethodCount(filePath, classAnalysis));

        // 2. Check für zu hohe Komplexität
        violations.push(...this.checkComplexity(filePath, classAnalysis));

        // 3. Check für zu viele verschiedene Concerns
        violations.push(...this.checkConcernDiversity(filePath, classAnalysis));

        // 4. Check für zu große Klassen (Lines of Code)
        violations.push(...this.checkClassSize(filePath, classAnalysis));

        // 5. Check für Methoden mit zu vielen Parametern
        violations.push(...this.checkMethodParameters(filePath, classAnalysis));
      }

      // 6. File-Level Check: Zu viele Klassen in einer Datei
      violations.push(...this.checkFileClassCount(filePath, analysis.classes));
    } catch (error) {
      // Log error with more context for debugging
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.warn(t('solid.srp.analysis_error', { filePath }), {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    return violations;
  }

  /**
   * Prüft auf zu viele Methoden in einer Klasse
   */
  private checkMethodCount(
    filePath: string,
    classAnalysis: ClassAnalysis
  ): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];
    const methodCount = classAnalysis.methods.length;

    // Thresholds für Method Count
    const thresholds = APP_CONFIG.SOLID_THRESHOLDS.METHODS_PER_CLASS;

    if (methodCount >= thresholds.low) {
      const severity = this.calculateSeverity(methodCount, thresholds);

      violations.push(
        this.createViolation({
          file: filePath,
          line: classAnalysis.line,
          class: classAnalysis.name,
          description: t('solid.srp.method_count.description', {
            className: classAnalysis.name,
            count: methodCount,
          }),
          explanation: t('solid.srp.method_count.explanation'),
          impact: t('solid.srp.method_count.impact'),
          suggestion: t('solid.srp.method_count.suggestion', {
            className: classAnalysis.name,
          }),
          severity,
          metrics: {
            methodCount: methodCount,
            complexity: classAnalysis.complexity,
          },
        })
      );
    }

    return violations;
  }

  /**
   * Prüft auf zu hohe Klassen-Komplexität
   */
  private checkComplexity(
    filePath: string,
    classAnalysis: ClassAnalysis
  ): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];
    const complexity = classAnalysis.complexity;

    // Thresholds für Complexity
    const thresholds = APP_CONFIG.SOLID_THRESHOLDS.LINES_PER_METHOD;

    if (complexity >= thresholds.low) {
      const severity = this.calculateSeverity(complexity, thresholds);

      violations.push(
        this.createViolation({
          file: filePath,
          line: classAnalysis.line,
          class: classAnalysis.name,
          description: t('solid.srp.complexity.description', {
            className: classAnalysis.name,
            complexity,
          }),
          explanation: t('solid.srp.complexity.explanation'),
          impact: t('solid.srp.complexity.impact'),
          suggestion: t('solid.srp.complexity.suggestion'),
          severity,
          metrics: {
            complexity: complexity,
            methodCount: classAnalysis.methods.length,
          },
        })
      );
    }

    return violations;
  }

  /**
   * Prüft auf zu viele verschiedene Concerns (Verantwortlichkeiten)
   */
  private checkConcernDiversity(
    filePath: string,
    classAnalysis: ClassAnalysis
  ): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];
    const concernCount = classAnalysis.concerns.length;

    // Thresholds für Concern Diversity
    const thresholds = APP_CONFIG.SOLID_THRESHOLDS.CONSTRUCTOR_PARAMS;

    if (concernCount >= thresholds.low) {
      const severity = this.calculateSeverity(concernCount, thresholds);

      violations.push(
        this.createViolation({
          file: filePath,
          line: classAnalysis.line,
          class: classAnalysis.name,
          description: t('solid.srp.concern_diversity.description', {
            className: classAnalysis.name,
            concernCount,
            concerns: classAnalysis.concerns.join(', '),
          }),
          explanation: t('solid.srp.concern_diversity.explanation'),
          impact: t('solid.srp.concern_diversity.impact'),
          suggestion: t('solid.srp.concern_diversity.suggestion', {
            concernServices: classAnalysis.concerns
              .map((c: string) => `${c}Service`)
              .join(', '),
          }),
          severity,
          metrics: {
            dependencies: concernCount,
            importConcerns: classAnalysis.concerns,
          },
        })
      );
    }

    return violations;
  }

  /**
   * Prüft auf zu große Klassen (Lines of Code)
   */
  private checkClassSize(
    filePath: string,
    classAnalysis: ClassAnalysis
  ): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];
    const linesOfCode = classAnalysis.linesOfCode;

    // Thresholds für Class Size
    const thresholds = APP_CONFIG.SOLID_THRESHOLDS.CHARACTERS_PER_LINE;

    if (linesOfCode >= thresholds.low) {
      const severity = this.calculateSeverity(linesOfCode, thresholds);

      violations.push(
        this.createViolation({
          file: filePath,
          line: classAnalysis.line,
          class: classAnalysis.name,
          description: t('solid.srp.class_size.description', {
            className: classAnalysis.name,
            linesOfCode,
          }),
          explanation: t('solid.srp.class_size.explanation'),
          impact: t('solid.srp.class_size.impact'),
          suggestion: t('solid.srp.class_size.suggestion', {
            className: classAnalysis.name,
          }),
          severity,
          metrics: {
            linesOfCode: linesOfCode,
            methodCount: classAnalysis.methods.length,
          },
        })
      );
    }

    return violations;
  }

  /**
   * Prüft auf Methoden mit zu vielen Parametern
   */
  private checkMethodParameters(
    filePath: string,
    classAnalysis: ClassAnalysis
  ): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];

    classAnalysis.methods.forEach((method: MethodAnalysis) => {
      // Thresholds für Parameter Count
      const thresholds = APP_CONFIG.SOLID_THRESHOLDS.METHODS_PER_INTERFACE;

      if (method.parameters >= thresholds.low) {
        const severity = this.calculateSeverity(method.parameters, thresholds);

        violations.push(
          this.createViolation({
            file: filePath,
            line: method.line,
            class: classAnalysis.name,
            method: method.name,
            description: t('solid.srp.method_parameters.description', {
              methodName: method.name,
              parameterCount: method.parameters,
            }),
            explanation: t('solid.srp.method_parameters.explanation'),
            impact: t('solid.srp.method_parameters.impact'),
            suggestion: t('solid.srp.method_parameters.suggestion', {
              methodName: method.name,
            }),
            severity,
            metrics: {
              parameters: method.parameters,
              complexity: method.complexity,
            },
          })
        );
      }
    });

    return violations;
  }

  /**
   * Prüft auf zu viele Klassen in einer Datei
   */
  private checkFileClassCount(
    filePath: string,
    classes: ClassAnalysis[]
  ): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];
    const classCount = classes.length;

    // Thresholds für Class Count per File
    const thresholds = APP_CONFIG.SOLID_THRESHOLDS.ABSTRACT_METHODS;

    if (classCount >= thresholds.low) {
      const severity = this.calculateSeverity(classCount, thresholds);

      violations.push(
        this.createViolation({
          file: filePath,
          description: t('solid.srp.file_class_count.description', {
            classCount,
            classList: classes.map(c => c.name).join(', '),
          }),
          explanation: t('solid.srp.file_class_count.explanation'),
          impact: t('solid.srp.file_class_count.impact'),
          suggestion: t('solid.srp.file_class_count.suggestion', {
            fileName: this.getFileName(filePath),
          }),
          severity,
          metrics: {
            classCount: classCount,
          },
        })
      );
    }

    return violations;
  }
}
