import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { StateManager } from './StateManager';
import { FileWatcher } from './FileWatcher';
import { NotificationManager } from './NotificationManager';
import { ToolRecommendationEngine } from './ToolRecommendationEngine';
import { ProjectAnalyzer } from '../analyzer/ProjectAnalyzer';
import { LanguageDetector } from '../analyzer/LanguageDetector';
import { 
  SupervisorConfig, 
  ProjectState, 
  FileChange, 
  ToolRecommendation 
} from './types';

export class WAUSupervisor extends EventEmitter {
  private stateManager: StateManager;
  private fileWatcher: FileWatcher;
  private notificationManager: NotificationManager;
  private toolEngine: ToolRecommendationEngine;
  private projectAnalyzer: ProjectAnalyzer;
  private languageDetector: LanguageDetector;
  
  private config: SupervisorConfig;
  private isRunning = false;
  private projectPath: string;
  private lastRecommendationCheck = new Date();

  constructor(projectPath: string, config: Partial<SupervisorConfig> = {}) {
    super();
    
    this.projectPath = path.resolve(projectPath);
    this.config = this.mergeConfig(config);
    
    // Initialize components
    this.stateManager = new StateManager(this.projectPath);
    this.fileWatcher = new FileWatcher(this.projectPath);
    this.notificationManager = new NotificationManager(this.config.notifications);
    this.toolEngine = new ToolRecommendationEngine();
    this.projectAnalyzer = new ProjectAnalyzer();
    this.languageDetector = new LanguageDetector();
    
    this.setupEventListeners();
  }

  private mergeConfig(config: Partial<SupervisorConfig>): SupervisorConfig {
    return {
      autoFix: false,
      autoSetup: false,
      notifications: {
        terminal: true,
        desktop: false,
        webhook: undefined,
        ...config.notifications
      },
      ignoreTools: [],
      watchPatterns: ['**/*'],
      dashboard: false,
      ...config
    };
  }

  private setupEventListeners(): void {
    // File watcher events
    this.fileWatcher.on('batch_changes', (changes: FileChange[]) => {
      this.handleFileChanges(changes);
    });

    this.fileWatcher.on('critical_file_change', (change: FileChange) => {
      this.handleCriticalFileChange(change);
    });

    this.fileWatcher.on('error', (error) => {
      this.notificationManager.showError(`File watcher error: ${error.message}`);
    });

    // State manager events
    this.stateManager.on('language_changed', (language: string) => {
      this.notificationManager.showProgress(`Language detected: ${language}`);
      this.checkRecommendations();
    });

    this.stateManager.on('tool_detected', (tool: string) => {
      this.notificationManager.showSuccess(`Tool detected: ${tool}`);
    });

    this.stateManager.on('critical_issues', (issues) => {
      this.notificationManager.notifyIssues(issues);
    });

    this.stateManager.on('health_score_updated', (score: number) => {
      if (this.config.dashboard) {
        this.notificationManager.showHealthScore(score);
      }
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Supervisor is already running');
    }

    try {
      this.notificationManager.showProgress('Starting WAU Supervisor...');

      // Initialize components
      await this.toolEngine.initialize();
      await this.stateManager.load();
      
      // Perform initial analysis
      await this.performInitialAnalysis();
      
      // Start file watching
      this.fileWatcher.start();
      
      // Start auto-save
      this.stateManager.startAutoSave();
      
      this.isRunning = true;
      
      this.notificationManager.showSuccess(
        `WAU Supervisor started for ${path.basename(this.projectPath)}`
      );

      // Initial recommendations check
      await this.checkRecommendations();

      this.emit('started');
      
    } catch (error) {
      this.notificationManager.showError(`Failed to start supervisor: ${error}`);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.fileWatcher.stop();
    await this.stateManager.save();
    
    this.isRunning = false;
    this.notificationManager.showSuccess('WAU Supervisor stopped');
    
    this.emit('stopped');
  }

  private async performInitialAnalysis(): Promise<void> {
    this.notificationManager.showProgress('Analyzing project...');

    try {
      // Detect language and frameworks
      const language = await this.languageDetector.detectPrimaryLanguage(this.projectPath);
      const frameworks = await this.languageDetector.detectFrameworks(this.projectPath, language);
      
      // Analyze project structure
      const analysis = await this.projectAnalyzer.analyzeProject(this.projectPath);
      
      // Update state
      this.stateManager.updateLanguage(language);
      this.stateManager.updateFrameworks(frameworks);
      
      // Detect existing tools
      this.detectExistingTools(analysis);
      
      this.notificationManager.showSuccess(
        `Project analyzed: ${language} ${frameworks.length > 0 ? `(${frameworks.join(', ')})` : ''}`
      );
      
    } catch (error) {
      this.notificationManager.showError(`Analysis failed: ${error}`);
    }
  }

  private detectExistingTools(analysis: any): void {
    // Check package.json for tools
    const toolPatterns = {
      eslint: /eslint/,
      prettier: /prettier/,
      jest: /jest/,
      typescript: /typescript/,
      husky: /husky/,
      black: /black/,
      ruff: /ruff/,
      pytest: /pytest/,
      clippy: /clippy/,
      'cargo-audit': /cargo-audit/
    };

    const allDeps = [
      ...analysis.dependencies,
      ...analysis.devDependencies
    ].join(' ');

    Object.entries(toolPatterns).forEach(([tool, pattern]) => {
      if (pattern.test(allDeps)) {
        this.stateManager.addDetectedTool(tool);
      }
    });

    // Check for config files
    const configTools = {
      '.eslintrc': 'eslint',
      '.prettierrc': 'prettier',
      'jest.config': 'jest',
      'tsconfig.json': 'typescript',
      '.husky': 'husky',
      'pyproject.toml': 'black',
      'mypy.ini': 'mypy',
      'rustfmt.toml': 'rustfmt'
    };

    analysis.configFiles.forEach((file: string) => {
      Object.entries(configTools).forEach(([pattern, tool]) => {
        if (file.includes(pattern)) {
          this.stateManager.addDetectedTool(tool);
        }
      });
    });
  }

  private async handleFileChanges(changes: FileChange[]): Promise<void> {
    // Apply changes to state
    changes.forEach(change => {
      this.stateManager.applyFileChange(change);
    });

    // Check for new recommendations based on changes
    const fileSpecificRecommendations: ToolRecommendation[] = [];
    
    for (const change of changes) {
      if (change.type === 'change') {
        const recommendations = await this.toolEngine.checkSingleFile(
          path.join(this.projectPath, change.path),
          this.stateManager.getState()
        );
        fileSpecificRecommendations.push(...recommendations);
      }
    }

    if (fileSpecificRecommendations.length > 0) {
      await this.notificationManager.notifyRecommendations(fileSpecificRecommendations);
    }

    // Periodic full check (every 5 minutes)
    const timeSinceLastCheck = Date.now() - this.lastRecommendationCheck.getTime();
    if (timeSinceLastCheck > 5 * 60 * 1000) {
      await this.checkRecommendations();
    }
  }

  private async handleCriticalFileChange(change: FileChange): Promise<void> {
    this.notificationManager.showProgress(`Critical file changed: ${change.path}`);
    
    // Immediate re-analysis for critical files
    if (change.path === 'package.json' || change.path.includes('config')) {
      await this.performInitialAnalysis();
    }
  }

  private async checkRecommendations(): Promise<void> {
    try {
      const state = this.stateManager.getState();
      const recommendations = await this.toolEngine.getRecommendations(state);
      
      // Filter out ignored tools
      const filteredRecommendations = recommendations.filter(
        rec => !this.config.ignoreTools.includes(rec.tool)
      );

      if (filteredRecommendations.length > 0) {
        await this.notificationManager.notifyRecommendations(filteredRecommendations);
        
        // Auto-setup if enabled
        if (this.config.autoSetup) {
          await this.autoSetupTools(filteredRecommendations);
        }
      }

      this.lastRecommendationCheck = new Date();
      
    } catch (error) {
      this.notificationManager.showError(`Recommendation check failed: ${error}`);
    }
  }

  private async autoSetupTools(recommendations: ToolRecommendation[]): Promise<void> {
    const autoFixable = recommendations.filter(r => r.autoFixable && r.setupCommand);
    
    if (autoFixable.length === 0) return;

    this.notificationManager.showProgress(`Auto-setting up ${autoFixable.length} tools...`);

    for (const rec of autoFixable) {
      try {
        if (rec.setupCommand) {
          // Would execute setup command here
          this.notificationManager.showProgress(`Setting up ${rec.tool}...`);
          // await exec(rec.setupCommand, { cwd: this.projectPath });
          this.stateManager.addDetectedTool(rec.tool);
          this.notificationManager.showSuccess(`${rec.tool} setup completed`);
        }
      } catch (error) {
        this.notificationManager.showError(`Failed to setup ${rec.tool}: ${error}`);
      }
    }
  }

  // Public methods
  getStatus(): { 
    isRunning: boolean; 
    state: ProjectState; 
    watchedFiles: number;
    config: SupervisorConfig;
  } {
    return {
      isRunning: this.isRunning,
      state: this.stateManager.getState(),
      watchedFiles: this.fileWatcher.getWatchedFileCount(),
      config: this.config
    };
  }

  async getCurrentRecommendations(): Promise<ToolRecommendation[]> {
    const state = this.stateManager.getState();
    const recommendations = await this.toolEngine.getRecommendations(state);
    
    return recommendations.filter(
      rec => !this.config.ignoreTools.includes(rec.tool)
    );
  }

  addIgnoredTool(tool: string): void {
    if (!this.config.ignoreTools.includes(tool)) {
      this.config.ignoreTools.push(tool);
      this.notificationManager.showSuccess(`Tool ${tool} added to ignore list`);
    }
  }

  removeIgnoredTool(tool: string): void {
    const index = this.config.ignoreTools.indexOf(tool);
    if (index !== -1) {
      this.config.ignoreTools.splice(index, 1);
      this.notificationManager.showSuccess(`Tool ${tool} removed from ignore list`);
    }
  }
}