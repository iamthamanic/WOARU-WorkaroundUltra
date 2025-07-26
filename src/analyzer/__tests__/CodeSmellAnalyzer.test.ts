import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import * as fs from 'fs-extra';
import { CodeSmellAnalyzer } from '../CodeSmellAnalyzer';
import { APP_CONFIG } from '../../config/constants';

// Mock dependencies
jest.mock('fs-extra');
jest.mock('../../config/constants', () => ({
  APP_CONFIG: {
    QUALITY: {
      COMPLEXITY_THRESHOLD: 10,
      FUNCTION_LENGTH_THRESHOLD: 50,
      PARAMETER_COUNT_THRESHOLD: 5,
      NESTING_DEPTH_THRESHOLD: 4
    },
    QUALITY_THRESHOLDS: {
      BASE_COMPLEXITY: 1,
      COMPLEXITY_WARNING: 15
    },
    ESLINT_RULES: {
      NO_VAR: 'no-var',
      EQEQEQ: 'eqeqeq'
    }
  }
}));

jest.mock('../../config/i18n', () => ({
  t: jest.fn((key: string, params?: any) => {
    const translations: Record<string, string> = {
      'code_smell_analyzer.error_analyzing_file': 'Error analyzing file {{filePath}}:',
      'code_smell_analyzer.var_keyword_message': 'Use "let" or "const" instead of "var" for better scoping',
      'code_smell_analyzer.var_keyword_suggestion': 'Replace "var" with "let" or "const"',
      'code_smell_analyzer.weak_equality_message': 'Use strict equality "{{strictOperator}}" instead of "{{operator}}"',
      'code_smell_analyzer.weak_equality_suggestion': 'Replace "{{operator}}" with "{{strictOperator}}"',
      'code_smell_analyzer.console_log_message': 'Remove console statements before production',
      'code_smell_analyzer.console_log_suggestion': 'Remove or replace with proper logging',
      'code_smell_analyzer.magic_number_message': 'Magic number "{{number}}" should be extracted to a named constant',
      'code_smell_analyzer.magic_number_suggestion': 'Extract to a named constant',
      'code_smell_analyzer.high_complexity_message': 'Function "{{functionName}}" has high cyclomatic complexity ({{complexity}}). Consider breaking it down.',
      'code_smell_analyzer.break_down_functions': 'Break down into smaller functions',
      'code_smell_analyzer.long_function_message': 'Function "{{functionName}}" is too long ({{length}} lines). Consider breaking it down.',
      'code_smell_analyzer.too_many_parameters_message': 'Function "{{functionName}}" has too many parameters ({{paramCount}}). Consider using an options object.',
      'code_smell_analyzer.use_options_object': 'Use an options object or break down the function',
      'code_smell_analyzer.excessive_nesting_message': 'Excessive nesting depth ({{maxDepth}} levels). Consider refactoring.',
      'code_smell_analyzer.extract_nested_logic': 'Extract nested logic into separate functions'
    };
    
    let result = translations[key] || key;
    
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        result = result.replace(`{{${paramKey}}}`, String(value));
      });
    }
    
    return result;
  }),
  initializeI18n: jest.fn(),
}));

const mockedFs = fs as jest.Mocked<typeof fs>;
import { t, initializeI18n } from '../../config/i18n';

describe('CodeSmellAnalyzer - Production Quality Tests', () => {
  let analyzer: CodeSmellAnalyzer;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    // Setup console spies
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock returns
    initializeI18n.mockResolvedValue(undefined);
    mockedFs.stat.mockResolvedValue({ isFile: () => true, size: 1000 } as any);
    mockedFs.readFile.mockResolvedValue('test content');
    
    analyzer = new CodeSmellAnalyzer();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  describe('File Analysis', () => {
    it('should analyze valid JavaScript file successfully', async () => {
      // Arrange
      const jsContent = `
        var x = 5;
        function test() {
          console.log('test');
          return x;
        }
      `;
      mockedFs.readFile.mockResolvedValue(jsContent);

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(initializeI18n).toHaveBeenCalled();
    });

    it('should analyze valid TypeScript file successfully', async () => {
      // Arrange
      const tsContent = `
        let x: number = 5;
        function test(): number {
          return x;
        }
      `;
      mockedFs.readFile.mockResolvedValue(tsContent);

      // Act
      const result = await analyzer.analyzeFile('/test/file.ts', 'typescript');

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should reject unsupported languages', async () => {
      // Act
      const result = await analyzer.analyzeFile('/test/file.py', 'python');

      // Assert
      expect(result).toEqual([]);
      expect(mockedFs.readFile).not.toHaveBeenCalled();
    });

    it('should handle invalid file paths', async () => {
      // Act
      const result = await analyzer.analyzeFile('', 'javascript');

      // Assert
      expect(result).toEqual([]);
      expect(mockedFs.readFile).not.toHaveBeenCalled();
    });

    it('should handle file reading errors gracefully', async () => {
      // Arrange
      mockedFs.readFile.mockRejectedValue(new Error('File not found'));

      // Act
      const result = await analyzer.analyzeFile('/test/nonexistent.js', 'javascript');

      // Assert
      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should reject files that are too large', async () => {
      // Arrange
      mockedFs.stat.mockResolvedValue({ isFile: () => true, size: 2000000 } as any); // 2MB

      // Act
      const result = await analyzer.analyzeFile('/test/large.js', 'javascript');

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle suspicious file paths securely', async () => {
      // Arrange
      const maliciousPaths = [
        '../../../etc/passwd',
        '/test/file.js\x00.txt',
        'a'.repeat(1000),
        'file.js; rm -rf /'
      ];

      for (const path of maliciousPaths) {
        // Act
        const result = await analyzer.analyzeFile(path, 'javascript');

        // Assert
        expect(result).toEqual([]);
      }
    });
  });

  describe('Var Keyword Detection', () => {
    it('should detect var keyword usage', async () => {
      // Arrange
      const content = 'var x = 5;\nvar y = 10;';
      mockedFs.readFile.mockResolvedValue(content);

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert
      const varFindings = result.filter(f => f.type === 'var-keyword');
      expect(varFindings).toHaveLength(2);
      expect(varFindings[0].message).toContain('let" or "const"');
    });

    it('should ignore var in comments', async () => {
      // Arrange
      const content = '// var x = 5;\n/* var y = 10; */\nlet z = 15;';
      mockedFs.readFile.mockResolvedValue(content);

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert
      const varFindings = result.filter(f => f.type === 'var-keyword');
      expect(varFindings).toHaveLength(0);
    });

    it('should handle malformed var declarations', async () => {
      // Arrange
      const content = 'var'.repeat(1000); // Excessive repetition
      mockedFs.readFile.mockResolvedValue(content);

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert - Should not crash
      expect(result).toBeDefined();
    });
  });

  describe('Weak Equality Detection', () => {
    it('should detect weak equality operators', async () => {
      // Arrange
      const content = 'if (x == 5) { }\nif (y != null) { }';
      mockedFs.readFile.mockResolvedValue(content);

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert
      const equalityFindings = result.filter(f => f.type === 'weak-equality');
      expect(equalityFindings).toHaveLength(2);
      expect(equalityFindings[0].message).toContain('strict equality');
    });

    it('should not flag strict equality operators', async () => {
      // Arrange
      const content = 'if (x === 5) { }\nif (y !== null) { }';
      mockedFs.readFile.mockResolvedValue(content);

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert
      const equalityFindings = result.filter(f => f.type === 'weak-equality');
      expect(equalityFindings).toHaveLength(0);
    });
  });

  describe('Console Statement Detection', () => {
    it('should detect console statements', async () => {
      // Arrange
      const content = 'console.log("test");\nconsole.error("error");\nconsole.warn("warning");';
      mockedFs.readFile.mockResolvedValue(content);

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert
      const consoleFindings = result.filter(f => f.type === 'console-log');
      expect(consoleFindings).toHaveLength(3);
      expect(consoleFindings[0].message).toContain('Remove console statements');
    });

    it('should ignore console statements in comments', async () => {
      // Arrange
      const content = '// console.log("test");\n/* console.error("error"); */';
      mockedFs.readFile.mockResolvedValue(content);

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert
      const consoleFindings = result.filter(f => f.type === 'console-log');
      expect(consoleFindings).toHaveLength(0);
    });
  });

  describe('Magic Number Detection', () => {
    it('should detect magic numbers', async () => {
      // Arrange
      const content = 'const x = 42;\nconst y = 1000;\nconst z = 999;';
      mockedFs.readFile.mockResolvedValue(content);

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert
      const magicFindings = result.filter(f => f.type === 'magic-number');
      expect(magicFindings.length).toBeGreaterThan(0);
      expect(magicFindings[0].message).toContain('named constant');
    });

    it('should ignore numbers in obvious contexts', async () => {
      // Arrange
      const content = 'const port = 3000;\nconst timeout = 5000;\nconst lineNumber = 42;';
      mockedFs.readFile.mockResolvedValue(content);

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert
      const magicFindings = result.filter(f => f.type === 'magic-number');
      expect(magicFindings).toHaveLength(0);
    });

    it('should handle extremely large numbers safely', async () => {
      // Arrange
      const content = `const x = ${'9'.repeat(1000)};`;
      mockedFs.readFile.mockResolvedValue(content);

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert - Should not crash
      expect(result).toBeDefined();
    });
  });

  describe('Complexity Analysis', () => {
    it('should detect high cyclomatic complexity', async () => {
      // Arrange
      const content = `
        function complex() {
          if (a) {
            if (b) {
              if (c) {
                if (d) {
                  if (e) {
                    if (f) {
                      while (g) {
                        for (let i = 0; i < 10; i++) {
                          switch (h) {
                            case 1:
                              return 1;
                            case 2:
                              return 2;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      mockedFs.readFile.mockResolvedValue(content);

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert
      const complexityFindings = result.filter(f => f.type === 'complexity');
      expect(complexityFindings.length).toBeGreaterThan(0);
      expect(complexityFindings[0].message).toContain('cyclomatic complexity');
    });

    it('should handle functions with reasonable complexity', async () => {
      // Arrange
      const content = `
        function simple() {
          if (x > 0) {
            return x;
          }
          return 0;
        }
      `;
      mockedFs.readFile.mockResolvedValue(content);

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert
      const complexityFindings = result.filter(f => f.type === 'complexity');
      expect(complexityFindings).toHaveLength(0);
    });
  });

  describe('Function Length Analysis', () => {
    it('should detect overly long functions', async () => {
      // Arrange
      const longFunction = `
        function longFunction() {
          ${Array(60).fill('console.log("line");').join('\n')}
        }
      `;
      mockedFs.readFile.mockResolvedValue(longFunction);

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert
      const lengthFindings = result.filter(f => f.type === 'function-length');
      expect(lengthFindings.length).toBeGreaterThan(0);
      expect(lengthFindings[0].message).toContain('too long');
    });
  });

  describe('Parameter Count Analysis', () => {
    it('should detect functions with too many parameters', async () => {
      // Arrange
      const content = 'function tooManyParams(a, b, c, d, e, f, g, h) { return a + b; }';
      mockedFs.readFile.mockResolvedValue(content);

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert
      const paramFindings = result.filter(f => f.type === 'parameter-count');
      expect(paramFindings.length).toBeGreaterThan(0);
      expect(paramFindings[0].message).toContain('too many parameters');
    });
  });

  describe('Nesting Depth Analysis', () => {
    it('should detect excessive nesting depth', async () => {
      // Arrange
      const content = `
        function nested() {
          if (a) {
            if (b) {
              if (c) {
                if (d) {
                  if (e) {
                    return true;
                  }
                }
              }
            }
          }
        }
      `;
      mockedFs.readFile.mockResolvedValue(content);

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert
      const nestingFindings = result.filter(f => f.type === 'nested-depth');
      expect(nestingFindings.length).toBeGreaterThan(0);
      expect(nestingFindings[0].message).toContain('nesting depth');
    });

    it('should handle malformed brace structures', async () => {
      // Arrange
      const content = '{ { { { { { { { { { { { { { { {';
      mockedFs.readFile.mockResolvedValue(content);

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert - Should not crash
      expect(result).toBeDefined();
    });
  });

  describe('Security Tests', () => {
    it('should handle malicious code content securely', async () => {
      // Arrange
      const maliciousContent = `
        <script>alert('xss')</script>
        eval('malicious code');
        Function('return process')()('exit')(0);
      `;
      mockedFs.readFile.mockResolvedValue(maliciousContent);

      // Act
      const result = await analyzer.analyzeFile('/test/malicious.js', 'javascript');

      // Assert
      expect(result).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('suspicious content')
      );
    });

    it('should sanitize function names properly', async () => {
      // Arrange
      const content = `
        function <script>alert('xss')</script>() { }
        function normal() { }
      `;
      mockedFs.readFile.mockResolvedValue(content);

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert
      expect(result).toBeDefined();
      // Should not contain dangerous characters in findings
      result.forEach(finding => {
        expect(finding.message).not.toContain('<script>');
      });
    });

    it('should handle timeout scenarios', async () => {
      // Arrange
      const hugeContent = 'var x = 1;\n'.repeat(100000);
      mockedFs.readFile.mockResolvedValue(hugeContent);

      // Act
      const result = await analyzer.analyzeFile('/test/huge.js', 'javascript');

      // Assert - Should complete without timeout error
      expect(result).toBeDefined();
    });

    it('should limit findings per file', async () => {
      // Arrange
      const repeatedContent = 'var x;\n'.repeat(2000);
      mockedFs.readFile.mockResolvedValue(repeatedContent);

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert
      expect(result.length).toBeLessThanOrEqual(1000); // MAX_FINDINGS_PER_FILE
    });

    it('should sanitize error messages', async () => {
      // Arrange
      mockedFs.readFile.mockRejectedValue(new Error('/sensitive/path/file.js not found'));

      // Act
      const result = await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Assert
      expect(result).toEqual([]);
      // Error should be sanitized in console output
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.stringContaining('/sensitive/path')
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty files', async () => {
      // Arrange
      mockedFs.readFile.mockResolvedValue('');

      // Act
      const result = await analyzer.analyzeFile('/test/empty.js', 'javascript');

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle files with only comments', async () => {
      // Arrange
      const content = '// This is a comment\n/* This is another comment */';
      mockedFs.readFile.mockResolvedValue(content);

      // Act
      const result = await analyzer.analyzeFile('/test/comments.js', 'javascript');

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle files with only whitespace', async () => {
      // Arrange
      const content = '   \n\t\n   \n';
      mockedFs.readFile.mockResolvedValue(content);

      // Act
      const result = await analyzer.analyzeFile('/test/whitespace.js', 'javascript');

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle binary files gracefully', async () => {
      // Arrange
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03]).toString();
      mockedFs.readFile.mockResolvedValue(binaryContent);

      // Act
      const result = await analyzer.analyzeFile('/test/binary.js', 'javascript');

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle non-string input types', async () => {
      // Act
      const results = await Promise.all([
        analyzer.analyzeFile(null as any, 'javascript'),
        analyzer.analyzeFile(undefined as any, 'javascript'),
        analyzer.analyzeFile(123 as any, 'javascript'),
        analyzer.analyzeFile('/test/file.js', null as any),
        analyzer.analyzeFile('/test/file.js', undefined as any),
      ]);

      // Assert
      results.forEach(result => {
        expect(result).toEqual([]);
      });
    });
  });

  describe('Performance Metrics', () => {
    it('should track analysis metrics', async () => {
      // Arrange
      const content = 'var x = 5;';
      mockedFs.readFile.mockResolvedValue(content);

      // Act
      await analyzer.analyzeFile('/test/file.js', 'javascript');
      const metrics = analyzer.getAnalysisMetrics();

      // Assert
      expect(metrics.filesAnalyzed).toBe(1);
      expect(metrics.totalFindings).toBeGreaterThanOrEqual(0);
      expect(metrics.averageAnalysisTime).toBeGreaterThanOrEqual(0);
    });

    it('should reset metrics correctly', async () => {
      // Arrange
      const content = 'var x = 5;';
      mockedFs.readFile.mockResolvedValue(content);
      await analyzer.analyzeFile('/test/file.js', 'javascript');

      // Act
      analyzer.resetMetrics();
      const metrics = analyzer.getAnalysisMetrics();

      // Assert
      expect(metrics.filesAnalyzed).toBe(0);
      expect(metrics.totalFindings).toBe(0);
      expect(metrics.averageAnalysisTime).toBe(0);
      expect(metrics.securityIssues).toBe(0);
    });
  });
});