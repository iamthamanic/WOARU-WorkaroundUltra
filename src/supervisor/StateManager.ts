import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ProjectState, FileChange, CodeIssue } from './types';

class StateOperationLock {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    while (this.queue.length > 0) {
      const operation = this.queue.shift()!;
      await operation();
    }
    this.processing = false;
  }
}

export class StateManager extends EventEmitter {
  private state: ProjectState;
  private stateFile: string;
  private saveInProgress = false;
  private autoSaveInterval?: NodeJS.Timeout;
  private readonly stateLock = new StateOperationLock();

  constructor(projectPath: string) {
    super();
    this.stateFile = path.join(projectPath, '.wau', 'state.json');
    this.state = this.initializeState(projectPath);
  }

  private initializeState(projectPath: string): ProjectState {
    return {
      projectPath,
      language: 'unknown',
      frameworks: [],
      detectedTools: new Set(),
      missingTools: new Set(),
      codeIssues: new Map(),
      lastAnalysis: new Date(),
      healthScore: 0,
      fileCount: 0,
      watchedFiles: new Set(),
    };
  }

  async load(): Promise<void> {
    try {
      if (await fs.pathExists(this.stateFile)) {
        const savedState = await fs.readJson(this.stateFile);

        // Reconstruct Sets and Maps
        this.state = {
          ...savedState,
          detectedTools: new Set(savedState.detectedTools),
          missingTools: new Set(savedState.missingTools),
          codeIssues: new Map(savedState.codeIssues),
          watchedFiles: new Set(savedState.watchedFiles),
          lastAnalysis: new Date(savedState.lastAnalysis),
        };
      }
    } catch (error) {
      console.warn('Could not load previous state, starting fresh');
    }
  }

  async save(): Promise<void> {
    return this.stateLock.execute(async () => {
      if (this.saveInProgress) {
        return; // Skip if save is already in progress
      }

      this.saveInProgress = true;
      try {
        await fs.ensureDir(path.dirname(this.stateFile));

        // Convert Sets and Maps for JSON serialization
        const serializableState = {
          ...this.state,
          detectedTools: Array.from(this.state.detectedTools),
          missingTools: Array.from(this.state.missingTools),
          codeIssues: Array.from(this.state.codeIssues.entries()),
          watchedFiles: Array.from(this.state.watchedFiles),
        };

        // Atomic write using temporary file
        const tempFile = `${this.stateFile}.tmp`;
        await fs.writeJson(tempFile, serializableState, { spaces: 2 });
        await fs.move(tempFile, this.stateFile, { overwrite: true });

        this.emit('state_saved');
      } catch (error) {
        console.error('Failed to save state:', error);
        throw error;
      } finally {
        this.saveInProgress = false;
      }
    });
  }

  getState(): ProjectState {
    return { ...this.state };
  }

  updateLanguage(language: string): void {
    this.stateLock.execute(async () => {
      if (this.state.language !== language) {
        this.state.language = language;
        this.markDirty();
        this.emit('language_changed', language);
      }
    });
  }

  updateFrameworks(frameworks: string[]): void {
    this.stateLock.execute(async () => {
      const frameworksChanged =
        JSON.stringify(this.state.frameworks) !== JSON.stringify(frameworks);
      if (frameworksChanged) {
        this.state.frameworks = frameworks;
        this.markDirty();
        this.emit('frameworks_changed', frameworks);
      }
    });
  }

  addDetectedTool(tool: string): void {
    this.stateLock.execute(async () => {
      if (!this.state.detectedTools.has(tool)) {
        this.state.detectedTools.add(tool);
        this.state.missingTools.delete(tool);
        this.markDirty();
        this.emit('tool_detected', tool);
      }
    });
  }

  addMissingTool(tool: string): void {
    this.stateLock.execute(async () => {
      if (
        !this.state.missingTools.has(tool) &&
        !this.state.detectedTools.has(tool)
      ) {
        this.state.missingTools.add(tool);
        this.markDirty();
        this.emit('tool_missing', tool);
      }
    });
  }

  updateCodeIssues(file: string, issues: CodeIssue[]): void {
    this.stateLock.execute(async () => {
      const previousIssues = this.state.codeIssues.get(file) || [];

      if (issues.length === 0) {
        this.state.codeIssues.delete(file);
      } else {
        this.state.codeIssues.set(file, issues);
      }

      // Check for new critical issues
      const newCritical = issues.filter(
        i =>
          i.severity === 'critical' &&
          !previousIssues.some(p => p.type === i.type && p.line === i.line)
      );

      if (newCritical.length > 0) {
        this.emit('critical_issues', newCritical);
      }

      this.markDirty();
      this.updateHealthScore();
    });
  }

  addWatchedFile(filePath: string): void {
    if (!this.state.watchedFiles.has(filePath)) {
      this.state.watchedFiles.add(filePath);
      this.state.fileCount = this.state.watchedFiles.size;
      this.markDirty();
    }
  }

  removeWatchedFile(filePath: string): void {
    if (this.state.watchedFiles.has(filePath)) {
      this.state.watchedFiles.delete(filePath);
      this.state.codeIssues.delete(filePath);
      this.state.fileCount = this.state.watchedFiles.size;
      this.markDirty();
    }
  }

  applyFileChange(change: FileChange): void {
    switch (change.type) {
      case 'add':
        this.addWatchedFile(change.path);
        break;
      case 'unlink':
        this.removeWatchedFile(change.path);
        break;
      case 'change':
        // Will trigger re-analysis
        break;
    }
  }

  private updateHealthScore(): void {
    const toolCoverage = this.calculateToolCoverage();
    const issueScore = this.calculateIssueScore();

    this.state.healthScore = Math.round((toolCoverage + issueScore) / 2);
    this.emit('health_score_updated', this.state.healthScore);
  }

  private calculateToolCoverage(): number {
    const totalTools =
      this.state.detectedTools.size + this.state.missingTools.size;
    if (totalTools === 0) return 100;

    return Math.round((this.state.detectedTools.size / totalTools) * 100);
  }

  private calculateIssueScore(): number {
    let totalScore = 100;
    const allIssues = Array.from(this.state.codeIssues.values()).flat();

    // Deduct points based on severity
    const severityPenalty = {
      critical: 10,
      high: 5,
      medium: 2,
      low: 1,
    };

    allIssues.forEach(issue => {
      totalScore -= severityPenalty[issue.severity];
    });

    return Math.max(0, totalScore);
  }

  // Auto-save every 30 seconds
  startAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    this.autoSaveInterval = setInterval(async () => {
      try {
        await this.save();
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 30000);
  }

  stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = undefined;
    }
  }

  private markDirty(): void {
    // State is always considered dirty after any mutation
    // Removed dirty flag as we now save on every change
  }

  async destroy(): Promise<void> {
    this.stopAutoSave();
    await this.save();
    this.removeAllListeners();
  }
}
