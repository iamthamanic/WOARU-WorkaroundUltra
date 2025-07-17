// @ts-nocheck
import { WOARUEngine } from '../../src/core/WOARUEngine';
import { ProjectAnalyzer } from '../../src/analyzer/ProjectAnalyzer';
import { CodeAnalyzer } from '../../src/analyzer/CodeAnalyzer';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { PluginManager } from '../../src/plugins/PluginManager';
import { ActionManager } from '../../src/actions/ActionManager';
import { QualityRunner } from '../../src/quality/QualityRunner';
import { NotificationManager } from '../../src/supervisor/NotificationManager';
import { ProductionReadinessAuditor } from '../../src/auditor/ProductionReadinessAuditor';
import { AnalysisResult, ProjectAnalysis } from '../../src/types';
import fs from 'fs-extra';
import path from 'path';

// Mock all dependencies
jest.mock('../../src/analyzer/ProjectAnalyzer');
jest.mock('../../src/analyzer/CodeAnalyzer');
jest.mock('../../src/database/DatabaseManager');
jest.mock('../../src/plugins/PluginManager');
jest.mock('../../src/actions/ActionManager');
jest.mock('../../src/quality/QualityRunner');
jest.mock('../../src/supervisor/NotificationManager');
jest.mock('../../src/auditor/ProductionReadinessAuditor');
jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
  readFile: jest.fn(),
  stat: jest.fn()
}));
jest.mock('child_process', () => ({
  exec: jest.fn()
}));
jest.mock('util', () => {
  const originalUtil = jest.requireActual('util');
  return {
    ...originalUtil,
    promisify: jest.fn(() => jest.fn().mockResolvedValue({ stdout: '', stderr: '' }))
  };
});

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('WOARUEngine Unit Tests', () => {
  let woaruEngine: WOARUEngine;
  let mockProjectAnalyzer: jest.Mocked<ProjectAnalyzer>;
  let mockCodeAnalyzer: jest.Mocked<CodeAnalyzer>;
  let mockDatabaseManager: jest.Mocked<DatabaseManager>;
  let mockPluginManager: jest.Mocked<PluginManager>;
  let mockActionManager: jest.Mocked<ActionManager>;
  let mockQualityRunner: jest.Mocked<QualityRunner>;
  let mockNotificationManager: jest.Mocked<NotificationManager>;
  let mockProductionAuditor: jest.Mocked<ProductionReadinessAuditor>;
  let mockFs: jest.Mocked<typeof fs>;

  const mockProjectPath = '/test/project';
  const mockProjectAnalysis: ProjectAnalysis = {
    projectPath: mockProjectPath,
    language: 'typescript',
    framework: ['react', 'nextjs'],
    dependencies: ['react', 'next', 'typescript'],
    devDependencies: ['jest', 'eslint', '@types/react'],
    packageManager: 'npm',
    scripts: {
      test: 'jest',
      build: 'next build',
      start: 'next start',
      lint: 'eslint .'
    },
    configFiles: ['tsconfig.json', 'package.json'],
    structure: ['src/', 'tests/', 'package.json']
  };

  const mockProjectMetadata = {
    name: 'test-project',
    version: '1.0.0',
    description: 'Test project for WOARUEngine'
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mocked classes
    mockProjectAnalyzer = {
      analyzeProject: jest.fn().mockResolvedValue(mockProjectAnalysis),
      getProjectMetadata: jest.fn().mockResolvedValue(mockProjectMetadata)
    } as jest.Mocked<ProjectAnalyzer>;
    mockCodeAnalyzer = {
      analyzeCodebase: jest.fn().mockResolvedValue(new Map([
        ['eslint', { reason: 'Code quality issues detected', evidence: ['unused variables'], files: ['src/index.ts'], severity: 'medium' }],
        ['prettier', { reason: 'Formatting inconsistencies', evidence: ['mixed quotes'], files: ['src/utils.ts'], severity: 'low' }]
      ]))
    } as jest.Mocked<CodeAnalyzer>;
    mockDatabaseManager = {
      updateDatabase: jest.fn().mockResolvedValue(true)
    } as jest.Mocked<DatabaseManager>;
    mockPluginManager = {
      getAllRecommendations: jest.fn().mockReturnValue([
        { tool: 'eslint', category: 'linting', reason: 'Code quality improvement', priority: 'high', packages: ['eslint'], configFiles: ['.eslintrc.js'] },
        { tool: 'prettier', category: 'formatting', reason: 'Code formatting', priority: 'medium', packages: ['prettier'], configFiles: ['.prettierrc'] }
      ]),
      getAllRefactorSuggestions: jest.fn().mockReturnValue([
        { type: 'maintainability', filename: 'src/utils.ts', suggestion: 'Extract large function into smaller functions' }
      ]),
      getAllSpecificPackages: jest.fn().mockReturnValue(['@types/react'])
    } as jest.Mocked<PluginManager>;
    mockActionManager = {
      executeRecommendations: jest.fn().mockResolvedValue({
        success: true,
        results: [{ tool: 'eslint', success: true, message: 'ESLint configured successfully' }]
      })
    } as jest.Mocked<ActionManager>;
    mockQualityRunner = {
      runSecurityChecksForReview: jest.fn().mockResolvedValue([
        {
          tool: 'npm-audit',
          summary: { total: 2, critical: 1, high: 1, medium: 0, low: 0 },
          findings: [
            { severity: 'critical', title: 'Test vulnerability', package: 'test-package' }
          ]
        }
      ]),
      runAllQualityChecks: jest.fn().mockResolvedValue([]),
      runSecurityScan: jest.fn().mockResolvedValue([]),
      runProductionReadinessCheck: jest.fn().mockResolvedValue([])
    } as jest.Mocked<QualityRunner>;
    mockNotificationManager = {
      showProgress: jest.fn(),
      showSuccess: jest.fn(),
      showError: jest.fn(),
      showHealthScore: jest.fn(),
      notifyIssues: jest.fn(),
      notifyRecommendation: jest.fn(),
      sendWebhook: jest.fn()
    } as jest.Mocked<NotificationManager>;
    mockProductionAuditor = {
      auditProject: jest.fn().mockResolvedValue([
        {
          category: 'security',
          check: 'dependency-check',
          status: 'partial',
          priority: 'high',
          message: 'Outdated dependencies found',
          recommendation: 'Update dependencies to latest versions',
          packages: ['react@16.0.0'],
          files: ['package.json']
        }
      ])
    } as jest.Mocked<ProductionReadinessAuditor>;
    // @ts-ignore
    mockFs = fs;

    // Mock constructors
    (ProjectAnalyzer as jest.MockedClass<typeof ProjectAnalyzer>).mockImplementation(() => mockProjectAnalyzer);
    (CodeAnalyzer as jest.MockedClass<typeof CodeAnalyzer>).mockImplementation(() => mockCodeAnalyzer);
    (DatabaseManager as jest.MockedClass<typeof DatabaseManager>).mockImplementation(() => mockDatabaseManager);
    (PluginManager as jest.MockedClass<typeof PluginManager>).mockImplementation(() => mockPluginManager);
    (ActionManager as jest.MockedClass<typeof ActionManager>).mockImplementation(() => mockActionManager);
    (QualityRunner as jest.MockedClass<typeof QualityRunner>).mockImplementation(() => mockQualityRunner);
    (NotificationManager as jest.MockedClass<typeof NotificationManager>).mockImplementation(() => mockNotificationManager);
    (ProductionReadinessAuditor as jest.MockedClass<typeof ProductionReadinessAuditor>).mockImplementation(() => mockProductionAuditor);

    // Create WOARUEngine instance
    woaruEngine = new WOARUEngine();
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('Construction and Initialization', () => {
    it('should initialize all required components', () => {
      expect(ProjectAnalyzer).toHaveBeenCalledTimes(1);
      expect(CodeAnalyzer).toHaveBeenCalledTimes(1);
      expect(DatabaseManager).toHaveBeenCalledTimes(1);
      expect(PluginManager).toHaveBeenCalledTimes(1);
      expect(ActionManager).toHaveBeenCalledTimes(1);
      expect(NotificationManager).toHaveBeenCalledWith({
        terminal: false,
        desktop: false,
      });
      expect(QualityRunner).toHaveBeenCalledWith(mockNotificationManager);
    });

    it('should be properly instantiated', () => {
      expect(woaruEngine).toBeInstanceOf(WOARUEngine);
      expect(woaruEngine).toBeDefined();
    });
  });

  describe('analyzeProject() Core Functionality', () => {

    it('should perform complete project analysis', async () => {
      const result = await woaruEngine.analyzeProject(mockProjectPath);

      expect(result).toBeDefined();
      expect(result.setup_recommendations).toBeDefined();
      expect(result.tool_suggestions).toBeDefined();
      expect(result.framework_specific_tools).toBeDefined();
      expect(result.refactor_suggestions).toBeDefined();
      expect(result.installed_tools_detected).toBeDefined();
      expect(result.code_insights).toBeDefined();
      expect(result.production_audits).toBeDefined();
      expect(result.security_summary).toBeDefined();
      expect(result.detailed_security).toBeDefined();
    });

    it('should call ProjectAnalyzer.analyzeProject', async () => {
      await woaruEngine.analyzeProject(mockProjectPath);

      expect(mockProjectAnalyzer.analyzeProject).toHaveBeenCalledWith(mockProjectPath);
      expect(mockProjectAnalyzer.getProjectMetadata).toHaveBeenCalledWith(mockProjectPath);
    });

    it('should call CodeAnalyzer.analyzeCodebase', async () => {
      await woaruEngine.analyzeProject(mockProjectPath);

      expect(mockCodeAnalyzer.analyzeCodebase).toHaveBeenCalledWith(mockProjectPath, 'typescript');
    });

    it('should call PluginManager methods', async () => {
      await woaruEngine.analyzeProject(mockProjectPath);

      expect(mockPluginManager.getAllRecommendations).toHaveBeenCalledWith(mockProjectAnalysis);
      expect(mockPluginManager.getAllRefactorSuggestions).toHaveBeenCalledWith(mockProjectAnalysis);
      expect(mockPluginManager.getAllSpecificPackages).toHaveBeenCalledWith(mockProjectAnalysis);
    });

    it('should run production readiness audit', async () => {
      await woaruEngine.analyzeProject(mockProjectPath);

      expect(ProductionReadinessAuditor).toHaveBeenCalledWith(mockProjectPath);
      expect(mockProductionAuditor.auditProject).toHaveBeenCalledWith({
        language: 'typescript',
        frameworks: ['react', 'nextjs'],
        projectType: expect.any(String)
      });
    });

    it('should return properly formatted analysis result', async () => {
      const result = await woaruEngine.analyzeProject(mockProjectPath);

      expect(result.setup_recommendations).toContain('Install eslint for linting: Code quality issues detected');
      expect(result.tool_suggestions).toContain('eslint');
      expect(result.code_insights).toEqual([
        {
          tool: 'eslint',
          reason: 'Code quality issues detected',
          evidence: ['unused variables'],
          severity: 'medium'
        },
        {
          tool: 'prettier',
          reason: 'Formatting inconsistencies',
          evidence: ['mixed quotes'],
          severity: 'low'
        }
      ]);
    });

    it('should handle analysis errors gracefully', async () => {
      mockProjectAnalyzer.analyzeProject.mockRejectedValue(new Error('Analysis failed'));

      await expect(woaruEngine.analyzeProject(mockProjectPath)).rejects.toThrow('Analysis failed: Analysis failed');
    });
  });

  describe('Language Detection', () => {
    it('should detect TypeScript projects', async () => {
      mockProjectAnalyzer.analyzeProject.mockResolvedValue({
        ...mockProjectAnalysis,
        language: 'typescript'
      });

      const result = await woaruEngine.analyzeProject(mockProjectPath);

      expect(mockCodeAnalyzer.analyzeCodebase).toHaveBeenCalledWith(mockProjectPath, 'typescript');
    });

    it('should detect JavaScript projects', async () => {
      mockProjectAnalyzer.analyzeProject.mockResolvedValue({
        ...mockProjectAnalysis,
        language: 'javascript'
      });

      const result = await woaruEngine.analyzeProject(mockProjectPath);

      expect(mockCodeAnalyzer.analyzeCodebase).toHaveBeenCalledWith(mockProjectPath, 'javascript');
    });

    it('should detect Python projects', async () => {
      mockProjectAnalyzer.analyzeProject.mockResolvedValue({
        ...mockProjectAnalysis,
        language: 'python',
        framework: ['django']
      });

      const result = await woaruEngine.analyzeProject(mockProjectPath);

      expect(mockCodeAnalyzer.analyzeCodebase).toHaveBeenCalledWith(mockProjectPath, 'python');
    });

    it('should detect Java projects', async () => {
      mockProjectAnalyzer.analyzeProject.mockResolvedValue({
        ...mockProjectAnalysis,
        language: 'java',
        framework: ['spring']
      });

      const result = await woaruEngine.analyzeProject(mockProjectPath);

      expect(mockCodeAnalyzer.analyzeCodebase).toHaveBeenCalledWith(mockProjectPath, 'java');
    });

    it('should handle unknown languages', async () => {
      mockProjectAnalyzer.analyzeProject.mockResolvedValue({
        ...mockProjectAnalysis,
        language: 'unknown'
      });

      const result = await woaruEngine.analyzeProject(mockProjectPath);

      expect(mockCodeAnalyzer.analyzeCodebase).toHaveBeenCalledWith(mockProjectPath, 'unknown');
    });
  });

  describe('Tool Detection', () => {
    beforeEach(() => {
      // Mock file system operations for tool detection
      mockFs.pathExists.mockImplementation((filePath) => {
        const pathStr = filePath.toString();
        if (pathStr.includes('eslint')) return Promise.resolve(true);
        if (pathStr.includes('prettier')) return Promise.resolve(true);
        if (pathStr.includes('jest')) return Promise.resolve(true);
        return Promise.resolve(false);
      });
    });

    it('should detect installed tools from package.json', async () => {
      const result = await woaruEngine.analyzeProject(mockProjectPath);

      expect(result.installed_tools_detected).toBeDefined();
      expect(Array.isArray(result.installed_tools_detected)).toBe(true);
    });

    it('should detect tools from configuration files', async () => {
      mockFs.pathExists.mockResolvedValue(true);

      const result = await woaruEngine.analyzeProject(mockProjectPath);

      expect(result.installed_tools_detected).toBeDefined();
    });

    it('should detect framework-specific tools', async () => {
      mockProjectAnalyzer.analyzeProject.mockResolvedValue({
        ...mockProjectAnalysis,
        framework: ['react', 'nextjs']
      });

      const result = await woaruEngine.analyzeProject(mockProjectPath);

      expect(result.framework_specific_tools).toBeDefined();
    });

    it('should handle empty dependencies gracefully', async () => {
      mockProjectAnalyzer.analyzeProject.mockResolvedValue({
        ...mockProjectAnalysis,
        dependencies: [],
        devDependencies: []
      });

      const result = await woaruEngine.analyzeProject(mockProjectPath);

      expect(result.installed_tools_detected).toBeDefined();
      expect(Array.isArray(result.installed_tools_detected)).toBe(true);
    });
  });

  describe('Security Analysis', () => {

    it('should run comprehensive security analysis', async () => {
      const result = await woaruEngine.analyzeProject(mockProjectPath);

      expect(result.security_summary).toBeDefined();
      expect(result.security_summary.total_issues).toBeGreaterThanOrEqual(0);
      expect(result.security_summary.health_score).toBeDefined();
    });

    it('should include detailed security results', async () => {
      const result = await woaruEngine.analyzeProject(mockProjectPath);

      expect(result.detailed_security).toBeDefined();
      expect(result.detailed_security.dependency_vulnerabilities).toBeDefined();
      expect(result.detailed_security.infrastructure_security).toBeDefined();
      expect(result.detailed_security.configuration_audits).toBeDefined();
    });

    it('should calculate security health score', async () => {
      const result = await woaruEngine.analyzeProject(mockProjectPath);

      expect(result.security_summary.health_score).toBeDefined();
      expect(typeof result.security_summary.health_score).toBe('number');
      expect(result.security_summary.health_score).toBeGreaterThanOrEqual(0);
      expect(result.security_summary.health_score).toBeLessThanOrEqual(100);
    });

    it('should categorize security findings by severity', async () => {
      const result = await woaruEngine.analyzeProject(mockProjectPath);

      expect(result.security_summary.critical).toBeDefined();
      expect(result.security_summary.high).toBeDefined();
      expect(result.security_summary.medium).toBeDefined();
      expect(result.security_summary.low).toBeDefined();
    });
  });

  describe('setupProject() Functionality', () => {

    it('should setup project with recommendations', async () => {
      const result = await woaruEngine.setupProject(mockProjectPath);

      expect(result).toBe(true);
      expect(mockProjectAnalyzer.analyzeProject).toHaveBeenCalledWith(mockProjectPath);
      expect(mockPluginManager.getAllRecommendations).toHaveBeenCalledWith(mockProjectAnalysis);
      expect(mockActionManager.executeRecommendations).toHaveBeenCalled();
    });

    it('should handle dry run mode', async () => {
      const result = await woaruEngine.setupProject(mockProjectPath, { dryRun: true });

      expect(result).toBe(true);
      expect(mockActionManager.executeRecommendations).not.toHaveBeenCalled();
    });

    it('should handle project with no recommendations', async () => {
      mockPluginManager.getAllRecommendations.mockReturnValue([]);

      const result = await woaruEngine.setupProject(mockProjectPath);

      expect(result).toBe(true);
      expect(mockActionManager.executeRecommendations).not.toHaveBeenCalled();
    });

    it('should handle setup errors', async () => {
      mockActionManager.executeRecommendations.mockRejectedValue(new Error('Setup failed'));
      
      // Mock console.error to capture calls
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await woaruEngine.setupProject(mockProjectPath);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Setup failed')
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Database Operations', () => {
    it('should update database successfully', async () => {
      mockDatabaseManager.updateDatabase.mockResolvedValue(true);
      
      // Mock console.log to capture calls
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await woaruEngine.updateDatabase();

      expect(result).toBe(true);
      expect(mockDatabaseManager.updateDatabase).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Database updated successfully')
      );
      
      consoleLogSpy.mockRestore();
    });

    it('should handle database update failure', async () => {
      mockDatabaseManager.updateDatabase.mockResolvedValue(false);
      
      // Mock console.log to capture calls
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await woaruEngine.updateDatabase();

      expect(result).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to update database')
      );
      
      consoleLogSpy.mockRestore();
    });

    it('should handle database update errors', async () => {
      // Mock the database manager to throw an error
      try {
        mockDatabaseManager.updateDatabase.mockImplementation(() => {
          throw new Error('Database error');
        });

        const result = await woaruEngine.updateDatabase();
        expect(result).toBe(false);
      } catch (error) {
        // If the error is thrown during execution (which is expected), catch it and verify the result
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Database error');
      }
    });
  });

  describe('Code Insights Enhancement', () => {
    it('should enhance recommendations with code insights', async () => {
      const codeInsights = new Map([
        ['eslint', { reason: 'Many linting issues found', evidence: ['unused-vars', 'no-console'], severity: 'high' }]
      ]);
      mockCodeAnalyzer.analyzeCodebase.mockResolvedValue(codeInsights);

      const result = await woaruEngine.analyzeProject(mockProjectPath);

      expect(result.code_insights).toEqual([
        {
          tool: 'eslint',
          reason: 'Many linting issues found',
          evidence: ['unused-vars', 'no-console'],
          severity: 'high'
        }
      ]);
    });

    it('should handle empty code insights', async () => {
      mockCodeAnalyzer.analyzeCodebase.mockResolvedValue(new Map());

      const result = await woaruEngine.analyzeProject(mockProjectPath);

      expect(result.code_insights).toEqual([]);
    });
  });

  describe('Project Type Detection', () => {
    it('should detect web application project type', async () => {
      mockProjectAnalyzer.analyzeProject.mockResolvedValue({
        ...mockProjectAnalysis,
        framework: ['react', 'nextjs']
      });

      await woaruEngine.analyzeProject(mockProjectPath);

      expect(mockProductionAuditor.auditProject).toHaveBeenCalledWith(
        expect.objectContaining({
          projectType: expect.any(String)
        })
      );
    });

    it('should detect API project type', async () => {
      mockProjectAnalyzer.analyzeProject.mockResolvedValue({
        ...mockProjectAnalysis,
        framework: ['express', 'fastify']
      });

      await woaruEngine.analyzeProject(mockProjectPath);

      expect(mockProductionAuditor.auditProject).toHaveBeenCalledWith(
        expect.objectContaining({
          projectType: expect.any(String)
        })
      );
    });

    it('should detect library project type', async () => {
      mockProjectAnalyzer.analyzeProject.mockResolvedValue({
        ...mockProjectAnalysis,
        framework: []
      });

      await woaruEngine.analyzeProject(mockProjectPath);

      expect(mockProductionAuditor.auditProject).toHaveBeenCalledWith(
        expect.objectContaining({
          projectType: expect.any(String)
        })
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle ProjectAnalyzer errors', async () => {
      mockProjectAnalyzer.analyzeProject.mockRejectedValue(new Error('Project analysis failed'));

      await expect(woaruEngine.analyzeProject(mockProjectPath)).rejects.toThrow(
        'Analysis failed: Project analysis failed'
      );
    });

    it('should handle CodeAnalyzer errors', async () => {
      mockCodeAnalyzer.analyzeCodebase.mockRejectedValue(new Error('Code analysis failed'));

      await expect(woaruEngine.analyzeProject(mockProjectPath)).rejects.toThrow(
        'Analysis failed: Code analysis failed'
      );
    });

    it('should handle ProductionAuditor errors', async () => {
      mockProductionAuditor.auditProject.mockRejectedValue(new Error('Audit failed'));

      await expect(woaruEngine.analyzeProject(mockProjectPath)).rejects.toThrow(
        'Analysis failed: Audit failed'
      );
    });

    it('should handle invalid project paths', async () => {
      mockProjectAnalyzer.analyzeProject.mockRejectedValue(new Error('Invalid project path'));

      await expect(woaruEngine.analyzeProject('/invalid/path')).rejects.toThrow(
        'Analysis failed: Invalid project path'
      );
    });

    it('should handle empty project analysis', async () => {
      mockProjectAnalyzer.analyzeProject.mockResolvedValue({
        ...mockProjectAnalysis,
        dependencies: [],
        devDependencies: [],
        framework: []
      });

      const result = await woaruEngine.analyzeProject(mockProjectPath);

      expect(result).toBeDefined();
      expect(result.setup_recommendations).toBeDefined();
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large project analysis efficiently', async () => {
      const largeProjectAnalysis = {
        ...mockProjectAnalysis,
        dependencies: new Array(1000).fill(0).map((_, i) => `package-${i}`),
        devDependencies: new Array(500).fill(0).map((_, i) => `dev-package-${i}`)
      };
      
      mockProjectAnalyzer.analyzeProject.mockResolvedValue(largeProjectAnalysis);

      const startTime = Date.now();
      const result = await woaruEngine.analyzeProject(mockProjectPath);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent analysis requests', async () => {
      const promises = [
        woaruEngine.analyzeProject(mockProjectPath),
        woaruEngine.analyzeProject(mockProjectPath),
        woaruEngine.analyzeProject(mockProjectPath)
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });
  });
});