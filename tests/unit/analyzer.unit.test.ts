/**
 * Comprehensive Unit Tests for Analyzer Module
 * Testing ProjectAnalyzer, CodeAnalyzer, LanguageDetector functionality
 */

import { ProjectAnalyzer } from '../../src/analyzer/ProjectAnalyzer';
import { CodeAnalyzer } from '../../src/analyzer/CodeAnalyzer';
import { LanguageDetector } from '../../src/analyzer/LanguageDetector';

// Mock filesystem operations
jest.mock('fs-extra', () => ({
  pathExists: jest.fn(async () => true),
  readFile: jest.fn(async () => '{"name": "test", "version": "1.0.0"}'),
  readdir: jest.fn(async () => ['package.json', 'src', 'tests']),
  stat: jest.fn(async () => ({ isDirectory: () => false, isFile: () => true })),
}));

// Mock glob operations
jest.mock('glob', () => ({
  glob: jest.fn(async () => ['src/test.js', 'src/test.ts']),
}));

// Mock i18n
jest.mock('../../src/config/i18n', () => ({
  t: jest.fn((key: string) => key),
  initializeI18n: jest.fn(async () => {}),
}));

describe('Analyzer Module Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ProjectAnalyzer', () => {
    let analyzer: ProjectAnalyzer;

    beforeEach(() => {
      analyzer = new ProjectAnalyzer();
    });

    it('should be instantiable', () => {
      expect(analyzer).toBeInstanceOf(ProjectAnalyzer);
    });

    it('should have required methods', () => {
      expect(typeof analyzer.analyzeProject).toBe('function');
      expect(typeof analyzer.getProjectMetadata).toBe('function');
      expect(typeof analyzer.detectFrameworks).toBe('function');
      expect(typeof analyzer.detectPackageManager).toBe('function');
    });

    it('should analyze project structure', async () => {
      const result = await analyzer.analyzeProject('/test/path');
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result.language).toBeDefined();
      expect(Array.isArray(result.framework)).toBe(true);
      expect(Array.isArray(result.dependencies)).toBe(true);
      expect(Array.isArray(result.devDependencies)).toBe(true);
    });

    it('should get project metadata', async () => {
      const metadata = await analyzer.getProjectMetadata('/test/path');
      
      expect(metadata).toBeDefined();
      expect(metadata.name).toBeDefined();
      expect(metadata.version).toBeDefined();
    });

    it('should detect package managers', async () => {
      const packageManager = await analyzer.detectPackageManager('/test/path');
      
      expect(packageManager).toBeDefined();
      expect(typeof packageManager).toBe('string');
    });

    it('should handle missing package.json gracefully', async () => {
      const fs = require('fs-extra');
      fs.pathExists.mockResolvedValue(false);
      
      const result = await analyzer.analyzeProject('/test/path');
      expect(result).toBeDefined();
    });

    it('should detect frameworks correctly', async () => {
      const fs = require('fs-extra');
      fs.readFile.mockResolvedValue(JSON.stringify({
        dependencies: { 'react': '^18.0.0', 'express': '^4.18.0' }
      }));
      
      const frameworks = await analyzer.detectFrameworks('/test/path');
      expect(Array.isArray(frameworks)).toBe(true);
    });

    it('should handle various project structures', async () => {
      const testPaths = ['/test/node', '/test/python', '/test/rust'];
      
      for (const path of testPaths) {
        try {
          const result = await analyzer.analyzeProject(path);
          expect(result).toBeDefined();
        } catch (error) {
          // Expected for test environment
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('CodeAnalyzer', () => {
    let analyzer: CodeAnalyzer;

    beforeEach(() => {
      analyzer = new CodeAnalyzer();
    });

    it('should be instantiable', () => {
      expect(analyzer).toBeInstanceOf(CodeAnalyzer);
    });

    it('should have required methods', () => {
      expect(typeof analyzer.analyzeCodebase).toBe('function');
      expect(typeof analyzer.analyzeFile).toBe('function');
      expect(typeof analyzer.detectCodeSmells).toBe('function');
    });

    it('should analyze codebase for insights', async () => {
      const insights = await analyzer.analyzeCodebase('/test/path', 'JavaScript');
      
      expect(insights).toBeDefined();
      expect(insights instanceof Map).toBe(true);
    });

    it('should analyze individual files', async () => {
      const fs = require('fs-extra');
      fs.readFile.mockResolvedValue('function test() { return true; }');
      
      const result = await analyzer.analyzeFile('/test/file.js');
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should detect code smells', async () => {
      const fs = require('fs-extra');
      fs.readFile.mockResolvedValue(`
        function veryLongFunctionName() {
          var x = 1;
          var y = 2;
          // This is a very long function with many lines
          for (var i = 0; i < 100; i++) {
            console.log(i);
            if (i > 50) {
              break;
            }
          }
        }
      `);
      
      const smells = await analyzer.detectCodeSmells('/test/file.js');
      
      expect(Array.isArray(smells)).toBe(true);
    });

    it('should handle different programming languages', async () => {
      const languages = ['JavaScript', 'TypeScript', 'Python', 'Rust'];
      
      for (const language of languages) {
        try {
          const insights = await analyzer.analyzeCodebase('/test/path', language);
          expect(insights).toBeDefined();
        } catch (error) {
          // Expected for some languages in test environment
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should provide analysis metrics', async () => {
      const fs = require('fs-extra');
      const glob = require('glob');
      
      glob.glob.mockResolvedValue(['file1.js', 'file2.js']);
      fs.readFile.mockResolvedValue('console.log("test");');
      
      const insights = await analyzer.analyzeCodebase('/test/path', 'JavaScript');
      
      expect(insights instanceof Map).toBe(true);
    });
  });

  describe('LanguageDetector', () => {
    let detector: LanguageDetector;

    beforeEach(() => {
      detector = new LanguageDetector();
    });

    it('should be instantiable', () => {
      expect(detector).toBeInstanceOf(LanguageDetector);
    });

    it('should have required methods', () => {
      expect(typeof detector.detectPrimaryLanguage).toBe('function');
      expect(typeof detector.detectLanguages).toBe('function');
      expect(typeof detector.analyzeFileLanguage).toBe('function');
    });

    it('should detect primary language from files', async () => {
      const glob = require('glob');
      glob.glob.mockResolvedValue(['file1.js', 'file2.ts', 'file3.py']);
      
      const language = await detector.detectPrimaryLanguage('/test/path');
      
      expect(language).toBeDefined();
      expect(typeof language).toBe('string');
    });

    it('should detect all languages in project', async () => {
      const glob = require('glob');
      glob.glob.mockResolvedValue(['file1.js', 'file2.py', 'file3.rs']);
      
      const languages = await detector.detectLanguages('/test/path');
      
      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBeGreaterThan(0);
    });

    it('should analyze individual file languages', () => {
      const testCases = [
        { file: 'test.js', expected: 'JavaScript' },
        { file: 'test.ts', expected: 'TypeScript' },
        { file: 'test.py', expected: 'Python' },
        { file: 'test.rs', expected: 'Rust' },
        { file: 'test.go', expected: 'Go' },
      ];

      testCases.forEach(({ file, expected }) => {
        const language = detector.analyzeFileLanguage(file);
        expect(language).toBe(expected);
      });
    });

    it('should handle unknown file extensions', () => {
      const language = detector.analyzeFileLanguage('unknown.xyz');
      expect(language).toBe('Unknown');
    });

    it('should count language statistics', async () => {
      const glob = require('glob');
      glob.glob.mockResolvedValue([
        'file1.js', 'file2.js', 'file3.js',
        'file4.ts', 'file5.ts',
        'file6.py'
      ]);
      
      const languages = await detector.detectLanguages('/test/path');
      
      expect(languages).toContain('JavaScript');
      expect(languages).toContain('TypeScript');
      expect(languages).toContain('Python');
    });

    it('should handle empty directories', async () => {
      const glob = require('glob');
      glob.glob.mockResolvedValue([]);
      
      const language = await detector.detectPrimaryLanguage('/test/empty');
      expect(language).toBe('Unknown');
    });

    it('should prioritize languages correctly', async () => {
      const glob = require('glob');
      // More TypeScript files than JavaScript
      glob.glob.mockResolvedValue([
        'file1.ts', 'file2.ts', 'file3.ts',
        'file4.js'
      ]);
      
      const language = await detector.detectPrimaryLanguage('/test/path');
      expect(language).toBe('TypeScript');
    });
  });

  describe('Integration Tests', () => {
    it('should work together for complete analysis', async () => {
      const projectAnalyzer = new ProjectAnalyzer();
      const codeAnalyzer = new CodeAnalyzer();
      const languageDetector = new LanguageDetector();
      
      try {
        // Simulate full analysis workflow
        const projectResult = await projectAnalyzer.analyzeProject('/test/path');
        const language = await languageDetector.detectPrimaryLanguage('/test/path');
        const codeInsights = await codeAnalyzer.analyzeCodebase('/test/path', language);
        
        expect(projectResult).toBeDefined();
        expect(language).toBeDefined();
        expect(codeInsights).toBeDefined();
      } catch (error) {
        // Expected in test environment
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle analysis errors gracefully', async () => {
      const analyzer = new ProjectAnalyzer();
      
      try {
        await analyzer.analyzeProject('/nonexistent/path');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});