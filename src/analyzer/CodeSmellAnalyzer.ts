/**
 * WOARU Code Smell Analyzer Module
 * Production-Ready implementation with comprehensive security and error handling
 */

import * as fs from 'fs-extra';
import { CodeSmellFinding } from '../types/code-smell';
import { APP_CONFIG } from '../config/constants';
import { t, initializeI18n } from '../config/i18n';

/**
 * Type definition for function metadata
 */
interface FunctionMetadata {
  name: string;
  body: string;
  line: number;
  column: number;
  parameters: string[];
  startIndex: number;
  endIndex: number;
}

/**
 * Type definition for analysis context
 */
interface AnalysisContext {
  filePath: string;
  language: string;
  content: string;
  contentLength: number;
  isSecure: boolean;
}

/**
 * Sanitizes file path to prevent information leakage
 * @param filePath - The file path to sanitize
 * @returns Sanitized file path safe for display
 */
function sanitizeFilePath(filePath: unknown): string {
  if (typeof filePath !== 'string') {
    return 'unknown-file';
  }

  // Remove sensitive parts and limit length
  const baseName = filePath.split(/[/\\]/).pop() || 'unknown-file';
  return (
    baseName.replace(/[^a-zA-Z0-9._-]/g, '').substring(0, 50) || 'unknown-file'
  );
}

/**
 * Sanitizes function names to prevent injection attacks
 * @param functionName - The function name to sanitize
 * @returns Sanitized function name safe for display
 */
function sanitizeFunctionName(functionName: unknown): string {
  if (typeof functionName !== 'string') {
    return 'anonymous';
  }

  // Remove dangerous characters and limit length
  return (
    functionName.replace(/[^a-zA-Z0-9_$]/g, '').substring(0, 100) || 'anonymous'
  );
}

/**
 * Validates code content for security
 * @param content - Code content to validate
 * @returns True if content appears safe to analyze
 */
function isSecureContent(content: string): boolean {
  // Check for excessive size
  if (content.length > 1000000) {
    // 1MB limit
    return false;
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script[^>]*>/i,
    /eval\s*\(/,
    /Function\s*\(/,
    /setTimeout\s*\([^)]*['"].*['"][^)]*\)/,
    /setInterval\s*\([^)]*['"].*['"][^)]*\)/,
  ];

  return !suspiciousPatterns.some(pattern => pattern.test(content));
}

/**
 * Type guard for language validation
 * @param language - Language to validate
 * @returns True if language is supported
 */
function isSupportedLanguage(language: unknown): language is string {
  const supportedLanguages = ['javascript', 'typescript', 'js', 'ts'];
  return (
    typeof language === 'string' &&
    supportedLanguages.includes(language.toLowerCase())
  );
}

export class CodeSmellAnalyzer {
  private readonly complexityThreshold =
    APP_CONFIG.QUALITY.COMPLEXITY_THRESHOLD;
  private readonly functionLengthThreshold =
    APP_CONFIG.QUALITY.FUNCTION_LENGTH_THRESHOLD;
  private readonly parameterCountThreshold =
    APP_CONFIG.QUALITY.PARAMETER_COUNT_THRESHOLD;
  private readonly nestingDepthThreshold =
    APP_CONFIG.QUALITY.NESTING_DEPTH_THRESHOLD;

  // Security limits
  private readonly MAX_FILE_SIZE = 1000000; // 1MB
  private readonly MAX_ANALYSIS_TIME = 30000; // 30 seconds
  private readonly MAX_FINDINGS_PER_FILE = 1000;

  /**
   * Analysis performance metrics
   */
  private analysisMetrics = {
    filesAnalyzed: 0,
    totalFindings: 0,
    averageAnalysisTime: 0,
    securityIssues: 0,
  };

  /**
   * Analyze file for code smells with comprehensive security validation
   * @param filePath - Path to the file to analyze
   * @param language - Programming language of the file
   * @returns Promise<CodeSmellFinding[]> Array of code smell findings
   */
  async analyzeFile(
    filePath: string,
    language: string
  ): Promise<CodeSmellFinding[]> {
    const startTime = Date.now();

    try {
      await initializeI18n();

      // Validate inputs
      if (!this.validateInputs(filePath, language)) {
        return [];
      }

      const sanitizedPath = sanitizeFilePath(filePath);

      // Security check: validate file path
      if (!(await this.isSecureFilePath(filePath))) {
        console.warn(`Skipping potentially unsafe file: ${sanitizedPath}`);
        return [];
      }

      const content = await this.readFileSecurely(filePath);
      if (!content) {
        return [];
      }

      const context: AnalysisContext = {
        filePath: sanitizedPath,
        language: language.toLowerCase(),
        content,
        contentLength: content.length,
        isSecure: isSecureContent(content),
      };

      if (!context.isSecure) {
        console.warn(`Skipping file with suspicious content: ${sanitizedPath}`);
        this.analysisMetrics.securityIssues++;
        return [];
      }

      const findings = await this.performAnalysisWithTimeout(context);

      // Update metrics
      this.analysisMetrics.filesAnalyzed++;
      this.analysisMetrics.totalFindings += findings.length;
      this.analysisMetrics.averageAnalysisTime =
        (this.analysisMetrics.averageAnalysisTime + (Date.now() - startTime)) /
        2;

      return findings.slice(0, this.MAX_FINDINGS_PER_FILE);
    } catch (error) {
      const sanitizedPath = sanitizeFilePath(filePath);
      const sanitizedError = this.sanitizeError(error);
      console.error(
        t('code_smell_analyzer.error_analyzing_file', {
          filePath: sanitizedPath,
        }),
        sanitizedError
      );
      return [];
    }
  }

  /**
   * Input validation for analyze file method
   */
  private validateInputs(filePath: unknown, language: unknown): boolean {
    if (typeof filePath !== 'string' || filePath.length === 0) {
      console.debug('Invalid file path provided');
      return false;
    }

    if (!isSupportedLanguage(language)) {
      console.debug(`Unsupported language: ${language}`);
      return false;
    }

    return true;
  }

  /**
   * Security validation for file paths
   */
  private async isSecureFilePath(filePath: string): Promise<boolean> {
    try {
      // Normalize path to prevent directory traversal
      const pathModule = await import('path');
      const normalizedPath = pathModule.normalize(filePath);

      // Check for suspicious patterns
      if (
        normalizedPath.includes('..') ||
        normalizedPath.includes('\x00') ||
        normalizedPath.length > 500
      ) {
        return false;
      }

      // Check if file exists and is readable
      const stats = await fs.stat(normalizedPath);
      if (!stats.isFile() || stats.size > this.MAX_FILE_SIZE) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Secure file reading with size limits
   */
  private async readFileSecurely(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      if (content.length > this.MAX_FILE_SIZE) {
        console.warn(`File too large: ${sanitizeFilePath(filePath)}`);
        return null;
      }

      return content;
    } catch (error) {
      console.debug(`Failed to read file: ${this.sanitizeError(error)}`);
      return null;
    }
  }

  /**
   * Perform analysis with timeout protection
   */
  private async performAnalysisWithTimeout(
    context: AnalysisContext
  ): Promise<CodeSmellFinding[]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Analysis timeout'));
      }, this.MAX_ANALYSIS_TIME);

      try {
        const findings = this.analyzeContent(context);
        clearTimeout(timeout);
        resolve(findings);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Main analysis method for JavaScript/TypeScript content
   */
  private analyzeContent(context: AnalysisContext): CodeSmellFinding[] {
    const findings: CodeSmellFinding[] = [];
    const lines = context.content.split('\n');

    if (lines.length > 10000) {
      console.warn(`File too large for detailed analysis: ${context.filePath}`);
      return [];
    }

    try {
      // Basic pattern-based analysis with error isolation
      findings.push(...this.checkVarKeyword(lines));
      findings.push(...this.checkWeakEquality(lines));
      findings.push(...this.checkConsoleLog(lines));
      findings.push(...this.checkMagicNumbers(lines));

      // More sophisticated analysis with error isolation
      findings.push(...this.analyzeComplexity(context.content));
      findings.push(...this.analyzeFunctionLength(context.content));
      findings.push(...this.analyzeParameterCount(context.content));
      findings.push(...this.analyzeNestingDepth(context.content));
    } catch (error) {
      console.debug(`Analysis error: ${this.sanitizeError(error)}`);
    }

    return findings;
  }

  /**
   * Sanitize error messages for security
   */
  private sanitizeError(error: unknown): string {
    if (typeof error === 'string') {
      return error.replace(/\/[^\s]*\/[^\s]*/g, '[PATH]').substring(0, 200);
    }

    if (error instanceof Error) {
      return this.sanitizeError(error.message);
    }

    return 'Unknown analysis error';
  }

  /**
   * Check for var keyword usage with security validation
   */
  private checkVarKeyword(lines: string[]): CodeSmellFinding[] {
    const findings: CodeSmellFinding[] = [];

    try {
      lines.forEach((line, index) => {
        if (typeof line !== 'string') return;

        const trimmedLine = line.trim();
        if (trimmedLine.length > 1000) return; // Skip excessively long lines

        // Match var declarations but avoid false positives in comments
        const varMatch = line.match(/(?:^|\s|;)(var\s+\w+)/);
        if (
          varMatch &&
          !trimmedLine.startsWith('//') &&
          !trimmedLine.startsWith('*') &&
          !trimmedLine.includes('/*')
        ) {
          const column = Math.max(1, line.indexOf(varMatch[1]) + 1);
          findings.push({
            type: 'var-keyword',
            message: t('code_smell_analyzer.var_keyword_message'),
            severity: 'warning',
            line: index + 1,
            column,
            rule: APP_CONFIG.ESLINT_RULES.NO_VAR,
            suggestion: t('code_smell_analyzer.var_keyword_suggestion'),
          });
        }
      });
    } catch (error) {
      console.debug(`Error in checkVarKeyword: ${this.sanitizeError(error)}`);
    }

    return findings;
  }

  /**
   * Check for weak equality operators with security validation
   */
  private checkWeakEquality(lines: string[]): CodeSmellFinding[] {
    const findings: CodeSmellFinding[] = [];

    try {
      lines.forEach((line, index) => {
        if (typeof line !== 'string') return;

        const trimmedLine = line.trim();
        if (trimmedLine.length > 1000) return;
        if (
          trimmedLine.startsWith('//') ||
          trimmedLine.startsWith('*') ||
          trimmedLine.includes('/*')
        )
          return;

        // Check for == and != (but not === or !==)
        const weakEqualityMatch = line.match(/(^|[^!=])([!=]=)(?!=)/);
        if (weakEqualityMatch) {
          const column = Math.max(1, line.indexOf(weakEqualityMatch[2]) + 1);
          const operator = weakEqualityMatch[2];
          const strictOperator = operator === '==' ? '===' : '!==';

          findings.push({
            type: 'weak-equality',
            message: t('code_smell_analyzer.weak_equality_message', {
              strictOperator,
              operator,
            }),
            severity: 'warning',
            line: index + 1,
            column,
            rule: APP_CONFIG.ESLINT_RULES.EQEQEQ,
            suggestion: t('code_smell_analyzer.weak_equality_suggestion', {
              operator,
              strictOperator,
            }),
          });
        }
      });
    } catch (error) {
      console.debug(`Error in checkWeakEquality: ${this.sanitizeError(error)}`);
    }

    return findings;
  }

  /**
   * Check for console statements with security validation
   */
  private checkConsoleLog(lines: string[]): CodeSmellFinding[] {
    const findings: CodeSmellFinding[] = [];

    try {
      lines.forEach((line, index) => {
        if (typeof line !== 'string') return;

        const trimmedLine = line.trim();
        if (trimmedLine.length > 1000) return;
        if (
          trimmedLine.startsWith('//') ||
          trimmedLine.startsWith('*') ||
          trimmedLine.includes('/*')
        )
          return;

        const consoleMatch = line.match(/console\.(log|warn|error|info|debug)/);
        if (consoleMatch) {
          const column = Math.max(1, line.indexOf(consoleMatch[0]) + 1);
          findings.push({
            type: 'console-log',
            message: t('code_smell_analyzer.console_log_message'),
            severity: 'warning',
            line: index + 1,
            column,
            rule: 'no-console',
            suggestion: t('code_smell_analyzer.console_log_suggestion'),
          });
        }
      });
    } catch (error) {
      console.debug(`Error in checkConsoleLog: ${this.sanitizeError(error)}`);
    }

    return findings;
  }

  /**
   * Check for magic numbers with security validation
   */
  private checkMagicNumbers(lines: string[]): CodeSmellFinding[] {
    const findings: CodeSmellFinding[] = [];

    try {
      lines.forEach((line, index) => {
        if (typeof line !== 'string') return;

        const trimmedLine = line.trim();
        if (trimmedLine.length > 1000) return;
        if (
          trimmedLine.startsWith('//') ||
          trimmedLine.startsWith('*') ||
          trimmedLine.includes('/*')
        )
          return;

        // Look for magic numbers (not 0, 1, -1, or numbers in obvious contexts)
        const magicNumberMatch = line.match(
          /(?:[^.\w]|^)([2-9]\d+|\d{3,})(?![.\w])/
        );
        if (
          magicNumberMatch &&
          !line.includes('line') &&
          !line.includes('port') &&
          !line.includes('timeout') &&
          !line.includes('version') &&
          !line.includes('http')
        ) {
          const sanitizedNumber = magicNumberMatch[1].substring(0, 20); // Limit length
          const column = Math.max(1, line.indexOf(magicNumberMatch[1]) + 1);

          findings.push({
            type: 'magic-number',
            message: t('code_smell_analyzer.magic_number_message', {
              number: sanitizedNumber,
            }),
            severity: 'info',
            line: index + 1,
            column,
            rule: 'no-magic-numbers',
            suggestion: t('code_smell_analyzer.magic_number_suggestion'),
          });
        }
      });
    } catch (error) {
      console.debug(`Error in checkMagicNumbers: ${this.sanitizeError(error)}`);
    }

    return findings;
  }

  /**
   * Analyze cyclomatic complexity with security validation
   */
  private analyzeComplexity(content: string): CodeSmellFinding[] {
    const findings: CodeSmellFinding[] = [];

    try {
      const functions = this.extractFunctions(content);
      if (functions.length > 100) {
        console.warn(
          'Too many functions detected, limiting complexity analysis'
        );
        return [];
      }

      functions.forEach(func => {
        try {
          const sanitizedFunctionName = sanitizeFunctionName(func.name);
          const complexity = this.calculateCyclomaticComplexity(func.body);

          if (complexity > this.complexityThreshold && complexity < 1000) {
            // Sanity check
            findings.push({
              type: 'complexity',
              message: t('code_smell_analyzer.high_complexity_message', {
                functionName: sanitizedFunctionName,
                complexity: complexity.toString(),
              }),
              severity:
                complexity > APP_CONFIG.QUALITY_THRESHOLDS.COMPLEXITY_WARNING
                  ? 'error'
                  : 'warning',
              line: Math.max(1, func.line),
              column: Math.max(1, func.column),
              rule: 'complexity',
              suggestion: t('code_smell_analyzer.break_down_functions'),
            });
          }
        } catch (funcError) {
          console.debug(
            `Error analyzing function complexity: ${this.sanitizeError(funcError)}`
          );
        }
      });
    } catch (error) {
      console.debug(`Error in analyzeComplexity: ${this.sanitizeError(error)}`);
    }

    return findings;
  }

  /**
   * Analyze function length with security validation
   */
  private analyzeFunctionLength(content: string): CodeSmellFinding[] {
    const findings: CodeSmellFinding[] = [];

    try {
      const functions = this.extractFunctions(content);
      if (functions.length > 100) {
        console.warn('Too many functions detected, limiting length analysis');
        return [];
      }

      functions.forEach(func => {
        try {
          const sanitizedFunctionName = sanitizeFunctionName(func.name);
          const lines = func.body.split('\n');
          const length = lines.length;

          if (length > this.functionLengthThreshold && length < 10000) {
            // Sanity check
            findings.push({
              type: 'function-length',
              message: t('code_smell_analyzer.long_function_message', {
                functionName: sanitizedFunctionName,
                length: length.toString(),
              }),
              severity: 'warning',
              line: Math.max(1, func.line),
              column: Math.max(1, func.column),
              rule: 'max-lines-per-function',
              suggestion: t('code_smell_analyzer.break_down_functions'),
            });
          }
        } catch (funcError) {
          console.debug(
            `Error analyzing function length: ${this.sanitizeError(funcError)}`
          );
        }
      });
    } catch (error) {
      console.debug(
        `Error in analyzeFunctionLength: ${this.sanitizeError(error)}`
      );
    }

    return findings;
  }

  /**
   * Analyze parameter count with security validation
   */
  private analyzeParameterCount(content: string): CodeSmellFinding[] {
    const findings: CodeSmellFinding[] = [];

    try {
      const functions = this.extractFunctions(content);
      if (functions.length > 100) {
        console.warn(
          'Too many functions detected, limiting parameter analysis'
        );
        return [];
      }

      functions.forEach(func => {
        try {
          const sanitizedFunctionName = sanitizeFunctionName(func.name);
          const paramCount = Array.isArray(func.parameters)
            ? func.parameters.length
            : 0;

          if (paramCount > this.parameterCountThreshold && paramCount < 100) {
            // Sanity check
            findings.push({
              type: 'parameter-count',
              message: t('code_smell_analyzer.too_many_parameters_message', {
                functionName: sanitizedFunctionName,
                paramCount: paramCount.toString(),
              }),
              severity: 'warning',
              line: Math.max(1, func.line),
              column: Math.max(1, func.column),
              rule: 'max-params',
              suggestion: t('code_smell_analyzer.use_options_object'),
            });
          }
        } catch (funcError) {
          console.debug(
            `Error analyzing parameter count: ${this.sanitizeError(funcError)}`
          );
        }
      });
    } catch (error) {
      console.debug(
        `Error in analyzeParameterCount: ${this.sanitizeError(error)}`
      );
    }

    return findings;
  }

  /**
   * Analyze nesting depth with security validation
   */
  private analyzeNestingDepth(content: string): CodeSmellFinding[] {
    const findings: CodeSmellFinding[] = [];

    try {
      const lines = content.split('\n');
      if (lines.length > 10000) {
        console.warn('File too large for nesting depth analysis');
        return [];
      }

      let currentDepth = 0;
      let maxDepth = 0;
      let maxDepthLine = 0;

      lines.forEach((line, index) => {
        if (typeof line !== 'string' || line.length > 1000) return;

        const trimmedLine = line.trim();
        if (
          trimmedLine.startsWith('//') ||
          trimmedLine.startsWith('*') ||
          trimmedLine.includes('/*')
        )
          return;

        try {
          // Count opening braces
          const openBraces = (line.match(/\{/g) || []).length;
          const closeBraces = (line.match(/\}/g) || []).length;

          currentDepth += openBraces - closeBraces;

          // Sanity check for depth
          if (currentDepth < 0) currentDepth = 0;
          if (currentDepth > 50) return; // Skip if unreasonably deep

          if (currentDepth > maxDepth) {
            maxDepth = currentDepth;
            maxDepthLine = index + 1;
          }
        } catch (lineError) {
          console.debug(
            `Error processing line ${index}: ${this.sanitizeError(lineError)}`
          );
        }
      });

      if (maxDepth > this.nestingDepthThreshold && maxDepth < 50) {
        findings.push({
          type: 'nested-depth',
          message: t('code_smell_analyzer.excessive_nesting_message', {
            maxDepth: maxDepth.toString(),
          }),
          severity: 'warning',
          line: Math.max(1, maxDepthLine),
          column: 1,
          rule: 'max-depth',
          suggestion: t('code_smell_analyzer.extract_nested_logic'),
        });
      }
    } catch (error) {
      console.debug(
        `Error in analyzeNestingDepth: ${this.sanitizeError(error)}`
      );
    }

    return findings;
  }

  /**
   * Extract functions with security validation and enhanced parsing
   */
  private extractFunctions(content: string): FunctionMetadata[] {
    const functions: FunctionMetadata[] = [];

    try {
      if (content.length > this.MAX_FILE_SIZE) {
        console.warn('Content too large for function extraction');
        return [];
      }

      const lines = content.split('\n');
      if (lines.length > 10000) {
        console.warn('Too many lines for function extraction');
        return [];
      }

      // Enhanced regex for function detection with security considerations
      const functionRegex =
        /(?:function\s+(\w+)\s*\(([^)]*)\)|(\w+)\s*[:=]\s*(?:function\s*)?\(([^)]*)\)\s*=>?|(\w+)\s*\(([^)]*)\)\s*\{)/g;

      lines.forEach((line, index) => {
        if (typeof line !== 'string' || line.length > 1000) return;

        try {
          let match;
          const originalRegex = new RegExp(functionRegex);

          while (
            (match = originalRegex.exec(line)) !== null &&
            functions.length < 100
          ) {
            const rawFunctionName =
              match[1] || match[3] || match[5] || 'anonymous';
            const functionName = sanitizeFunctionName(rawFunctionName);

            const rawParams = match[2] || match[4] || match[6] || '';
            const params = this.parseParameters(rawParams);

            // Extract function body with security validation
            const functionBody = this.extractFunctionBody(content, index);
            if (!functionBody || functionBody.length > 50000) continue;

            functions.push({
              name: functionName,
              body: functionBody,
              line: index + 1,
              column: Math.max(1, (match.index || 0) + 1),
              parameters: params,
              startIndex: index,
              endIndex: index + functionBody.split('\n').length,
            });

            // Prevent infinite loops
            if (match.index === originalRegex.lastIndex) {
              originalRegex.lastIndex++;
            }
          }
        } catch (lineError) {
          console.debug(
            `Error extracting functions from line ${index}: ${this.sanitizeError(lineError)}`
          );
        }
      });
    } catch (error) {
      console.debug(`Error in extractFunctions: ${this.sanitizeError(error)}`);
    }

    return functions;
  }

  /**
   * Parse function parameters with security validation
   */
  private parseParameters(rawParams: string): string[] {
    try {
      if (typeof rawParams !== 'string' || rawParams.length > 500) {
        return [];
      }

      return rawParams
        .split(',')
        .map(p =>
          p
            .trim()
            .replace(/[^a-zA-Z0-9_$]/g, '')
            .substring(0, 50)
        )
        .filter(p => p.length > 0)
        .slice(0, 20); // Limit to 20 parameters
    } catch (error) {
      console.debug(`Error parsing parameters: ${this.sanitizeError(error)}`);
      return [];
    }
  }

  /**
   * Extract function body with security validation and limits
   */
  private extractFunctionBody(content: string, startLine: number): string {
    try {
      const lines = content.split('\n');
      if (startLine < 0 || startLine >= lines.length) {
        return '';
      }

      let braceCount = 0;
      const bodyLines: string[] = [];
      let foundStart = false;
      const maxLines = 1000; // Limit function body size

      for (
        let i = startLine;
        i < Math.min(lines.length, startLine + maxLines);
        i++
      ) {
        const line = lines[i];
        if (typeof line !== 'string') continue;

        if (!foundStart) {
          if (line.includes('{')) {
            foundStart = true;
          }
        }

        if (foundStart) {
          bodyLines.push(line);

          try {
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;

            // Safety check for malformed code
            if (braceCount < 0) braceCount = 0;
            if (braceCount > 50) break; // Unreasonably deep nesting

            if (braceCount === 0) {
              break;
            }
          } catch (braceError) {
            console.debug(
              `Error counting braces: ${this.sanitizeError(braceError)}`
            );
            break;
          }
        }

        // Prevent excessive memory usage
        if (bodyLines.length > maxLines) {
          break;
        }
      }

      return bodyLines.join('\n');
    } catch (error) {
      console.debug(
        `Error extracting function body: ${this.sanitizeError(error)}`
      );
      return '';
    }
  }

  /**
   * Calculate cyclomatic complexity with security validation
   */
  private calculateCyclomaticComplexity(functionBody: string): number {
    try {
      if (typeof functionBody !== 'string' || functionBody.length > 50000) {
        return 1; // Return base complexity for invalid input
      }

      let complexity = APP_CONFIG.QUALITY_THRESHOLDS.BASE_COMPLEXITY;

      // Count decision points with safety limits
      const decisionPoints = [
        /\bif\b/g,
        /\belse\b/g,
        /\bwhile\b/g,
        /\bfor\b/g,
        /\bswitch\b/g,
        /\bcase\b/g,
        /\bcatch\b/g,
        /\b&&\b/g,
        /\b\|\|\b/g,
        /\?\s*.*\s*:/g, // Ternary operator
      ];

      decisionPoints.forEach(pattern => {
        try {
          const matches = functionBody.match(pattern);
          if (matches && matches.length < 1000) {
            // Sanity check
            complexity += matches.length;
          }
        } catch (patternError) {
          console.debug(
            `Error matching pattern: ${this.sanitizeError(patternError)}`
          );
        }
      });

      // Cap complexity at reasonable limit
      return Math.min(complexity, 999);
    } catch (error) {
      console.debug(
        `Error calculating complexity: ${this.sanitizeError(error)}`
      );
      return 1;
    }
  }

  /**
   * Get analysis performance metrics
   */
  public getAnalysisMetrics() {
    return { ...this.analysisMetrics };
  }

  /**
   * Reset analysis metrics
   */
  public resetMetrics(): void {
    this.analysisMetrics = {
      filesAnalyzed: 0,
      totalFindings: 0,
      averageAnalysisTime: 0,
      securityIssues: 0,
    };
  }
}
