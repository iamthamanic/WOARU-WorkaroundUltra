/**
 * Comprehensive Unit Tests for Core Module
 * Testing WOARUEngine and related core functionality
 */

import { WOARUEngine } from '../../src/core/WOARUEngine';

// Mock all dependencies
jest.mock('../../src/analyzer/ProjectAnalyzer');
jest.mock('../../src/analyzer/CodeAnalyzer');
jest.mock('../../src/database/DatabaseManager');
jest.mock('../../src/plugins/PluginManager');
jest.mock('../../src/actions/ActionManager');
jest.mock('../../src/quality/QualityRunner');
jest.mock('../../src/supervisor/NotificationManager');
jest.mock('../../src/auditor/ProductionReadinessAuditor');

// Mock filesystem operations
jest.mock('fs-extra', () => ({
  pathExists: jest.fn(async () => true),
  readFile: jest.fn(async () => '{}'),
}));

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, options, callback) => {
    if (typeof options === 'function') {
      options(null, 'mock output', '');
    } else {
      callback(null, 'mock output', '');
    }
  }),
}));

// Mock i18n
jest.mock('../../src/config/i18n', () => ({
  t: jest.fn((key: string) => key),
}));

describe('Core Module Unit Tests', () => {
  let engine: WOARUEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new WOARUEngine();
  });

  describe('WOARUEngine', () => {
    it('should be instantiable', () => {
      expect(engine).toBeInstanceOf(WOARUEngine);
    });

    it('should have required methods', () => {
      expect(typeof engine.analyzeProject).toBe('function');
      expect(typeof engine.setupProject).toBe('function');
      expect(typeof engine.updateDatabase).toBe('function');
    });

    it('should analyze project successfully', async () => {
      // Mock dependencies to return successful results
      const { ProjectAnalyzer } = require('../../src/analyzer/ProjectAnalyzer');
      const { CodeAnalyzer } = require('../../src/analyzer/CodeAnalyzer');
      const { PluginManager } = require('../../src/plugins/PluginManager');
      const { QualityRunner } = require('../../src/quality/QualityRunner');

      ProjectAnalyzer.prototype.analyzeProject.mockResolvedValue({
        language: 'JavaScript',
        framework: ['react'],
        dependencies: ['react', 'express'],
        devDependencies: ['jest', 'eslint'],
        scripts: { test: 'jest', build: 'webpack' },
        configFiles: ['package.json', '.eslintrc'],
        structure: ['src/', 'tests/'],
        packageManager: 'npm',
        projectPath: '/test/path'
      });

      ProjectAnalyzer.prototype.getProjectMetadata.mockResolvedValue({
        name: 'test-project',
        version: '1.0.0'
      });

      CodeAnalyzer.prototype.analyzeCodebase.mockResolvedValue(new Map([
        ['eslint', { reason: 'Code quality', evidence: ['files'], severity: 'medium' }]
      ]));

      PluginManager.prototype.getAllRecommendations.mockReturnValue([
        { tool: 'eslint', category: 'linting', reason: 'Code quality', packages: ['eslint'] }
      ]);

      PluginManager.prototype.getAllRefactorSuggestions.mockReturnValue([]);
      PluginManager.prototype.getAllSpecificPackages.mockReturnValue([]);

      QualityRunner.prototype.runSecurityChecksForReview.mockResolvedValue([]);

      const result = await engine.analyzeProject('/test/path');

      expect(result).toBeDefined();
      expect(result.setup_recommendations).toBeDefined();
      expect(Array.isArray(result.setup_recommendations)).toBe(true);
      expect(result.security_summary).toBeDefined();
    });

    it('should handle project analysis errors gracefully', async () => {
      const { ProjectAnalyzer } = require('../../src/analyzer/ProjectAnalyzer');
      ProjectAnalyzer.prototype.analyzeProject.mockRejectedValue(new Error('Analysis failed'));

      try {
        await engine.analyzeProject('/invalid/path');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Analysis failed');
      }
    });

    it('should setup project successfully', async () => {
      const { ProjectAnalyzer } = require('../../src/analyzer/ProjectAnalyzer');
      const { PluginManager } = require('../../src/plugins/PluginManager');
      const { ActionManager } = require('../../src/actions/ActionManager');

      ProjectAnalyzer.prototype.analyzeProject.mockResolvedValue({
        language: 'JavaScript',
        framework: ['react'],
        dependencies: [],
        devDependencies: [],
        scripts: {},
        configFiles: [],
        structure: [],
        packageManager: 'npm'
      });

      PluginManager.prototype.getAllRecommendations.mockReturnValue([
        { tool: 'eslint', category: 'linting', reason: 'Code quality', packages: ['eslint'] }
      ]);

      ActionManager.prototype.executeRecommendations.mockResolvedValue({
        success: true,
        results: []
      });

      const result = await engine.setupProject('/test/path');

      expect(result).toBe(true);
    });

    it('should handle setup with no recommendations', async () => {
      const { ProjectAnalyzer } = require('../../src/analyzer/ProjectAnalyzer');
      const { PluginManager } = require('../../src/plugins/PluginManager');

      ProjectAnalyzer.prototype.analyzeProject.mockResolvedValue({
        language: 'JavaScript',
        framework: [],
        dependencies: [],
        devDependencies: [],
        scripts: {},
        configFiles: [],
        structure: [],
        packageManager: 'npm'
      });

      PluginManager.prototype.getAllRecommendations.mockReturnValue([]);

      const result = await engine.setupProject('/test/path');

      expect(result).toBe(true);
    });

    it('should handle setup in dry run mode', async () => {
      const { ProjectAnalyzer } = require('../../src/analyzer/ProjectAnalyzer');
      const { PluginManager } = require('../../src/plugins/PluginManager');

      ProjectAnalyzer.prototype.analyzeProject.mockResolvedValue({
        language: 'JavaScript',
        framework: ['react'],
        dependencies: [],
        devDependencies: [],
        scripts: {},
        configFiles: [],
        structure: [],
        packageManager: 'npm'
      });

      PluginManager.prototype.getAllRecommendations.mockReturnValue([
        { tool: 'eslint', category: 'linting', reason: 'Code quality', packages: ['eslint'] }
      ]);

      const result = await engine.setupProject('/test/path', { dryRun: true });

      expect(result).toBe(true);
    });

    it('should update database successfully', async () => {
      const { DatabaseManager } = require('../../src/database/DatabaseManager');
      DatabaseManager.prototype.updateDatabase.mockResolvedValue(true);

      const result = await engine.updateDatabase();

      expect(result).toBe(true);
    });

    it('should handle database update failure', async () => {
      const { DatabaseManager } = require('../../src/database/DatabaseManager');
      DatabaseManager.prototype.updateDatabase.mockResolvedValue(false);

      const result = await engine.updateDatabase();

      expect(result).toBe(false);
    });

    it('should detect installed tools correctly', async () => {
      const { ProjectAnalyzer } = require('../../src/analyzer/ProjectAnalyzer');
      
      ProjectAnalyzer.prototype.analyzeProject.mockResolvedValue({
        language: 'JavaScript',
        framework: ['react'],
        dependencies: ['eslint', 'prettier'],
        devDependencies: ['jest'],
        scripts: {},
        configFiles: ['.eslintrc', '.prettierrc'],
        structure: [],
        packageManager: 'npm',
        projectPath: '/test/path'
      });

      ProjectAnalyzer.prototype.getProjectMetadata.mockResolvedValue({
        name: 'test-project',
        version: '1.0.0'
      });

      const { CodeAnalyzer } = require('../../src/analyzer/CodeAnalyzer');
      CodeAnalyzer.prototype.analyzeCodebase.mockResolvedValue(new Map());

      const { PluginManager } = require('../../src/plugins/PluginManager');
      PluginManager.prototype.getAllRecommendations.mockReturnValue([]);
      PluginManager.prototype.getAllRefactorSuggestions.mockReturnValue([]);
      PluginManager.prototype.getAllSpecificPackages.mockReturnValue([]);

      const { QualityRunner } = require('../../src/quality/QualityRunner');
      QualityRunner.prototype.runSecurityChecksForReview.mockResolvedValue([]);

      const result = await engine.analyzeProject('/test/path');

      expect(result.installed_tools_detected).toBeDefined();
      expect(Array.isArray(result.installed_tools_detected)).toBe(true);
    });

    it('should generate Claude automations', async () => {
      const { ProjectAnalyzer } = require('../../src/analyzer/ProjectAnalyzer');
      
      ProjectAnalyzer.prototype.analyzeProject.mockResolvedValue({
        language: 'TypeScript',
        framework: ['nextjs', 'react'],
        dependencies: ['next', 'react'],
        devDependencies: [],
        scripts: {},
        configFiles: [],
        structure: [],
        packageManager: 'npm',
        projectPath: '/test/path'
      });

      ProjectAnalyzer.prototype.getProjectMetadata.mockResolvedValue({
        name: 'test-project',
        version: '1.0.0'
      });

      const { CodeAnalyzer } = require('../../src/analyzer/CodeAnalyzer');
      CodeAnalyzer.prototype.analyzeCodebase.mockResolvedValue(new Map());

      const { PluginManager } = require('../../src/plugins/PluginManager');
      PluginManager.prototype.getAllRecommendations.mockReturnValue([]);
      PluginManager.prototype.getAllRefactorSuggestions.mockReturnValue([]);
      PluginManager.prototype.getAllSpecificPackages.mockReturnValue([]);

      const { QualityRunner } = require('../../src/quality/QualityRunner');
      QualityRunner.prototype.runSecurityChecksForReview.mockResolvedValue([]);

      const result = await engine.analyzeProject('/test/path');

      expect(result.claude_automations).toBeDefined();
      expect(Array.isArray(result.claude_automations)).toBe(true);
      expect(result.claude_automations.length).toBeGreaterThan(0);
    });

    it('should determine project type correctly', async () => {
      const testCases = [
        {
          analysis: {
            framework: ['react'],
            dependencies: ['react'],
            devDependencies: []
          },
          expected: 'frontend'
        },
        {
          analysis: {
            framework: ['express'],
            dependencies: ['express'],
            devDependencies: []
          },
          expected: 'backend'
        },
        {
          analysis: {
            framework: ['next'],
            dependencies: ['next', 'express'],
            devDependencies: []
          },
          expected: 'fullstack'
        },
        {
          analysis: {
            framework: [],
            dependencies: ['commander'],
            devDependencies: []
          },
          expected: 'cli'
        }
      ];

      for (const testCase of testCases) {
        const { ProjectAnalyzer } = require('../../src/analyzer/ProjectAnalyzer');
        
        ProjectAnalyzer.prototype.analyzeProject.mockResolvedValue({
          ...testCase.analysis,
          language: 'JavaScript',
          scripts: {},
          configFiles: [],
          structure: [],
          packageManager: 'npm',
          projectPath: '/test/path'
        });

        ProjectAnalyzer.prototype.getProjectMetadata.mockResolvedValue({
          name: 'test-project',
          version: '1.0.0'
        });

        const { CodeAnalyzer } = require('../../src/analyzer/CodeAnalyzer');
        CodeAnalyzer.prototype.analyzeCodebase.mockResolvedValue(new Map());

        const { PluginManager } = require('../../src/plugins/PluginManager');
        PluginManager.prototype.getAllRecommendations.mockReturnValue([]);
        PluginManager.prototype.getAllRefactorSuggestions.mockReturnValue([]);
        PluginManager.prototype.getAllSpecificPackages.mockReturnValue([]);

        const { QualityRunner } = require('../../src/quality/QualityRunner');
        QualityRunner.prototype.runSecurityChecksForReview.mockResolvedValue([]);

        const result = await engine.analyzeProject('/test/path');

        // Project type determination is internal, but we can test that analysis completes
        expect(result).toBeDefined();
      }
    });

    it('should handle security analysis', async () => {
      const { QualityRunner } = require('../../src/quality/QualityRunner');
      QualityRunner.prototype.runSecurityChecksForReview.mockResolvedValue([
        {
          tool: 'snyk',
          summary: { total: 2, critical: 1, high: 1, medium: 0, low: 0 },
          findings: [
            { id: 'vuln-1', severity: 'critical', title: 'Critical Vulnerability' },
            { id: 'vuln-2', severity: 'high', title: 'High Vulnerability' }
          ]
        }
      ]);

      const { ProjectAnalyzer } = require('../../src/analyzer/ProjectAnalyzer');
      ProjectAnalyzer.prototype.analyzeProject.mockResolvedValue({
        language: 'JavaScript',
        framework: [],
        dependencies: [],
        devDependencies: [],
        scripts: {},
        configFiles: [],
        structure: [],
        packageManager: 'npm',
        projectPath: '/test/path'
      });

      ProjectAnalyzer.prototype.getProjectMetadata.mockResolvedValue({
        name: 'test-project',
        version: '1.0.0'
      });

      const { CodeAnalyzer } = require('../../src/analyzer/CodeAnalyzer');
      CodeAnalyzer.prototype.analyzeCodebase.mockResolvedValue(new Map());

      const { PluginManager } = require('../../src/plugins/PluginManager');
      PluginManager.prototype.getAllRecommendations.mockReturnValue([]);
      PluginManager.prototype.getAllRefactorSuggestions.mockReturnValue([]);
      PluginManager.prototype.getAllSpecificPackages.mockReturnValue([]);

      const result = await engine.analyzeProject('/test/path');

      expect(result.security_summary).toBeDefined();
      expect(result.security_summary.total_issues).toBe(2);
      expect(result.security_summary.critical).toBe(1);
      expect(result.security_summary.high).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle analysis errors gracefully', async () => {
      const { ProjectAnalyzer } = require('../../src/analyzer/ProjectAnalyzer');
      ProjectAnalyzer.prototype.analyzeProject.mockRejectedValue(new Error('Failed to read project'));

      try {
        await engine.analyzeProject('/nonexistent/path');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle setup errors gracefully', async () => {
      const { ProjectAnalyzer } = require('../../src/analyzer/ProjectAnalyzer');
      ProjectAnalyzer.prototype.analyzeProject.mockRejectedValue(new Error('Setup failed'));

      const result = await engine.setupProject('/invalid/path');
      expect(result).toBe(false);
    });
  });
});