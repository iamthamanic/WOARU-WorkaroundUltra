/**
 * WOARU Activity Logger for Comprehensive Action Tracking
 * Provides detailed logging of all WOARU actions with timestamps, context, and metadata
 */

// Explain-for-humans: This system tracks every action WOARU takes, recording when commands start, succeed, or fail, along with performance metrics and context information for complete transparency.

import * as fs from 'fs-extra';
import * as path from 'path';
// Removed unused FilenameHelper import
import { APP_CONFIG } from '../config/constants';

/**
 * Structure for individual activity log entries
 */
export interface ActivityLogEntry {
  timestamp: string;
  action: string;
  command: string;
  context: {
    projectPath: string;
    workingDirectory: string;
    user?: string;
    branch?: string;
  };
  metadata: {
    filesProcessed?: number;
    duration?: number;
    success: boolean;
    error?: string;
    outputFile?: string;
  };
  performance: {
    startTime: number;
    endTime?: number;
    memoryUsage?: {
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
  };
}

/**
 * Singleton class for managing WOARU activity logging
 */
export class ActivityLogger {
  private static instance: ActivityLogger;
  private logFile: string = '';
  private activeActions: Map<string, ActivityLogEntry> = new Map();

  private constructor() {
    this.initializeAsync();
  }

  private async initializeAsync() {
    // Create logs directory in user's home
    const homeDir = (await import('os')).homedir();
    const logsDir = path.join(homeDir, APP_CONFIG.DIRECTORIES.HOME_LOGS);
    this.logFile = path.join(logsDir, APP_CONFIG.FILES.ACTIONS_LOG);

    // Ensure logs directory exists
    fs.ensureDirSync(logsDir);
  }

  /**
   * Gets the singleton instance of ActivityLogger
   * @returns The ActivityLogger instance
   */
  static getInstance(): ActivityLogger {
    if (!ActivityLogger.instance) {
      ActivityLogger.instance = new ActivityLogger();
    }
    return ActivityLogger.instance;
  }

  /**
   * Start tracking an action with context and performance metrics
   * @param action - The action being performed (e.g., 'analyze', 'review')
   * @param command - The full command being executed
   * @param context - Context information including project path, working directory, etc.
   * @returns Unique action ID for tracking completion
   */
  async startAction(
    action: string,
    command: string,
    context: {
      projectPath: string;
      workingDirectory: string;
      user?: string;
      branch?: string;
    }
  ): Promise<string> {
    // Input validation
    if (!action || typeof action !== 'string') {
      throw new Error('Action must be a non-empty string');
    }
    if (!command || typeof command !== 'string') {
      throw new Error('Command must be a non-empty string');
    }
    if (!context || !context.projectPath || !context.workingDirectory) {
      throw new Error('Context must include projectPath and workingDirectory');
    }
    // Generate unique action ID for tracking
    const actionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    const entry: ActivityLogEntry = {
      timestamp,
      action,
      command,
      context,
      metadata: {
        success: false, // Will be updated when action completes
      },
      performance: {
        startTime: Date.now(),
        memoryUsage: process.memoryUsage(),
      },
    };

    this.activeActions.set(actionId, entry);

    // Log action start
    await this.writeLogEntry(
      `[START] ${timestamp} | ${action} | ${command} | ${context.projectPath}`
    );

    return actionId;
  }

  /**
   * Complete an action with success/error details and performance metrics
   * @param actionId - The unique action ID returned from startAction
   * @param metadata - Completion metadata including success status, error details, etc.
   */
  async completeAction(
    actionId: string,
    metadata: {
      filesProcessed?: number;
      success: boolean;
      error?: string;
      outputFile?: string;
    }
  ): Promise<void> {
    // Input validation
    if (!actionId || typeof actionId !== 'string') {
      throw new Error('Action ID must be a non-empty string');
    }
    if (!metadata || typeof metadata.success !== 'boolean') {
      throw new Error('Metadata must include success boolean');
    }
    const entry = this.activeActions.get(actionId);
    if (!entry) {
      console.warn(`ActivityLogger: Action ${actionId} not found`);
      return;
    }

    const endTime = Date.now();
    const duration = endTime - entry.performance.startTime;

    // Update entry
    entry.metadata = { ...entry.metadata, ...metadata, duration };
    entry.performance.endTime = endTime;
    entry.performance.memoryUsage = process.memoryUsage();

    // Log completion
    const status = metadata.success ? 'SUCCESS' : 'ERROR';
    const errorSuffix = metadata.error ? ` | Error: ${metadata.error}` : '';
    const outputSuffix = metadata.outputFile
      ? ` | Output: ${metadata.outputFile}`
      : '';

    await this.writeLogEntry(
      `[${status}] ${new Date().toISOString()} | ${entry.action} | Duration: ${duration}ms${errorSuffix}${outputSuffix}`
    );

    // Remove from active actions
    this.activeActions.delete(actionId);
  }

  /**
   * Log a simple event (without start/complete cycle)
   * @param action - The action being logged
   * @param command - The command being executed
   * @param context - Context information
   * @param metadata - Event metadata including success status
   */
  async logEvent(
    action: string,
    command: string,
    context: {
      projectPath: string;
      workingDirectory: string;
      user?: string;
      branch?: string;
    },
    metadata: {
      filesProcessed?: number;
      success: boolean;
      error?: string;
      outputFile?: string;
    }
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const status = metadata.success ? 'SUCCESS' : 'ERROR';
    const errorSuffix = metadata.error ? ` | Error: ${metadata.error}` : '';
    const outputSuffix = metadata.outputFile
      ? ` | Output: ${metadata.outputFile}`
      : '';

    await this.writeLogEntry(
      `[${status}] ${timestamp} | ${action} | ${command} | ${context.projectPath}${errorSuffix}${outputSuffix}`
    );
  }

  /**
   * Get recent log entries
   * @param limit - Maximum number of log entries to return (default: 50)
   * @returns Array of recent log entries
   */
  async getRecentLogs(limit: number = 50): Promise<string[]> {
    // Input validation
    if (typeof limit !== 'number' || limit < 1) {
      throw new Error('Limit must be a positive number');
    }

    if (!(await fs.pathExists(this.logFile))) {
      return [];
    }

    const content = await fs.readFile(this.logFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    // Return last N lines
    return lines.slice(-limit);
  }

  /**
   * Get logs for a specific time range
   * @param startDate - Start date for filtering
   * @param endDate - End date for filtering
   * @returns Array of log entries within the date range
   */
  async getLogsByDateRange(startDate: Date, endDate: Date): Promise<string[]> {
    // Input validation
    if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
      throw new Error('Start and end dates must be Date objects');
    }
    if (startDate > endDate) {
      throw new Error('Start date must be before end date');
    }

    const logs = await this.getRecentLogs(1000); // Get more logs for filtering

    return logs.filter(log => {
      const timestampMatch = log.match(
        /\[(?:START|SUCCESS|ERROR)\] (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/
      );
      if (!timestampMatch) return false;

      const logDate = new Date(timestampMatch[1]);
      return logDate >= startDate && logDate <= endDate;
    });
  }

  /**
   * Get logs for a specific action type
   * @param actionType - The action type to filter by (e.g., 'analyze', 'review')
   * @returns Array of log entries for the specified action type
   */
  async getLogsByAction(actionType: string): Promise<string[]> {
    // Input validation
    if (!actionType || typeof actionType !== 'string') {
      throw new Error('Action type must be a non-empty string');
    }

    const logs = await this.getRecentLogs(1000);

    return logs.filter(log => log.includes(`| ${actionType} |`));
  }

  /**
   * Get logs for a specific project
   * @param projectPath - The project path to filter by
   * @returns Array of log entries for the specified project
   */
  async getLogsByProject(projectPath: string): Promise<string[]> {
    // Input validation
    if (!projectPath || typeof projectPath !== 'string') {
      throw new Error('Project path must be a non-empty string');
    }

    const logs = await this.getRecentLogs(1000);

    return logs.filter(log => log.includes(projectPath));
  }

  /**
   * Clear all logs (dangerous operation)
   * @returns Promise that resolves when logs are cleared
   */
  async clearLogs(): Promise<void> {
    if (await fs.pathExists(this.logFile)) {
      await fs.remove(this.logFile);
    }
  }

  /**
   * Get log file path
   * @returns The absolute path to the log file
   */
  getLogFilePath(): string {
    return this.logFile;
  }

  /**
   * Get log file size and statistics
   * @returns Object containing log file statistics
   */
  async getLogStats(): Promise<{
    fileSize: number;
    totalLines: number;
    oldestEntry?: string;
    newestEntry?: string;
  }> {
    if (!(await fs.pathExists(this.logFile))) {
      return { fileSize: 0, totalLines: 0 };
    }

    const stats = await fs.stat(this.logFile);
    const content = await fs.readFile(this.logFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    return {
      fileSize: stats.size,
      totalLines: lines.length,
      oldestEntry: lines.length > 0 ? lines[0] : undefined,
      newestEntry: lines.length > 0 ? lines[lines.length - 1] : undefined,
    };
  }

  /**
   * Write log entry to file (private method)
   * @param entry - The log entry string to write
   */
  private async writeLogEntry(entry: string): Promise<void> {
    try {
      await fs.appendFile(this.logFile, entry + '\n', 'utf-8');
    } catch (error) {
      console.error('ActivityLogger: Failed to write log entry:', error);
    }
  }

  /**
   * Get current active actions (for monitoring purposes)
   * @returns Map of active action IDs to their log entries
   */
  getActiveActions(): Map<string, ActivityLogEntry> {
    return new Map(this.activeActions);
  }

  /**
   * Format log entry for display
   * @param logLine - Raw log line to format
   * @returns Formatted log entry object or null if parsing fails
   */
  formatLogEntry(logLine: string): {
    timestamp: string;
    status: string;
    action: string;
    details: string;
  } | null {
    const match = logLine.match(
      /\[(START|SUCCESS|ERROR)\] (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) \| ([^|]+) \| (.+)/
    );

    if (!match) {
      return null;
    }

    return {
      timestamp: match[2],
      status: match[1],
      action: match[3].trim(),
      details: match[4].trim(),
    };
  }

  /**
   * Export logs to different formats
   * @param format - Export format ('json', 'csv', 'txt')
   * @param outputPath - Path where to save the exported logs
   */
  async exportLogs(
    format: 'json' | 'csv' | 'txt',
    outputPath: string
  ): Promise<void> {
    // Input validation
    if (!['json', 'csv', 'txt'].includes(format)) {
      throw new Error('Format must be one of: json, csv, txt');
    }
    if (!outputPath || typeof outputPath !== 'string') {
      throw new Error('Output path must be a non-empty string');
    }

    const logs = await this.getRecentLogs(1000);

    switch (format) {
      case 'json': {
        const jsonLogs = logs
          .map(log => this.formatLogEntry(log))
          .filter(Boolean);
        await fs.writeFile(
          outputPath,
          JSON.stringify(jsonLogs, null, 2),
          'utf-8'
        );
        break;
      }

      case 'csv': {
        const csvHeader = 'Timestamp,Status,Action,Details\n';
        const csvLines = logs
          .map(log => this.formatLogEntry(log))
          .filter(Boolean)
          .map(entry => {
            if (!entry) return '';
            return `"${entry.timestamp}","${entry.status}","${entry.action}","${entry.details}"`;
          })
          .join('\n');
        await fs.writeFile(outputPath, csvHeader + csvLines, 'utf-8');
        break;
      }

      case 'txt':
      default:
        await fs.writeFile(outputPath, logs.join('\n'), 'utf-8');
        break;
    }
  }
}
