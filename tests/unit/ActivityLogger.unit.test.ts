/**
 * Comprehensive Unit Tests for ActivityLogger
 * Tests all functionality required for 95%+ coverage
 */

import { ActivityLogger, ActivityLogEntry } from '../../src/utils/ActivityLogger';
import * as fs from 'fs-extra';
import * as path from 'path';
import { APP_CONFIG } from '../../src/config/constants';

// Mock fs-extra
jest.mock('fs-extra', () => ({
  ensureDirSync: jest.fn(),
  appendFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(''),
  pathExists: jest.fn().mockResolvedValue(true),
  stat: jest.fn().mockResolvedValue({ size: 100 }),
  remove: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn((...args: string[]) => args.join('/')),
}));

// Mock os module
jest.mock('os', () => ({
  homedir: jest.fn(() => '/mock/home'),
}));

// Mock constants
jest.mock('../../src/config/constants', () => ({
  APP_CONFIG: {
    DIRECTORIES: {
      HOME_LOGS: '.woaru/logs',
    },
    FILES: {
      ACTIONS_LOG: 'actions.log',
    },
  },
}));

describe('ActivityLogger Unit Tests', () => {
  let activityLogger: ActivityLogger;
  const mockLogFile = '/mock/home/.woaru/logs/actions.log';
  const mockLogsDir = '/mock/home/.woaru/logs';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton instance
    (ActivityLogger as any).instance = undefined;
    
    // Setup path mocks
    mockedPath.join.mockImplementation((...args) => args.join('/'));
    
    // Reset fs mocks
    const mockedFs = jest.mocked(fs);
    mockedFs.readFile.mockResolvedValue('');
    mockedFs.pathExists.mockResolvedValue(true);
    mockedFs.stat.mockResolvedValue({ size: 100 } as any);

    activityLogger = ActivityLogger.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = ActivityLogger.getInstance();
      const instance2 = ActivityLogger.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize with correct log file path', () => {
      expect(mockedPath.join).toHaveBeenCalledWith('/mock/home', '.woaru/logs');
      expect(mockedPath.join).toHaveBeenCalledWith(mockLogsDir, 'actions.log');
      expect(mockedFs.ensureDirSync).toHaveBeenCalledWith(mockLogsDir);
    });
  });

  describe('startAction() Functionality', () => {
    const validContext = {
      projectPath: '/test/project',
      workingDirectory: '/test/project',
      user: 'testuser',
      branch: 'main',
    };

    it('should start action and return action ID', async () => {
      const actionId = await activityLogger.startAction('analyze', 'woaru analyze', validContext);
      
      expect(actionId).toMatch(/^\d+-[a-z0-9]{9}$/);
      expect(mockedFs.appendFile).toHaveBeenCalledWith(
        mockLogFile,
        expect.stringContaining('[START]'),
        'utf-8'
      );
    });

    it('should validate required parameters', async () => {
      await expect(activityLogger.startAction('', 'cmd', validContext))
        .rejects.toThrow('Action must be a non-empty string');
      
      await expect(activityLogger.startAction('action', '', validContext))
        .rejects.toThrow('Command must be a non-empty string');
      
      await expect(activityLogger.startAction('action', 'cmd', {} as any))
        .rejects.toThrow('Context must include projectPath and workingDirectory');
    });

    it('should track active actions correctly', async () => {
      const actionId = await activityLogger.startAction('analyze', 'woaru analyze', validContext);
      const activeActions = activityLogger.getActiveActions();
      
      expect(activeActions.has(actionId)).toBe(true);
      expect(activeActions.get(actionId)?.action).toBe('analyze');
    });

    it('should include memory usage in performance metrics', async () => {
      const actionId = await activityLogger.startAction('analyze', 'woaru analyze', validContext);
      const activeActions = activityLogger.getActiveActions();
      const entry = activeActions.get(actionId);
      
      expect(entry?.performance.memoryUsage).toBeDefined();
      expect(entry?.performance.memoryUsage?.heapUsed).toBeGreaterThan(0);
    });
  });

  describe('completeAction() Functionality', () => {
    let actionId: string;
    const validContext = {
      projectPath: '/test/project',
      workingDirectory: '/test/project',
    };

    beforeEach(async () => {
      actionId = await activityLogger.startAction('analyze', 'woaru analyze', validContext);
    });

    it('should complete action successfully', async () => {
      const metadata = {
        filesProcessed: 5,
        success: true,
        outputFile: 'report.json',
      };

      await activityLogger.completeAction(actionId, metadata);
      
      expect(mockedFs.appendFile).toHaveBeenCalledWith(
        mockLogFile,
        expect.stringContaining('[SUCCESS]'),
        'utf-8'
      );
      
      // Action should be removed from active actions
      expect(activityLogger.getActiveActions().has(actionId)).toBe(false);
    });

    it('should handle error completion', async () => {
      const metadata = {
        success: false,
        error: 'Test error message',
      };

      await activityLogger.completeAction(actionId, metadata);
      
      expect(mockedFs.appendFile).toHaveBeenCalledWith(
        mockLogFile,
        expect.stringContaining('[ERROR]'),
        'utf-8'
      );
    });

    it('should validate completion parameters', async () => {
      await expect(activityLogger.completeAction('', { success: true }))
        .rejects.toThrow('Action ID must be a non-empty string');
      
      await expect(activityLogger.completeAction(actionId, {} as any))
        .rejects.toThrow('Metadata must include success boolean');
    });

    it('should handle non-existent action ID gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await activityLogger.completeAction('non-existent', { success: true });
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Action non-existent not found')
      );
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('logEvent() Functionality', () => {
    const validContext = {
      projectPath: '/test/project',
      workingDirectory: '/test/project',
    };

    it('should log simple event successfully', async () => {
      const metadata = {
        success: true,
        filesProcessed: 3,
      };

      await activityLogger.logEvent('test', 'woaru test', validContext, metadata);
      
      expect(mockedFs.appendFile).toHaveBeenCalledWith(
        mockLogFile,
        expect.stringContaining('[SUCCESS]'),
        'utf-8'
      );
    });

    it('should log error event with error details', async () => {
      const metadata = {
        success: false,
        error: 'Test error',
      };

      await activityLogger.logEvent('test', 'woaru test', validContext, metadata);
      
      expect(mockedFs.appendFile).toHaveBeenCalledWith(
        mockLogFile,
        expect.stringContaining('Error: Test error'),
        'utf-8'
      );
    });
  });

  describe('getRecentLogs() Functionality', () => {
    it('should return recent logs with default limit', async () => {
      const mockLogContent = '[SUCCESS] 2023-01-01T00:00:00.000Z | test | cmd | /project\n[ERROR] 2023-01-01T00:01:00.000Z | test2 | cmd2 | /project';
      mockedFs.readFile.mockResolvedValue(mockLogContent);

      const logs = await activityLogger.getRecentLogs();
      
      expect(logs).toHaveLength(2);
      expect(logs[0]).toContain('[SUCCESS]');
      expect(logs[1]).toContain('[ERROR]');
    });

    it('should handle custom limit', async () => {
      const mockLogContent = 'line1\nline2\nline3\nline4\nline5';
      mockedFs.readFile.mockResolvedValue(mockLogContent);

      const logs = await activityLogger.getRecentLogs(3);
      
      expect(logs).toHaveLength(3);
      expect(logs).toEqual(['line3', 'line4', 'line5']);
    });

    it('should return empty array if log file does not exist', async () => {
      mockedFs.pathExists.mockResolvedValue(false);

      const logs = await activityLogger.getRecentLogs();
      
      expect(logs).toEqual([]);
    });

    it('should validate limit parameter', async () => {
      await expect(activityLogger.getRecentLogs(0))
        .rejects.toThrow('Limit must be a positive number');
      
      await expect(activityLogger.getRecentLogs(-1))
        .rejects.toThrow('Limit must be a positive number');
    });
  });

  describe('getLogsByDateRange() Functionality', () => {
    it('should filter logs by date range', async () => {
      const mockLogContent = `[SUCCESS] 2023-01-01T00:00:00.000Z | test1 | cmd | /project
[ERROR] 2023-01-02T00:00:00.000Z | test2 | cmd | /project
[SUCCESS] 2023-01-03T00:00:00.000Z | test3 | cmd | /project`;
      mockedFs.readFile.mockResolvedValue(mockLogContent);

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-02');
      
      const logs = await activityLogger.getLogsByDateRange(startDate, endDate);
      
      expect(logs).toHaveLength(2);
      expect(logs[0]).toContain('test1');
      expect(logs[1]).toContain('test2');
    });

    it('should validate date parameters', async () => {
      const validDate = new Date();
      
      await expect(activityLogger.getLogsByDateRange('invalid' as any, validDate))
        .rejects.toThrow('Start and end dates must be Date objects');
      
      await expect(activityLogger.getLogsByDateRange(new Date('2023-01-02'), new Date('2023-01-01')))
        .rejects.toThrow('Start date must be before end date');
    });
  });

  describe('getLogsByAction() and getLogsByProject()', () => {
    it('should filter logs by action type', async () => {
      const mockLogContent = `[SUCCESS] 2023-01-01T00:00:00.000Z | analyze | cmd | /project
[ERROR] 2023-01-02T00:00:00.000Z | review | cmd | /project`;
      mockedFs.readFile.mockResolvedValue(mockLogContent);

      const logs = await activityLogger.getLogsByAction('analyze');
      
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain('analyze');
    });

    it('should filter logs by project path', async () => {
      const mockLogContent = `[SUCCESS] 2023-01-01T00:00:00.000Z | test | cmd | /project1
[ERROR] 2023-01-02T00:00:00.000Z | test | cmd | /project2`;
      mockedFs.readFile.mockResolvedValue(mockLogContent);

      const logs = await activityLogger.getLogsByProject('/project1');
      
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain('/project1');
    });

    it('should validate string parameters', async () => {
      await expect(activityLogger.getLogsByAction(''))
        .rejects.toThrow('Action type must be a non-empty string');
      
      await expect(activityLogger.getLogsByProject(''))
        .rejects.toThrow('Project path must be a non-empty string');
    });
  });

  describe('File Management', () => {
    it('should clear all logs', async () => {
      await activityLogger.clearLogs();
      
      expect(mockedFs.remove).toHaveBeenCalledWith(mockLogFile);
    });

    it('should get log file path', () => {
      const filePath = activityLogger.getLogFilePath();
      expect(filePath).toBe(mockLogFile);
    });

    it('should get log statistics', async () => {
      const mockLogContent = 'line1\nline2\nline3';
      mockedFs.readFile.mockResolvedValue(mockLogContent);

      const stats = await activityLogger.getLogStats();
      
      expect(stats.fileSize).toBe(100);
      expect(stats.totalLines).toBe(3);
      expect(stats.oldestEntry).toBe('line1');
      expect(stats.newestEntry).toBe('line3');
    });

    it('should handle missing log file in statistics', async () => {
      mockedFs.pathExists.mockResolvedValue(false);

      const stats = await activityLogger.getLogStats();
      
      expect(stats.fileSize).toBe(0);
      expect(stats.totalLines).toBe(0);
    });
  });

  describe('Log Export Functionality', () => {
    beforeEach(() => {
      const mockLogContent = `[SUCCESS] 2023-01-01T00:00:00.000Z | test | cmd | /project
[ERROR] 2023-01-02T00:00:00.000Z | test2 | cmd2 | /project2`;
      mockedFs.readFile.mockResolvedValue(mockLogContent);
    });

    it('should export logs to JSON format', async () => {
      await activityLogger.exportLogs('json', '/tmp/export.json');
      
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        '/tmp/export.json',
        expect.stringContaining('"timestamp"'),
        'utf-8'
      );
    });

    it('should export logs to CSV format', async () => {
      await activityLogger.exportLogs('csv', '/tmp/export.csv');
      
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        '/tmp/export.csv',
        expect.stringContaining('Timestamp,Status,Action,Details'),
        'utf-8'
      );
    });

    it('should export logs to TXT format', async () => {
      await activityLogger.exportLogs('txt', '/tmp/export.txt');
      
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        '/tmp/export.txt',
        expect.stringContaining('[SUCCESS]'),
        'utf-8'
      );
    });

    it('should validate export parameters', async () => {
      await expect(activityLogger.exportLogs('invalid' as any, '/tmp/test'))
        .rejects.toThrow('Format must be one of: json, csv, txt');
      
      await expect(activityLogger.exportLogs('json', ''))
        .rejects.toThrow('Output path must be a non-empty string');
    });
  });

  describe('formatLogEntry() Utility', () => {
    it('should format valid log entry', () => {
      const logLine = '[SUCCESS] 2023-01-01T00:00:00.000Z | analyze | woaru analyze /project | /test/project';
      
      const formatted = activityLogger.formatLogEntry(logLine);
      
      expect(formatted).toEqual({
        timestamp: '2023-01-01T00:00:00.000Z',
        status: 'SUCCESS',
        action: 'analyze',
        details: 'woaru analyze /project | /test/project',
      });
    });

    it('should return null for invalid log entry', () => {
      const invalidLogLine = 'invalid log format';
      
      const formatted = activityLogger.formatLogEntry(invalidLogLine);
      
      expect(formatted).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle write errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockedFs.appendFile.mockRejectedValue(new Error('Write failed'));

      const validContext = {
        projectPath: '/test/project',
        workingDirectory: '/test/project',
      };

      // Should not throw
      await activityLogger.startAction('test', 'cmd', validContext);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to write log entry'),
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle file system errors in statistics', async () => {
      mockedFs.stat.mockRejectedValue(new Error('Stat failed'));
      mockedFs.pathExists.mockResolvedValue(true);

      await expect(activityLogger.getLogStats()).rejects.toThrow('Stat failed');
    });
  });
});