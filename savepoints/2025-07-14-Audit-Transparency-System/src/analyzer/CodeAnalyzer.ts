import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import { CodeSmellAnalyzer } from './CodeSmellAnalyzer';
import { CodeSmellFinding } from '../types/code-smell';

export interface CodeInsight {
  reason: string;
  evidence: string[];
  files: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  patterns?: string[];
}

export class CodeAnalyzer {
  private codeSmellAnalyzer: CodeSmellAnalyzer;

  constructor() {
    this.codeSmellAnalyzer = new CodeSmellAnalyzer();
  }

  async analyzeCodebase(
    projectPath: string,
    language: string
  ): Promise<Map<string, CodeInsight>> {
    const insights = new Map<string, CodeInsight>();

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

    return insights;
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
          reason:
            'Inkonsistente Code-Formatierung gefunden. Unterschiedliche Einrückungen und Stile in mehreren Dateien.',
          evidence: formattingIssues,
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
          reason:
            'Komplexe JavaScript-Dateien ohne Typdefinitionen gefunden. TypeScript würde die Wartbarkeit verbessern.',
          evidence: complexFiles.map(
            f => `${f}: Komplexe Funktionen ohne Typen`
          ),
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
        reason:
          'Debug-Statements (console.log) im Code gefunden. ESLint kann diese automatisch erkennen.',
        evidence: debugStatements,
        files: debugStatements.map(f => f.split(':')[0]),
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
        .sort(([,a], [,b]) => b.length - a.length)
        .slice(0, 3)
        .map(([type, findings]) => `${type}: ${findings.length} occurrences`);

      const criticalCount = codeSmellFindings.filter(f => f.severity === 'error').length;
      const warningCount = codeSmellFindings.filter(f => f.severity === 'warning').length;

      insights.set('code-smells', {
        reason: `WOARU Internal Analysis found ${codeSmellFindings.length} code quality issues (${criticalCount} critical, ${warningCount} warnings)`,
        evidence: topIssues,
        files: [...new Set(codeSmellFindings.map(f => f.file))],
        severity: criticalCount > 0 ? 'high' : 'medium',
        patterns: Object.keys(groupedFindings)
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
        reason:
          'Keine Tests gefunden bei über 5 Source-Dateien. Testing Framework würde Code-Qualität sichern.',
        evidence: [`${sourceFiles.length} Source-Dateien ohne Tests`],
        files: [],
        severity: 'high',
      });
    }

    // Check for Git commits without hooks
    const hasGit = await fs.pathExists(path.join(projectPath, '.git'));
    const hasHusky = await fs.pathExists(path.join(projectPath, '.husky'));

    if (hasGit && !hasHusky && jsFiles.length > 3) {
      insights.set('husky', {
        reason:
          'Git-Repository ohne Pre-Commit Hooks. Code-Qualität wird nicht vor Commits geprüft.',
        evidence: ['Kein .husky Verzeichnis gefunden', 'Git-Repository aktiv'],
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
          reason:
            'PEP8 Style-Verletzungen gefunden. Black formatiert automatisch nach Python-Standards.',
          evidence: styleIssues,
          files: styleIssues.map(f => f.split(':')[0]),
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
          reason:
            'Funktionen ohne Type Hints gefunden. Mypy kann Typ-Fehler zur Entwicklungszeit finden.',
          evidence: missingTypes,
          files: missingTypes.map(f => f.split(':')[0]),
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
          reason:
            'Print-Statements im Code gefunden. Ruff kann diese und andere Code-Smells erkennen.',
          evidence: printStatements,
          files: printStatements.map(f => f.split(':')[0]),
          severity: 'low',
        });
      }
    }
  }

  private async analyzeCSharpProject(
    projectPath: string,
    insights: Map<string, CodeInsight>
  ): Promise<void> {
    const csFiles = await glob('**/*.cs', {
      cwd: projectPath,
      ignore: ['bin/**', 'obj/**'],
    });

    if (csFiles.length > 0) {
      // Check for missing .editorconfig
      const hasEditorConfig = await fs.pathExists(
        path.join(projectPath, '.editorconfig')
      );
      if (!hasEditorConfig) {
        insights.set('editorconfig', {
          reason:
            'Keine .editorconfig gefunden. Team-weite Code-Style Konsistenz fehlt.',
          evidence: [
            `${csFiles.length} C# Dateien ohne einheitliche Style-Konfiguration`,
          ],
          files: [],
          severity: 'medium',
        });
      }

      // Check for async issues
      const asyncIssues = await this.checkCSharpAsyncPatterns(
        projectPath,
        csFiles
      );
      if (asyncIssues.length > 0) {
        insights.set('sonaranalyzer', {
          reason:
            'Potenzielle async/await Probleme gefunden. SonarAnalyzer kann diese automatisch erkennen.',
          evidence: asyncIssues,
          files: asyncIssues.map(f => f.split(':')[0]),
          severity: 'high',
        });
      }
    }
  }

  private async checkFormattingConsistency(
    projectPath: string,
    files: string[]
  ): Promise<string[]> {
    const issues: string[] = [];
    const indentations = new Set<string>();

    for (const file of files.slice(0, 10)) {
      // Check first 10 files
      try {
        const content = await fs.readFile(
          path.join(projectPath, file),
          'utf-8'
        );
        const lines = content.split('\n');

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
        'Inkonsistente Einrückung: ' + Array.from(indentations).join(', ')
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
        const language = ['.ts', '.tsx'].includes(ext) ? 'typescript' : 'javascript';
        
        const findings = await this.codeSmellAnalyzer.analyzeFile(filePath, language);
        
        // Add file path to each finding
        findings.forEach(finding => {
          allFindings.push({
            ...finding,
            file
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
    return findings.reduce((acc, finding) => {
      if (!acc[finding.type]) {
        acc[finding.type] = [];
      }
      acc[finding.type].push(finding);
      return acc;
    }, {} as Record<string, Array<CodeSmellFinding & { file: string }>>);
  }
}
