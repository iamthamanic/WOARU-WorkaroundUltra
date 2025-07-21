import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import { CodeSmellAnalyzer } from './CodeSmellAnalyzer';
import { CodeSmellFinding } from '../types/code-smell';
import { t, initializeI18n } from '../config/i18n';

/**
 * Security constants for code analysis validation
 */
const SECURITY_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_FILES_ANALYZED: 1000,
  MAX_PATH_LENGTH: 500,
  MAX_ANALYSIS_TIME: 120000, // 2 minutes
  MAX_INSIGHTS_PER_TYPE: 50,
} as const;

/**
 * Sanitizes file paths to prevent information leakage
 * @param filePath - The file path to sanitize
 * @returns Sanitized file path safe for display
 */
function sanitizeFilePath(filePath: unknown): string {
  if (typeof filePath !== 'string') {
    return 'unknown-file';
  }

  const baseName = path.basename(filePath);
  return (
    baseName.replace(/[^a-zA-Z0-9._-]/g, '').substring(0, 100) || 'unknown-file'
  );
}

/**
 * Sanitizes project paths to prevent directory traversal
 * @param projectPath - The project path to sanitize
 * @returns Sanitized project path safe for processing
 */
function sanitizeProjectPath(projectPath: unknown): string {
  if (typeof projectPath !== 'string') {
    return process.cwd();
  }

  const normalized = path.normalize(projectPath);

  // Check for directory traversal
  if (normalized.includes('..') || normalized.includes('\x00')) {
    return process.cwd();
  }

  if (normalized.length > SECURITY_LIMITS.MAX_PATH_LENGTH) {
    return process.cwd();
  }

  return normalized;
}

/**
 * Sanitizes error messages to prevent information leakage
 * @param error - The error to sanitize
 * @returns Sanitized error message safe for display
 */
function sanitizeError(error: unknown): string {
  if (typeof error === 'string') {
    return error.replace(/\/[^\s]*\/[^\s]*/g, '[PATH]').substring(0, 200);
  }

  if (error instanceof Error) {
    return sanitizeError(error.message);
  }

  return 'Unknown analysis error';
}

export interface CodeInsight {
  reason: string;
  evidence: string[];
  files: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  patterns?: string[];
}

export class CodeAnalyzer {
  private codeSmellAnalyzer: CodeSmellAnalyzer;
  private analysisMetrics = {
    filesAnalyzed: 0,
    insightsGenerated: 0,
    securityIssuesFound: 0,
    averageAnalysisTime: 0,
  };

  constructor() {
    this.codeSmellAnalyzer = new CodeSmellAnalyzer();
  }

  /**
   * Analyze codebase with comprehensive security validation
   * @param projectPath - Path to the project to analyze
   * @param language - Programming language of the project
   * @returns Promise<Map<string, CodeInsight>> Map of analysis insights
   */
  async analyzeCodebase(
    projectPath: string,
    language: string
  ): Promise<Map<string, CodeInsight>> {
    const startTime = Date.now();

    try {
      await initializeI18n();

      // Validate inputs
      const safePath = sanitizeProjectPath(projectPath);
      if (!this.validateLanguage(language)) {
        console.warn(
          t('code_analyzer.unsupported_language', {
            language: String(language),
          })
        );
        return new Map();
      }

      const insights = new Map<string, CodeInsight>();

      // Add timeout protection
      const analysisPromise = this.performAnalysisWithTimeout(
        safePath,
        language,
        insights
      );
      await analysisPromise;

      // Update metrics
      this.updateAnalysisMetrics(insights, Date.now() - startTime);

      return insights;
    } catch (error) {
      console.error(t('code_analyzer.analysis_error'), sanitizeError(error));
      return new Map();
    }
  }

  /**
   * Validate programming language
   */
  private validateLanguage(language: unknown): boolean {
    if (typeof language !== 'string') {
      return false;
    }

    const supportedLanguages = ['JavaScript', 'TypeScript', 'Python', 'C#'];
    return supportedLanguages.includes(language);
  }

  /**
   * Perform analysis with timeout protection
   */
  private async performAnalysisWithTimeout(
    projectPath: string,
    language: string,
    insights: Map<string, CodeInsight>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Code analysis timeout'));
      }, SECURITY_LIMITS.MAX_ANALYSIS_TIME);

      this.performAnalysis(projectPath, language, insights)
        .then(() => {
          clearTimeout(timeout);
          resolve();
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Main analysis method
   */
  private async performAnalysis(
    projectPath: string,
    language: string,
    insights: Map<string, CodeInsight>
  ): Promise<void> {
    switch (language) {
      case 'JavaScript':
      case 'TypeScript':
        await this.analyzeJavaScriptProject(projectPath, insights);
        break;
      case 'Python':
        await this.analyzePythonProject(projectPath, insights);
        break;
      case 'C#':
        await this.analyzeCSharpProject(projectPath, insights);
        break;
    }
  }

  /**
   * Update analysis performance metrics
   */
  private updateAnalysisMetrics(
    insights: Map<string, CodeInsight>,
    duration: number
  ): void {
    this.analysisMetrics.filesAnalyzed++;
    this.analysisMetrics.insightsGenerated += insights.size;
    this.analysisMetrics.averageAnalysisTime =
      (this.analysisMetrics.averageAnalysisTime + duration) / 2;
  }

  private async analyzeJavaScriptProject(
    projectPath: string,
    insights: Map<string, CodeInsight>
  ): Promise<void> {
    // Check for inconsistent code formatting
    const jsFiles = await glob('**/*.{js,jsx,ts,tsx}', {
      cwd: projectPath,
      ignore: ['node_modules/**', 'dist/**', 'build/**'],
    });

    if (jsFiles.length > 0) {
      const formattingIssues = await this.checkFormattingConsistency(
        projectPath,
        jsFiles
      );
      if (formattingIssues.length > 0) {
        insights.set('prettier', {
          reason: t('code_analyzer.formatting_inconsistent'),
          evidence: formattingIssues.map(issue => sanitizeFilePath(issue)),
          files: formattingIssues.map(f => f.split(':')[0]),
          severity: 'medium',
        });
      }
    }

    // Check for missing type definitions
    const hasTypeScript = await fs.pathExists(
      path.join(projectPath, 'tsconfig.json')
    );
    if (!hasTypeScript) {
      const complexFiles = await this.findComplexJavaScriptFiles(
        projectPath,
        jsFiles
      );
      if (complexFiles.length > 0) {
        insights.set('typescript', {
          reason: t('code_analyzer.typescript_missing'),
          evidence: complexFiles
            .map(f =>
              t('code_analyzer.complex_file_without_types', {
                file: sanitizeFilePath(f),
              })
            )
            .slice(0, SECURITY_LIMITS.MAX_INSIGHTS_PER_TYPE),
          files: complexFiles,
          severity: 'high',
        });
      }
    }

    // Check for console.log statements
    const debugStatements = await this.findDebugStatements(
      projectPath,
      jsFiles
    );
    if (debugStatements.length > 0) {
      insights.set('eslint', {
        reason: t('code_analyzer.debug_statements_found'),
        evidence: debugStatements
          .map(stmt => sanitizeFilePath(stmt))
          .slice(0, SECURITY_LIMITS.MAX_INSIGHTS_PER_TYPE),
        files: debugStatements.map(f => sanitizeFilePath(f.split(':')[0])),
        severity: 'medium',
      });
    }

    // Run comprehensive code smell analysis
    const codeSmellFindings = await this.runCodeSmellAnalysis(
      projectPath,
      jsFiles
    );
    if (codeSmellFindings.length > 0) {
      const groupedFindings = this.groupCodeSmellFindings(codeSmellFindings);

      // Add WOARU Code Smell Analysis insight
      const topIssues = Object.entries(groupedFindings)
        .sort(([, a], [, b]) => b.length - a.length)
        .slice(0, 3)
        .map(([type, findings]) => `${type}: ${findings.length} occurrences`);

      const criticalCount = codeSmellFindings.filter(
        f => f.severity === 'error'
      ).length;
      const warningCount = codeSmellFindings.filter(
        f => f.severity === 'warning'
      ).length;

      insights.set('code-smells', {
        reason: t('code_analyzer.woaru_analysis_found', {
          total: codeSmellFindings.length,
          critical: criticalCount,
          warnings: warningCount,
        }),
        evidence: topIssues.slice(0, SECURITY_LIMITS.MAX_INSIGHTS_PER_TYPE),
        files: [...new Set(codeSmellFindings.map(f => f.file))],
        severity: criticalCount > 0 ? 'high' : 'medium',
        patterns: Object.keys(groupedFindings),
      });
    }

    // Check for missing tests
    const testFiles = jsFiles.filter(
      f => f.includes('.test.') || f.includes('.spec.')
    );
    const sourceFiles = jsFiles.filter(
      f => !f.includes('.test.') && !f.includes('.spec.')
    );

    if (sourceFiles.length > 5 && testFiles.length === 0) {
      insights.set('jest', {
        reason: t('code_analyzer.no_tests_found'),
        evidence: [
          t('code_analyzer.source_files_without_tests', {
            count: sourceFiles.length,
          }),
        ],
        files: [],
        severity: 'high',
      });
    }

    // Check for Git commits without hooks
    const hasGit = await fs.pathExists(path.join(projectPath, '.git'));
    const hasHusky = await fs.pathExists(path.join(projectPath, '.husky'));

    if (hasGit && !hasHusky && jsFiles.length > 3) {
      insights.set('husky', {
        reason: t('code_analyzer.git_without_hooks'),
        evidence: [
          t('code_analyzer.no_husky_directory'),
          t('code_analyzer.git_repository_active'),
        ],
        files: [],
        severity: 'medium',
      });
    }
  }

  private async analyzePythonProject(
    projectPath: string,
    insights: Map<string, CodeInsight>
  ): Promise<void> {
    const pyFiles = await glob('**/*.py', {
      cwd: projectPath,
      ignore: ['venv/**', '__pycache__/**', '.venv/**'],
    });

    if (pyFiles.length > 0) {
      // Check for PEP8 violations
      const styleIssues = await this.checkPythonStyle(projectPath, pyFiles);
      if (styleIssues.length > 0) {
        insights.set('black', {
          reason: t('code_analyzer.pep8_violations'),
          evidence: styleIssues
            .map(issue => sanitizeFilePath(issue))
            .slice(0, SECURITY_LIMITS.MAX_INSIGHTS_PER_TYPE),
          files: styleIssues.map(f => sanitizeFilePath(f.split(':')[0])),
          severity: 'medium',
        });
      }

      // Check for missing type hints
      const missingTypes = await this.checkPythonTypeHints(
        projectPath,
        pyFiles
      );
      if (missingTypes.length > 0) {
        insights.set('mypy', {
          reason: t('code_analyzer.missing_type_hints'),
          evidence: missingTypes
            .map(type => sanitizeFilePath(type))
            .slice(0, SECURITY_LIMITS.MAX_INSIGHTS_PER_TYPE),
          files: missingTypes.map(f => sanitizeFilePath(f.split(':')[0])),
          severity: 'medium',
        });
      }

      // Check for print statements
      const printStatements = await this.findPrintStatements(
        projectPath,
        pyFiles
      );
      if (printStatements.length > 0) {
        insights.set('ruff', {
          reason: t('code_analyzer.print_statements_found'),
          evidence: printStatements
            .map(stmt => sanitizeFilePath(stmt))
            .slice(0, SECURITY_LIMITS.MAX_INSIGHTS_PER_TYPE),
          files: printStatements.map(f => sanitizeFilePath(f.split(':')[0])),
          severity: 'low',
        });
      }
    }
  }

  /**
   * Analyze C# project with security validation
   */
  private async analyzeCSharpProject(
    projectPath: string,
    insights: Map<string, CodeInsight>
  ): Promise<void> {
    try {
      const csFiles = await glob('**/*.cs', {
        cwd: projectPath,
        ignore: ['bin/**', 'obj/**'],
      }).catch(() => []);

      // Limit number of files analyzed
      const limitedFiles = csFiles.slice(0, SECURITY_LIMITS.MAX_FILES_ANALYZED);

      if (limitedFiles.length > 0) {
        // Check for missing .editorconfig
        const hasEditorConfig = await fs.pathExists(
          path.join(projectPath, '.editorconfig')
        );
        if (!hasEditorConfig) {
          insights.set('editorconfig', {
            reason: t('code_analyzer.no_editorconfig'),
            evidence: [
              t('code_analyzer.csharp_files_no_style', {
                count: limitedFiles.length,
              }),
            ],
            files: [],
            severity: 'medium',
          });
        }

        // Check for async issues
        const asyncIssues = await this.checkCSharpAsyncPatterns(
          projectPath,
          limitedFiles
        );
        if (asyncIssues.length > 0) {
          insights.set('sonaranalyzer', {
            reason: t('code_analyzer.async_issues_found'),
            evidence: asyncIssues
              .map(issue => sanitizeFilePath(issue))
              .slice(0, SECURITY_LIMITS.MAX_INSIGHTS_PER_TYPE),
            files: asyncIssues.map(f => sanitizeFilePath(f.split(':')[0])),
            severity: 'high',
          });
        }
      }
    } catch (error) {
      console.error(
        t('code_analyzer.csharp_analysis_error'),
        sanitizeError(error)
      );
    }
  }

  /**
   * Get analysis metrics
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
      insightsGenerated: 0,
      securityIssuesFound: 0,
      averageAnalysisTime: 0,
    };
  }

  /**
   * Check formatting consistency with security validation
   */
  private async checkFormattingConsistency(
    projectPath: string,
    files: string[]
  ): Promise<string[]> {
    const issues: string[] = [];
    const indentations = new Set<string>();

    // Limit files analyzed for security
    const limitedFiles = files.slice(
      0,
      Math.min(10, SECURITY_LIMITS.MAX_FILES_ANALYZED)
    );

    for (const file of limitedFiles) {
      try {
        const filePath = path.join(projectPath, file);

        // Check file size before reading
        const stats = await fs.stat(filePath).catch(() => null);
        if (!stats || stats.size > SECURITY_LIMITS.MAX_FILE_SIZE) {
          continue;
        }

        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').slice(0, 100); // Limit lines analyzed

        // Check indentation style
        for (const line of lines) {
          const match = line.match(/^(\s+)/);
          if (match) {
            if (match[1].includes('\t')) {
              indentations.add('tabs');
            } else if (match[1].length % 2 === 0) {
              indentations.add('spaces-2');
            } else if (match[1].length % 4 === 0) {
              indentations.add('spaces-4');
            }
          }
        }

        // Check for trailing spaces
        lines.forEach((line, index) => {
          if (line.endsWith(' ') || line.endsWith('\t')) {
            issues.push(`${file}:${index + 1}: Trailing whitespace`);
          }
        });
      } catch {
        // Skip files that can't be read
      }
    }

    if (indentations.size > 1) {
      issues.push(
        t('code_analyzer.inconsistent_indentation', {
          styles: Array.from(indentations).join(', '),
        })
      );
    }

    return issues;
  }

  private async findComplexJavaScriptFiles(
    projectPath: string,
    files: string[]
  ): Promise<string[]> {
    const complexFiles: string[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(
          path.join(projectPath, file),
          'utf-8'
        );

        // Simple complexity check: functions with many parameters or deep nesting
        const functionMatches =
          content.match(/function\s*\w*\s*\([^)]*\)/g) || [];
        const arrowMatches = content.match(/\([^)]*\)\s*=>/g) || [];

        for (const match of [...functionMatches, ...arrowMatches]) {
          const params = match.match(/\((.*?)\)/)?.[1] || '';
          const paramCount = params.split(',').filter(p => p.trim()).length;

          if (paramCount > 3) {
            complexFiles.push(file);
            break;
          }
        }

        // Check for deeply nested code (more than 4 levels)
        const nestingLevel = this.checkNestingLevel(content);
        if (nestingLevel > 4) {
          complexFiles.push(file);
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return [...new Set(complexFiles)];
  }

  private checkNestingLevel(content: string): number {
    let maxLevel = 0;
    let currentLevel = 0;

    for (const char of content) {
      if (char === '{') {
        currentLevel++;
        maxLevel = Math.max(maxLevel, currentLevel);
      } else if (char === '}') {
        currentLevel--;
      }
    }

    return maxLevel;
  }

  private async findDebugStatements(
    projectPath: string,
    files: string[]
  ): Promise<string[]> {
    const statements: string[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(
          path.join(projectPath, file),
          'utf-8'
        );
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          if (
            line.includes('console.log') ||
            line.includes('console.error') ||
            line.includes('debugger')
          ) {
            statements.push(`${file}:${index + 1}: ${line.trim()}`);
          }
        });
      } catch {
        // Skip files that can't be read
      }
    }

    return statements;
  }

  private async checkPythonStyle(
    projectPath: string,
    files: string[]
  ): Promise<string[]> {
    const issues: string[] = [];

    for (const file of files.slice(0, 10)) {
      try {
        const content = await fs.readFile(
          path.join(projectPath, file),
          'utf-8'
        );
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          // Check line length
          if (line.length > 79) {
            issues.push(
              `${file}:${index + 1}: Zeile zu lang (${line.length} > 79)`
            );
          }

          // Check for tabs
          if (line.includes('\t')) {
            issues.push(`${file}:${index + 1}: Tabs statt Spaces`);
          }
        });
      } catch {
        // Skip files that can't be read
      }
    }

    return issues;
  }

  private async checkPythonTypeHints(
    projectPath: string,
    files: string[]
  ): Promise<string[]> {
    const issues: string[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(
          path.join(projectPath, file),
          'utf-8'
        );

        // Simple check for function definitions without type hints
        const functionDefs = content.match(/def\s+\w+\s*\([^)]*\):/g) || [];

        for (const def of functionDefs) {
          if (!def.includes('->') && !def.includes(':')) {
            issues.push(`${file}: Funktion ohne Return Type Hint`);
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return issues;
  }

  private async findPrintStatements(
    projectPath: string,
    files: string[]
  ): Promise<string[]> {
    const statements: string[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(
          path.join(projectPath, file),
          'utf-8'
        );
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          if (line.match(/print\s*\(/)) {
            statements.push(`${file}:${index + 1}: ${line.trim()}`);
          }
        });
      } catch {
        // Skip files that can't be read
      }
    }

    return statements;
  }

  private async checkCSharpAsyncPatterns(
    projectPath: string,
    files: string[]
  ): Promise<string[]> {
    const issues: string[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(
          path.join(projectPath, file),
          'utf-8'
        );

        // Check for async void (bad practice except for event handlers)
        if (content.match(/async\s+void\s+\w+\s*\(/)) {
          issues.push(
            `${file}: async void Methode gefunden (sollte Task zurückgeben)`
          );
        }

        // Check for .Result or .Wait() (can cause deadlocks)
        if (content.match(/\.\s*(Result|Wait)\s*\(/)) {
          issues.push(`${file}: .Result oder .Wait() kann zu Deadlocks führen`);
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return issues;
  }

  /**
   * Run code smell analysis on JavaScript/TypeScript files
   */
  private async runCodeSmellAnalysis(
    projectPath: string,
    files: string[]
  ): Promise<Array<CodeSmellFinding & { file: string }>> {
    const allFindings: Array<CodeSmellFinding & { file: string }> = [];

    for (const file of files) {
      try {
        const filePath = path.join(projectPath, file);
        const ext = path.extname(file).toLowerCase();
        const language = ['.ts', '.tsx'].includes(ext)
          ? 'typescript'
          : 'javascript';

        const findings = await this.codeSmellAnalyzer.analyzeFile(
          filePath,
          language
        );

        // Add file path to each finding
        findings.forEach(finding => {
          allFindings.push({
            ...finding,
            file,
          });
        });
      } catch (error) {
        console.warn(`Code smell analysis failed for ${file}:`, error);
      }
    }

    return allFindings;
  }

  /**
   * Group code smell findings by type
   */
  private groupCodeSmellFindings(
    findings: Array<CodeSmellFinding & { file: string }>
  ): Record<string, Array<CodeSmellFinding & { file: string }>> {
    return findings.reduce(
      (acc, finding) => {
        if (!acc[finding.type]) {
          acc[finding.type] = [];
        }
        acc[finding.type].push(finding);
        return acc;
      },
      {} as Record<string, Array<CodeSmellFinding & { file: string }>>
    );
  }
}
