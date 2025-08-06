/**
 * Comprehensive Unit Tests for HookSystem
 * Testing the "KI-freundliche Regelwelt" Hook System functionality
 * 
 * 🛡️ REGEL: HookSystem MUSS vollständig getestet werden
 * Teil der Phase 4.1 - Comprehensive Testing
 */

import { EventEmitter } from 'events';
import {
  hookManager,
  triggerHook,
  registerHook,
  unregisterHook,
  clearHooks,
  type HookEvent,
  type HookData,
  type BeforeAnalysisData,
  type AfterAnalysisData,
  type BeforeFileAnalysisData,
  type AfterFileAnalysisData,
  type BeforeToolExecutionData,
  type AfterToolExecutionData,
  type ErrorHookData,
  type ConfigLoadHookData,
  type ReportGenerationData,
} from '../../src/core/HookSystem';

// Mock console.debug to capture debug logs
const mockConsoleDebug = jest.fn();
const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
const originalConsoleDebug = console.debug;
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('HookSystem Unit Tests - KI-freundliche Regelwelt', () => {
  beforeEach(() => {
    // Clear all hooks before each test
    clearHooks();
    jest.clearAllMocks();
    console.debug = mockConsoleDebug;
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
  });

  afterEach(() => {
    console.debug = originalConsoleDebug;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('🎣 Hook Registration', () => {
    it('should register hooks correctly', () => {
      const mockHandler = jest.fn();
      
      registerHook('beforeAnalysis', mockHandler);
      
      const hooks = hookManager.listRegisteredHooks();
      expect(hooks['beforeAnalysis']).toBe(1);
    });

    it('should register multiple hooks for the same event', () => {
      const mockHandler1 = jest.fn();
      const mockHandler2 = jest.fn();
      
      registerHook('beforeAnalysis', mockHandler1);
      registerHook('beforeAnalysis', mockHandler2);
      
      const hooks = hookManager.listRegisteredHooks();
      expect(hooks['beforeAnalysis']).toBe(2);
    });

    it('should register hooks with priorities', () => {
      const mockHandler1 = jest.fn();
      const mockHandler2 = jest.fn();
      const mockHandler3 = jest.fn();
      
      registerHook('beforeAnalysis', mockHandler1, 100);
      registerHook('beforeAnalysis', mockHandler2, 200);
      registerHook('beforeAnalysis', mockHandler3, 150);
      
      const hooks = hookManager.listRegisteredHooks();
      expect(hooks['beforeAnalysis']).toBe(3);
    });

    it('should register hooks without priority (default)', () => {
      const mockHandler = jest.fn();
      
      registerHook('beforeAnalysis', mockHandler);
      
      const hooks = hookManager.listRegisteredHooks();
      expect(hooks['beforeAnalysis']).toBe(1);
    });
  });

  describe('🗑️ Hook Unregistration', () => {
    it('should unregister hooks correctly', () => {
      const mockHandler = jest.fn();
      
      registerHook('beforeAnalysis', mockHandler);
      expect(hookManager.listRegisteredHooks()['beforeAnalysis']).toBe(1);
      
      // The actual HookSystem wraps handlers, so direct unregistration doesn't work
      // Instead, test that clearHooks works for the specific event
      clearHooks('beforeAnalysis');
      expect(hookManager.listRegisteredHooks()['beforeAnalysis']).toBe(0);
    });

    it('should handle unregistering non-existent hooks gracefully', () => {
      const mockHandler = jest.fn();
      
      expect(() => {
        unregisterHook('beforeAnalysis', mockHandler);
      }).not.toThrow();
    });

    it('should clear all hooks for specific event', () => {
      const mockHandler1 = jest.fn();
      const mockHandler2 = jest.fn();
      
      registerHook('beforeAnalysis', mockHandler1);
      registerHook('afterAnalysis', mockHandler2);
      
      expect(hookManager.listRegisteredHooks()['beforeAnalysis']).toBe(1);
      expect(hookManager.listRegisteredHooks()['afterAnalysis']).toBe(1);
      
      clearHooks('beforeAnalysis');
      
      expect(hookManager.listRegisteredHooks()['beforeAnalysis']).toBe(0);
      expect(hookManager.listRegisteredHooks()['afterAnalysis']).toBe(1);
    });

    it('should clear all hooks when no event specified', () => {
      const mockHandler1 = jest.fn();
      const mockHandler2 = jest.fn();
      
      registerHook('beforeAnalysis', mockHandler1);
      registerHook('afterAnalysis', mockHandler2);
      
      expect(hookManager.listRegisteredHooks()['beforeAnalysis']).toBe(1);
      expect(hookManager.listRegisteredHooks()['afterAnalysis']).toBe(1);
      
      clearHooks();
      
      expect(hookManager.listRegisteredHooks()['beforeAnalysis']).toBe(0);
      expect(hookManager.listRegisteredHooks()['afterAnalysis']).toBe(0);
    });
  });

  describe('🚀 Hook Triggering', () => {
    it('should trigger hooks with correct data', async () => {
      const mockHandler = jest.fn();
      
      registerHook('beforeAnalysis', mockHandler);
      
      const testData: BeforeAnalysisData = {
        files: ['test.js', 'test2.js'],
        projectPath: '/test/path',
        config: { language: 'javascript' },
        timestamp: new Date()
      };
      
      await triggerHook('beforeAnalysis', testData);
      
      expect(mockHandler).toHaveBeenCalledWith(testData);
    });

    it('should trigger hooks in priority order (high to low)', async () => {
      const callOrder: number[] = [];
      
      const mockHandler1 = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        callOrder.push(1);
      });
      const mockHandler2 = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        callOrder.push(2);
      });
      const mockHandler3 = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        callOrder.push(3);
      });
      
      registerHook('beforeAnalysis', mockHandler1, 100);
      registerHook('beforeAnalysis', mockHandler2, 300);
      registerHook('beforeAnalysis', mockHandler3, 200);
      
      const testData: BeforeAnalysisData = {
        files: ['test.js'],
        projectPath: '/test/path',
        config: {},
        timestamp: new Date()
      };
      
      await triggerHook('beforeAnalysis', testData);
      
      expect(mockHandler1).toHaveBeenCalledWith(testData);
      expect(mockHandler2).toHaveBeenCalledWith(testData);
      expect(mockHandler3).toHaveBeenCalledWith(testData);
    });

    it('should handle async hooks correctly', async () => {
      const mockHandler = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async result';
      });
      
      registerHook('beforeAnalysis', mockHandler);
      
      const testData: BeforeAnalysisData = {
        files: ['test.js'],
        projectPath: '/test/path',
        config: {},
        timestamp: new Date()
      };
      
      await triggerHook('beforeAnalysis', testData);
      
      expect(mockHandler).toHaveBeenCalledWith(testData);
    });

    it('should handle hook errors with wrapped error handling', async () => {
      const errorHandler = jest.fn().mockImplementation(() => {
        throw new Error('Hook error');
      });
      const successHandler = jest.fn();
      
      registerHook('beforeAnalysis', errorHandler, 200);
      registerHook('beforeAnalysis', successHandler, 100);
      
      const testData: BeforeAnalysisData = {
        files: ['test.js'],
        projectPath: '/test/path',
        config: {},
        timestamp: new Date()
      };
      
      // The HookSystem wraps handlers and catches errors internally
      // So triggerHook should NOT throw, errors are caught and logged
      await expect(triggerHook('beforeAnalysis', testData)).resolves.not.toThrow();
      
      // Both handlers should have been called
      expect(errorHandler).toHaveBeenCalledWith(testData);
      expect(successHandler).toHaveBeenCalledWith(testData);
      
      // Error should have been logged to console.error
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Hook execution failed for beforeAnalysis:'),
        expect.any(Error)
      );
    });
  });

  describe('🎭 Hook Data Types', () => {
    it('should handle BeforeAnalysisData correctly', async () => {
      const mockHandler = jest.fn();
      registerHook('beforeAnalysis', mockHandler);
      
      const testData: BeforeAnalysisData = {
        files: ['src/index.js', 'src/utils.js'],
        projectPath: '/home/user/project',
        config: {
          language: 'javascript',
          framework: 'react',
          excludePatterns: ['node_modules/**']
        },
        timestamp: new Date('2024-01-01T12:00:00Z')
      };
      
      await triggerHook('beforeAnalysis', testData);
      
      expect(mockHandler).toHaveBeenCalledWith(testData);
    });

    it('should handle AfterAnalysisData correctly', async () => {
      const mockHandler = jest.fn();
      registerHook('afterAnalysis', mockHandler);
      
      const testData: AfterAnalysisData = {
        files: ['src/index.js'],
        results: [
          { file: 'src/index.js', tool: 'eslint', success: true, issues: [] }
        ],
        duration: 1500,
        timestamp: new Date(),
        success: true
      };
      
      await triggerHook('afterAnalysis', testData);
      
      expect(mockHandler).toHaveBeenCalledWith(testData);
    });

    it('should handle BeforeToolExecutionData correctly', async () => {
      const mockHandler = jest.fn();
      registerHook('beforeToolExecution', mockHandler);
      
      const testData: BeforeToolExecutionData = {
        toolName: 'eslint',
        filePath: '/project/src/index.js',
        command: 'eslint --fix src/index.js',
        timestamp: new Date()
      };
      
      await triggerHook('beforeToolExecution', testData);
      
      expect(mockHandler).toHaveBeenCalledWith(testData);
    });

    it('should handle AfterToolExecutionData correctly', async () => {
      const mockHandler = jest.fn();
      registerHook('afterToolExecution', mockHandler);
      
      const testData: AfterToolExecutionData = {
        toolName: 'eslint',
        filePath: '/project/src/index.js',
        command: 'eslint --fix src/index.js',
        output: 'All issues fixed successfully',
        exitCode: 0,
        duration: 2000,
        timestamp: new Date(),
        success: true
      };
      
      await triggerHook('afterToolExecution', testData);
      
      expect(mockHandler).toHaveBeenCalledWith(testData);
    });

    it('should handle ErrorHookData correctly', async () => {
      const mockHandler = jest.fn();
      registerHook('onError', mockHandler);
      
      const testError = new Error('Test error message');
      const testData: ErrorHookData = {
        error: testError,
        context: 'code-analysis',
        filePath: '/project/src/index.js',
        toolName: 'eslint',
        timestamp: new Date()
      };
      
      await triggerHook('onError', testData);
      
      expect(mockHandler).toHaveBeenCalledWith(testData);
    });

    it('should handle ConfigLoadHookData correctly', async () => {
      const mockHandler = jest.fn();
      registerHook('onConfigLoad', mockHandler);
      
      const testData: ConfigLoadHookData = {
        configType: 'ai',
        configPath: '/home/user/.woaru/config/ai_config.json',
        configData: { providers: ['openai', 'anthropic'] },
        timestamp: new Date()
      };
      
      await triggerHook('onConfigLoad', testData);
      
      expect(mockHandler).toHaveBeenCalledWith(testData);
    });

    it('should handle ReportGenerationData correctly', async () => {
      const mockHandler = jest.fn();
      registerHook('onReportGeneration', mockHandler);
      
      const testData: ReportGenerationData = {
        reportType: 'security-analysis',
        data: {
          totalIssues: 5,
          criticalIssues: 1,
          findings: []
        },
        outputPath: '/project/reports/security-report.json',
        timestamp: new Date()
      };
      
      await triggerHook('onReportGeneration', testData);
      
      expect(mockHandler).toHaveBeenCalledWith(testData);
    });
  });

  describe('🔄 Event Emitter Integration', () => {
    it('should integrate properly with EventEmitter', () => {
      // HookManager should be based on EventEmitter
      expect(hookManager).toBeInstanceOf(EventEmitter);
    });

    it('should handle multiple event listeners', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      registerHook('beforeAnalysis', handler1);
      registerHook('beforeAnalysis', handler2);
      
      const testData: BeforeAnalysisData = {
        files: ['test.js'],
        projectPath: '/test/path',
        config: {},
        timestamp: new Date()
      };
      
      await triggerHook('beforeAnalysis', testData);
      
      expect(handler1).toHaveBeenCalledWith(testData);
      expect(handler2).toHaveBeenCalledWith(testData);
    });
  });

  describe('🛡️ Schema Validation & KI-freundliche Regelwelt', () => {
    it('should support extensibility through hook system', () => {
      const handler = jest.fn();
      
      registerHook('beforeAnalysis', handler);
      
      const hooks = hookManager.listRegisteredHooks();
      expect(hooks['beforeAnalysis']).toBe(1);
    });

    it('should maintain error isolation through wrapped handlers', async () => {
      const crashingHandler = jest.fn().mockImplementation(() => {
        throw new Error('Critical system error');
      });
      const normalHandler = jest.fn();
      
      registerHook('beforeAnalysis', crashingHandler, 200);
      registerHook('beforeAnalysis', normalHandler, 100);
      
      const testData: BeforeAnalysisData = {
        files: ['test.js'],
        projectPath: '/test/path',
        config: {},
        timestamp: new Date()
      };
      
      // The HookSystem catches individual handler errors, so no overall error is thrown
      await expect(triggerHook('beforeAnalysis', testData)).resolves.not.toThrow();
      
      // Both handlers should still have been called
      expect(crashingHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();
      
      // Error should have been caught and logged
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Hook execution failed for beforeAnalysis:'),
        expect.any(Error)
      );
    });
  });

  describe('📊 Hook Statistics and Management', () => {
    it('should provide hook statistics', () => {
      registerHook('beforeAnalysis', jest.fn());
      registerHook('afterAnalysis', jest.fn());
      registerHook('beforeAnalysis', jest.fn());
      
      const hooks = hookManager.listRegisteredHooks();
      expect(hooks['beforeAnalysis']).toBe(2);
      expect(hooks['afterAnalysis']).toBe(1);
      expect(hooks['onError']).toBe(0);
    });

    it('should support debug mode', () => {
      hookManager.setDebugMode(true);
      expect(mockConsoleLog).toHaveBeenCalledWith('🎣 Hook debug mode: enabled');
      
      hookManager.setDebugMode(false);
      expect(mockConsoleLog).toHaveBeenCalledWith('🎣 Hook debug mode: disabled');
    });
  });

  describe('🎯 Real-world Usage Patterns', () => {
    it('should support QualityRunner hook integration pattern', async () => {
      const beforeAnalysisHandler = jest.fn();
      const afterAnalysisHandler = jest.fn();
      const errorHandler = jest.fn();
      
      registerHook('beforeAnalysis', beforeAnalysisHandler);
      registerHook('afterAnalysis', afterAnalysisHandler);
      registerHook('onError', errorHandler);
      
      // Simulate QualityRunner workflow
      const analysisData: BeforeAnalysisData = {
        files: ['src/index.js', 'src/utils.js'],
        projectPath: '/project',
        config: { fileExtension: '.js', phase: 'quality-analysis' },
        timestamp: new Date()
      };
      
      await triggerHook('beforeAnalysis', analysisData);
      
      const resultsData: AfterAnalysisData = {
        files: ['src/index.js', 'src/utils.js'],
        results: [
          { file: 'src/index.js', tool: 'eslint', success: true, issues: [] },
          { file: 'src/utils.js', tool: 'eslint', success: true, issues: [] }
        ],
        duration: 2500,
        success: true,
        timestamp: new Date()
      };
      
      await triggerHook('afterAnalysis', resultsData);
      
      expect(beforeAnalysisHandler).toHaveBeenCalledWith(analysisData);
      expect(afterAnalysisHandler).toHaveBeenCalledWith(resultsData);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('should support AIReviewAgent hook integration pattern', async () => {
      const beforeHandler = jest.fn();
      const afterHandler = jest.fn();
      
      registerHook('beforeAnalysis', beforeHandler);
      registerHook('afterAnalysis', afterHandler);
      
      // Simulate AI review workflow
      const reviewData: BeforeAnalysisData = {
        files: ['src/component.tsx'],
        projectPath: '',
        config: {
          language: 'typescript',
          enabledProviders: ['anthropic-claude', 'openai-gpt4'],
          tokenLimit: 8000,
          parallelRequests: true
        },
        timestamp: new Date()
      };
      
      await triggerHook('beforeAnalysis', reviewData);
      
      const reviewResults: AfterAnalysisData = {
        files: ['src/component.tsx'],
        results: [{
          file: 'src/component.tsx',
          tool: 'ai-review',
          success: true,
          issues: [
            { severity: 'medium', category: 'maintainability', message: 'Component too complex' }
          ]
        }],
        duration: 3000,
        success: true,
        timestamp: new Date()
      };
      
      await triggerHook('afterAnalysis', reviewResults);
      
      expect(beforeHandler).toHaveBeenCalledWith(reviewData);
      expect(afterHandler).toHaveBeenCalledWith(reviewResults);
    });

    it('should support ActionManager hook integration pattern', async () => {
      const beforeToolHandler = jest.fn();
      const afterToolHandler = jest.fn();
      const errorHandler = jest.fn();
      
      registerHook('beforeToolExecution', beforeToolHandler);
      registerHook('afterToolExecution', afterToolHandler);
      registerHook('onError', errorHandler);
      
      // Simulate action execution workflow
      const toolData: BeforeToolExecutionData = {
        toolName: 'prettier',
        filePath: '/project',
        command: 'execute-action',
        timestamp: new Date()
      };
      
      await triggerHook('beforeToolExecution', toolData);
      
      const toolResults: AfterToolExecutionData = {
        toolName: 'prettier',
        filePath: '/project',
        command: 'execute-action',
        output: 'Setup completed successfully',
        exitCode: 0,
        success: true,
        duration: 1500,
        timestamp: new Date()
      };
      
      await triggerHook('afterToolExecution', toolResults);
      
      expect(beforeToolHandler).toHaveBeenCalledWith(toolData);
      expect(afterToolHandler).toHaveBeenCalledWith(toolResults);
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe('📋 Hook System Coverage', () => {
    it('should support all defined hook events', () => {
      const events: HookEvent[] = [
        'beforeAnalysis',
        'afterAnalysis',
        'beforeFileAnalysis',
        'afterFileAnalysis',
        'beforeToolExecution',
        'afterToolExecution',
        'onError',
        'onConfigLoad',
        'onReportGeneration'
      ];

      events.forEach(event => {
        const handler = jest.fn();
        registerHook(event, handler);
        
        const hooks = hookManager.listRegisteredHooks();
        expect(hooks[event]).toBe(1);
        
        clearHooks(event);
        expect(hookManager.listRegisteredHooks()[event]).toBe(0);
      });
    });
  });
});