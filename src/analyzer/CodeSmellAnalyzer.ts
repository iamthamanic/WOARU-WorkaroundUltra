import * as fs from 'fs-extra';
import {
  CodeSmellFinding,
  CodeSmellType,
  ComplexityMetric,
  CodeMetrics,
} from '../types/code-smell';
import { APP_CONFIG } from '../config/constants';

export class CodeSmellAnalyzer {
  private readonly complexityThreshold =
    APP_CONFIG.QUALITY.COMPLEXITY_THRESHOLD;
  private readonly functionLengthThreshold =
    APP_CONFIG.QUALITY.FUNCTION_LENGTH_THRESHOLD;
  private readonly parameterCountThreshold =
    APP_CONFIG.QUALITY.PARAMETER_COUNT_THRESHOLD;
  private readonly nestingDepthThreshold =
    APP_CONFIG.QUALITY.NESTING_DEPTH_THRESHOLD;

  async analyzeFile(
    filePath: string,
    language: string
  ): Promise<CodeSmellFinding[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const findings: CodeSmellFinding[] = [];

      if (language === 'javascript' || language === 'typescript') {
        findings.push(...this.analyzeJavaScript(content));
      }

      return findings;
    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
      return [];
    }
  }

  private analyzeJavaScript(content: string): CodeSmellFinding[] {
    const findings: CodeSmellFinding[] = [];
    const lines = content.split('\n');

    // Basic pattern-based analysis
    findings.push(...this.checkVarKeyword(lines));
    findings.push(...this.checkWeakEquality(lines));
    findings.push(...this.checkConsoleLog(lines));
    findings.push(...this.checkMagicNumbers(lines));

    // More sophisticated analysis
    findings.push(...this.analyzeComplexity(content));
    findings.push(...this.analyzeFunctionLength(content));
    findings.push(...this.analyzeParameterCount(content));
    findings.push(...this.analyzeNestingDepth(content));

    return findings;
  }

  private checkVarKeyword(lines: string[]): CodeSmellFinding[] {
    const findings: CodeSmellFinding[] = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Match var declarations but avoid false positives in comments
      const varMatch = line.match(/(?:^|\s|;)(var\s+\w+)/);
      if (
        varMatch &&
        !trimmedLine.startsWith('//') &&
        !trimmedLine.startsWith('*')
      ) {
        const column = line.indexOf(varMatch[1]) + 1;
        findings.push({
          type: 'var-keyword',
          message: 'Use "let" or "const" instead of "var" for better scoping',
          severity: 'warning',
          line: index + 1,
          column,
          rule: APP_CONFIG.ESLINT_RULES.NO_VAR,
          suggestion: 'Replace "var" with "let" or "const"',
        });
      }
    });

    return findings;
  }

  private checkWeakEquality(lines: string[]): CodeSmellFinding[] {
    const findings: CodeSmellFinding[] = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) return;

      // Check for == and != (but not === or !==)
      const weakEqualityMatch = line.match(/(^|[^!=])([!=]=)(?!=)/);
      if (weakEqualityMatch) {
        const column = line.indexOf(weakEqualityMatch[2]) + 1;
        const operator = weakEqualityMatch[2];
        const strictOperator = operator === '==' ? '===' : '!==';

        findings.push({
          type: 'weak-equality',
          message: `Use strict equality "${strictOperator}" instead of "${operator}"`,
          severity: 'warning',
          line: index + 1,
          column,
          rule: APP_CONFIG.ESLINT_RULES.EQEQEQ,
          suggestion: `Replace "${operator}" with "${strictOperator}"`,
        });
      }
    });

    return findings;
  }

  private checkConsoleLog(lines: string[]): CodeSmellFinding[] {
    const findings: CodeSmellFinding[] = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) return;

      const consoleMatch = line.match(/console\.(log|warn|error|info|debug)/);
      if (consoleMatch) {
        const column = line.indexOf(consoleMatch[0]) + 1;
        findings.push({
          type: 'console-log',
          message: 'Remove console statements before production',
          severity: 'warning',
          line: index + 1,
          column,
          rule: 'no-console',
          suggestion: 'Remove or replace with proper logging',
        });
      }
    });

    return findings;
  }

  private checkMagicNumbers(lines: string[]): CodeSmellFinding[] {
    const findings: CodeSmellFinding[] = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) return;

      // Look for magic numbers (not 0, 1, -1, or numbers in obvious contexts)
      const magicNumberMatch = line.match(
        /(?:[^.\w]|^)([2-9]\d+|\d{3,})(?![.\w])/
      );
      if (
        magicNumberMatch &&
        !line.includes('line') &&
        !line.includes('port') &&
        !line.includes('timeout')
      ) {
        const column = line.indexOf(magicNumberMatch[1]) + 1;
        findings.push({
          type: 'magic-number',
          message: `Magic number "${magicNumberMatch[1]}" should be extracted to a named constant`,
          severity: 'info',
          line: index + 1,
          column,
          rule: 'no-magic-numbers',
          suggestion: 'Extract to a named constant',
        });
      }
    });

    return findings;
  }

  private analyzeComplexity(content: string): CodeSmellFinding[] {
    const findings: CodeSmellFinding[] = [];
    const functions = this.extractFunctions(content);

    functions.forEach(func => {
      const complexity = this.calculateCyclomaticComplexity(func.body);
      if (complexity > this.complexityThreshold) {
        findings.push({
          type: 'complexity',
          message: `Function "${func.name}" has high cyclomatic complexity (${complexity}). Consider breaking it down.`,
          severity:
            complexity > APP_CONFIG.QUALITY_THRESHOLDS.COMPLEXITY_WARNING
              ? 'error'
              : 'warning',
          line: func.line,
          column: func.column,
          rule: 'complexity',
          suggestion: 'Break down into smaller functions',
        });
      }
    });

    return findings;
  }

  private analyzeFunctionLength(content: string): CodeSmellFinding[] {
    const findings: CodeSmellFinding[] = [];
    const functions = this.extractFunctions(content);

    functions.forEach(func => {
      const length = func.body.split('\n').length;
      if (length > this.functionLengthThreshold) {
        findings.push({
          type: 'function-length',
          message: `Function "${func.name}" is too long (${length} lines). Consider breaking it down.`,
          severity: 'warning',
          line: func.line,
          column: func.column,
          rule: 'max-lines-per-function',
          suggestion: 'Break down into smaller functions',
        });
      }
    });

    return findings;
  }

  private analyzeParameterCount(content: string): CodeSmellFinding[] {
    const findings: CodeSmellFinding[] = [];
    const functions = this.extractFunctions(content);

    functions.forEach(func => {
      const paramCount = func.parameters.length;
      if (paramCount > this.parameterCountThreshold) {
        findings.push({
          type: 'parameter-count',
          message: `Function "${func.name}" has too many parameters (${paramCount}). Consider using an options object.`,
          severity: 'warning',
          line: func.line,
          column: func.column,
          rule: 'max-params',
          suggestion: 'Use an options object or break down the function',
        });
      }
    });

    return findings;
  }

  private analyzeNestingDepth(content: string): CodeSmellFinding[] {
    const findings: CodeSmellFinding[] = [];
    const lines = content.split('\n');

    let currentDepth = 0;
    let maxDepth = 0;
    let maxDepthLine = 0;

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) return;

      // Count opening braces
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;

      currentDepth += openBraces - closeBraces;

      if (currentDepth > maxDepth) {
        maxDepth = currentDepth;
        maxDepthLine = index + 1;
      }
    });

    if (maxDepth > this.nestingDepthThreshold) {
      findings.push({
        type: 'nested-depth',
        message: `Excessive nesting depth (${maxDepth} levels). Consider refactoring.`,
        severity: 'warning',
        line: maxDepthLine,
        column: 1,
        rule: 'max-depth',
        suggestion: 'Extract nested logic into separate functions',
      });
    }

    return findings;
  }

  private extractFunctions(content: string): Array<{
    name: string;
    body: string;
    line: number;
    column: number;
    parameters: string[];
  }> {
    const functions: Array<{
      name: string;
      body: string;
      line: number;
      column: number;
      parameters: string[];
    }> = [];

    const lines = content.split('\n');

    // Simple regex-based function extraction
    const functionRegex =
      /(?:function\s+(\w+)\s*\(([^)]*)\)|(\w+)\s*[:=]\s*(?:function\s*)?\(([^)]*)\)\s*=>?|(\w+)\s*\(([^)]*)\)\s*\{)/g;

    lines.forEach((line, index) => {
      let match;
      while ((match = functionRegex.exec(line)) !== null) {
        const functionName = match[1] || match[3] || match[5] || 'anonymous';
        const params = (match[2] || match[4] || match[6] || '')
          .split(',')
          .map(p => p.trim())
          .filter(p => p.length > 0);

        // Extract function body (simplified)
        const functionBody = this.extractFunctionBody(content, index);

        functions.push({
          name: functionName,
          body: functionBody,
          line: index + 1,
          column: match.index! + 1,
          parameters: params,
        });
      }
    });

    return functions;
  }

  private extractFunctionBody(content: string, startLine: number): string {
    const lines = content.split('\n');
    let braceCount = 0;
    const bodyLines: string[] = [];
    let foundStart = false;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];

      if (!foundStart) {
        if (line.includes('{')) {
          foundStart = true;
        }
      }

      if (foundStart) {
        bodyLines.push(line);
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;

        if (braceCount === 0) {
          break;
        }
      }
    }

    return bodyLines.join('\n');
  }

  private calculateCyclomaticComplexity(functionBody: string): number {
    let complexity = APP_CONFIG.QUALITY_THRESHOLDS.BASE_COMPLEXITY; // Base complexity

    // Count decision points
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
      const matches = functionBody.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });

    return complexity;
  }
}
