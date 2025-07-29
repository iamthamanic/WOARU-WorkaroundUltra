/**
 * Base SOLID Checker - Abstrakte Basisklasse für alle SOLID-Prinzipien-Checker
 */

// import { exec } from 'child_process';
// import { promisify } from 'util';
import {
  safeExecAsync,
  validateCommand,
  ALLOWED_COMMANDS,
} from '../../utils/secureExecution';
import { SOLIDViolation, SOLIDPrinciple } from '../types/solid-types';
import { APP_CONFIG } from '../../config/constants';

// const execAsync = promisify(exec);

export abstract class BaseSOLIDChecker {
  protected abstract principle: SOLIDPrinciple;
  protected abstract supportedLanguages: string[];

  /**
   * Hauptmethode für SOLID-Prinzipien-Check
   */
  abstract check(filePath: string, language: string): Promise<SOLIDViolation[]>;

  /**
   * Prüft ob die Sprache unterstützt wird
   */
  supportsLanguage(language: string): boolean {
    return this.supportedLanguages.includes(language.toLowerCase());
  }

  /**
   * Führt ein externes Tool aus und parsed das Ergebnis
   */
  protected async runTool(
    command: string,
    args: string[] = [],
    options: { cwd?: string; timeout?: number } = {}
  ): Promise<string> {
    try {
      // Validate command to prevent injection
      if (!validateCommand(command, [...ALLOWED_COMMANDS])) {
        throw new Error(`Command '${command}' is not allowed`);
      }

      const result = await safeExecAsync(command, args, {
        cwd: options.cwd || process.cwd(),
        timeout: options.timeout || APP_CONFIG.TIMEOUTS.DEFAULT,
      });

      const { stdout, stderr } = result;

      if (stderr && !stdout) {
        throw new Error(stderr);
      }

      return stdout;
    } catch (error: unknown) {
      // Manche Tools geben Ergebnisse über stderr zurück
      if (error && typeof error === 'object' && 'stdout' in error) {
        return (error as { stdout: string }).stdout;
      }
      throw error;
    }
  }

  /**
   * Berechnet einen Severity-Score basierend auf Metriken
   */
  protected calculateSeverity(
    value: number,
    thresholds: { low: number; medium: number; high: number }
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (value >= thresholds.high) return 'critical';
    if (value >= thresholds.medium) return 'high';
    if (value >= thresholds.low) return 'medium';
    return 'low';
  }

  /**
   * Extrahiert Dateinamen ohne Pfad für bessere Lesbarkeit
   */
  protected getFileName(filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }

  /**
   * Generiert eine konsistente Beschreibung für SOLID-Verstöße
   */
  protected createViolation(params: {
    file: string;
    line?: number;
    class?: string;
    method?: string;
    description: string;
    explanation: string;
    impact: string;
    suggestion: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    metrics?: {
      complexity?: number;
      methodCount?: number;
      dependencies?: number;
      parameters?: number;
      linesOfCode?: number;
      importConcerns?: string[];
      classCount?: number;
    };
  }): SOLIDViolation {
    return {
      principle: this.principle,
      severity: params.severity,
      file: params.file,
      line: params.line,
      column: undefined,
      class: params.class,
      method: params.method,
      description: params.description,
      explanation: params.explanation,
      impact: params.impact,
      suggestion: params.suggestion,
      metrics: params.metrics,
    };
  }

  /**
   * Prüft ob eine Datei TypeScript oder JavaScript ist
   */
  protected isTypeScriptFile(filePath: string): boolean {
    return filePath.endsWith('.ts') || filePath.endsWith('.tsx');
  }

  /**
   * Prüft ob eine Datei JavaScript ist
   */
  protected isJavaScriptFile(filePath: string): boolean {
    return filePath.endsWith('.js') || filePath.endsWith('.jsx');
  }

  /**
   * Analysiert Import-Statements für Concern-Detection
   */
  protected analyzeImportConcerns(imports: string[]): string[] {
    const concerns = new Set<string>();

    imports.forEach(imp => {
      const lowerImp = imp.toLowerCase();

      // Database concerns
      if (
        this.matchesPattern(lowerImp, [
          'database',
          'db',
          'sql',
          'mongo',
          'redis',
          'orm',
          'prisma',
          'sequelize',
          'typeorm',
        ])
      ) {
        concerns.add('database');
      }

      // HTTP/Network concerns
      if (
        this.matchesPattern(lowerImp, [
          'http',
          'axios',
          'fetch',
          'request',
          'api',
          'rest',
          'graphql',
          'socket',
        ])
      ) {
        concerns.add('http');
      }

      // Filesystem concerns
      if (
        this.matchesPattern(lowerImp, [
          'file',
          'fs',
          'path',
          'upload',
          'download',
          'stream',
        ])
      ) {
        concerns.add('filesystem');
      }

      // Email concerns
      if (
        this.matchesPattern(lowerImp, [
          'email',
          'mail',
          'smtp',
          'sendgrid',
          'nodemailer',
        ])
      ) {
        concerns.add('email');
      }

      // Validation concerns
      if (
        this.matchesPattern(lowerImp, [
          'validation',
          'validator',
          'joi',
          'yup',
          'ajv',
          'zod',
        ])
      ) {
        concerns.add('validation');
      }

      // UI concerns
      if (
        this.matchesPattern(lowerImp, [
          'react',
          'vue',
          'angular',
          'component',
          'ui',
          'dom',
          'jsx',
          'tsx',
        ])
      ) {
        concerns.add('ui');
      }

      // Authentication concerns
      if (
        this.matchesPattern(lowerImp, [
          'auth',
          'jwt',
          'passport',
          'session',
          'oauth',
          'bcrypt',
        ])
      ) {
        concerns.add('authentication');
      }

      // Logging concerns
      if (
        this.matchesPattern(lowerImp, [
          'log',
          'winston',
          'pino',
          'console',
          'debug',
        ])
      ) {
        concerns.add('logging');
      }
    });

    return Array.from(concerns);
  }

  /**
   * Hilfsmethode für Pattern-Matching in Import-Strings
   */
  private matchesPattern(text: string, patterns: string[]): boolean {
    return patterns.some(pattern => text.includes(pattern));
  }
}
