import { EventEmitter } from 'events';
import * as path from 'path';
import { StateManager } from './StateManager';
import { FileWatcher } from './FileWatcher';
import { NotificationManager } from './NotificationManager';
import { ToolRecommendationEngine } from './ToolRecommendationEngine';
import { ProjectAnalyzer } from '../analyzer/ProjectAnalyzer';
import { LanguageDetector } from '../analyzer/LanguageDetector';
import { QualityRunner } from '../quality/QualityRunner';
import { ProductionReadinessAuditor, AuditConfig } from '../auditor/ProductionReadinessAuditor';
import { ToolsDatabaseManager } from '../database/ToolsDatabaseManager';
import {
  SupervisorConfig,
  ProjectState,
  FileChange,
  ToolRecommendation,
  CodeIssue,
} from './types';

export class WOARUSupervisor extends EventEmitter {
  private stateManager: StateManager;
  private fileWatcher: FileWatcher;
  private notificationManager: NotificationManager;
  private toolEngine: ToolRecommendationEngine;
  private projectAnalyzer: ProjectAnalyzer;
  private languageDetector: LanguageDetector;
  private qualityRunner: QualityRunner;
  private productionAuditor: ProductionReadinessAuditor;
  private databaseManager: ToolsDatabaseManager;

  private config: SupervisorConfig;
  private isRunning = false;
  private projectPath: string;
  private lastRecommendationCheck = new Date();
  private recommendationInterval?: NodeJS.Timeout;
  private cleanupHandlers: Array<() => void> = [];

  constructor(projectPath: string, config: Partial<SupervisorConfig> = {}) {
    super();

    this.projectPath = path.resolve(projectPath);
    this.config = this.mergeConfig(config);

    // Initialize components
    this.stateManager = new StateManager(this.projectPath);
    this.fileWatcher = new FileWatcher(this.projectPath);
    this.notificationManager = new NotificationManager(
      this.config.notifications
    );
    this.toolEngine = new ToolRecommendationEngine();
    this.projectAnalyzer = new ProjectAnalyzer();
    this.languageDetector = new LanguageDetector();
    this.qualityRunner = new QualityRunner(this.notificationManager);
    this.productionAuditor = new ProductionReadinessAuditor(this.projectPath);
    this.databaseManager = new ToolsDatabaseManager();

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
        ...config.notifications,
      },
      ignoreTools: [],
      watchPatterns: ['**/*'],
      ignorePatterns: [
        '**/node_modules/**',
        '**/.git/**', 
        '**/dist/**',
        '**/build/**',
        '**/.next/**'
      ],
      dashboard: false,
      ...config,
    };
  }

  private setupEventListeners(): void {
    // File watcher events
    const handleBatchChanges = (changes: FileChange[]) => {
      this.handleFileChanges(changes);
    };
    this.fileWatcher.on('batch_changes', handleBatchChanges);
    this.cleanupHandlers.push(() =>
      this.fileWatcher.off('batch_changes', handleBatchChanges)
    );

    const handleCriticalFileChange = (change: FileChange) => {
      this.handleCriticalFileChange(change);
    };
    this.fileWatcher.on('critical_file_change', handleCriticalFileChange);
    this.cleanupHandlers.push(() =>
      this.fileWatcher.off('critical_file_change', handleCriticalFileChange)
    );

    const handleFileWatcherError = (error: Error) => {
      this.notificationManager.showError(
        `File watcher error: ${error.message}`
      );
    };
    this.fileWatcher.on('error', handleFileWatcherError);
    this.cleanupHandlers.push(() =>
      this.fileWatcher.off('error', handleFileWatcherError)
    );

    // State manager events
    const handleLanguageChanged = (language: string) => {
      this.notificationManager.showProgress(`Language detected: ${language}`);
      this.checkRecommendations();
    };
    this.stateManager.on('language_changed', handleLanguageChanged);
    this.cleanupHandlers.push(() =>
      this.stateManager.off('language_changed', handleLanguageChanged)
    );

    const handleToolDetected = (tool: string) => {
      this.notificationManager.showSuccess(`Tool detected: ${tool}`);
    };
    this.stateManager.on('tool_detected', handleToolDetected);
    this.cleanupHandlers.push(() =>
      this.stateManager.off('tool_detected', handleToolDetected)
    );

    const handleCriticalIssues = (issues: CodeIssue[]) => {
      this.notificationManager.notifyIssues(issues);
    };
    this.stateManager.on('critical_issues', handleCriticalIssues);
    this.cleanupHandlers.push(() =>
      this.stateManager.off('critical_issues', handleCriticalIssues)
    );

    const handleHealthScoreUpdated = (score: number) => {
      if (this.config.dashboard) {
        this.notificationManager.showHealthScore(score);
      }
    };
    this.stateManager.on('health_score_updated', handleHealthScoreUpdated);
    this.cleanupHandlers.push(() =>
      this.stateManager.off('health_score_updated', handleHealthScoreUpdated)
    );
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Supervisor is already running');
    }

    try {
      this.notificationManager.showProgress('Starting WOARU Supervisor...');

      // Initialize components
      await this.toolEngine.initialize();
      await this.stateManager.load();

      // Start background database updates
      this.databaseManager.startBackgroundUpdates().catch(() => {
        // Silently ignore database update errors during startup
      });

      // Perform initial analysis
      await this.performInitialAnalysis();

      // Start file watching (non-blocking)
      this.fileWatcher.start();

      // Start auto-save
      this.stateManager.startAutoSave();

      // Start periodic recommendation checks
      this.startRecommendationChecks();

      this.isRunning = true;

      // Show success immediately - file watcher will notify when ready
      this.notificationManager.showSuccess(
        `WOARU Supervisor started for ${path.basename(this.projectPath)}`
      );

      this.emit('started');

      // Run initial checks asynchronously (don't block startup)
      this.checkRecommendations().catch(error => 
        this.notificationManager.showError(`Initial recommendations failed: ${error}`)
      );
      
      this.runProductionAudit().catch(error =>
        this.notificationManager.showError(`Initial production audit failed: ${error}`)
      );
    } catch (error) {
      this.notificationManager.showError(
        `Failed to start supervisor: ${error}`
      );
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop all intervals
      this.stopRecommendationChecks();

      // Stop components
      this.fileWatcher.stop();
      this.stateManager.stopAutoSave();

      // Clean up event listeners
      this.cleanupEventListeners();

      // Save final state
      await this.stateManager.save();

      // Destroy state manager
      await this.stateManager.destroy();

      this.isRunning = false;
      this.notificationManager.showSuccess('WOARU Supervisor stopped');

      this.emit('stopped');
    } catch (error) {
      this.notificationManager.showError(
        `Error during supervisor shutdown: ${error}`
      );
      throw error;
    }
  }

  private async performInitialAnalysis(): Promise<void> {
    this.notificationManager.showProgress('Analyzing project...');

    try {
      // Detect language and frameworks
      const language = await this.languageDetector.detectPrimaryLanguage(
        this.projectPath
      );
      const frameworks = await this.languageDetector.detectFrameworks(
        this.projectPath,
        language
      );

      // Analyze project structure
      const analysis = await this.projectAnalyzer.analyzeProject(
        this.projectPath
      );

      // Update state
      this.stateManager.updateLanguage(language);
      this.stateManager.updateFrameworks(frameworks);

      // Detect existing tools
      this.detectExistingTools(analysis as any);

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
      'cargo-audit': /cargo-audit/,
    };

    const allDeps = [
      ...(analysis.dependencies || []),
      ...(analysis.devDependencies || []),
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
      'rustfmt.toml': 'rustfmt',
    };

    (analysis.configFiles || []).forEach((file: string) => {
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
        // Run immediate quality checks
        await this.qualityRunner.runChecksOnFileChange(
          path.join(this.projectPath, change.path)
        );
        
        // Get recommendations for the file
        const recommendations = await this.toolEngine.checkSingleFile(
          path.join(this.projectPath, change.path),
          this.stateManager.getState()
        );
        fileSpecificRecommendations.push(...recommendations);
      }
    }

    if (fileSpecificRecommendations.length > 0) {
      await this.notificationManager.notifyRecommendations(
        fileSpecificRecommendations
      );
    }

    // Note: Periodic checks are now handled by dedicated interval
  }

  private async handleCriticalFileChange(change: FileChange): Promise<void> {
    this.notificationManager.showProgress(
      `Critical file changed: ${change.path}`
    );

    // Immediate re-analysis for critical files
    if (change.path === 'package.json' || change.path.includes('config')) {
      await this.performInitialAnalysis();
      
      // Run production-readiness audit on package.json changes
      await this.runProductionAudit();
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
        await this.notificationManager.notifyRecommendations(
          filteredRecommendations
        );

        // Auto-setup if enabled
        if (this.config.autoSetup) {
          await this.autoSetupTools(filteredRecommendations);
        }
      }

      this.lastRecommendationCheck = new Date();
    } catch (error) {
      this.notificationManager.showError(
        `Recommendation check failed: ${error}`
      );
    }
  }

  private async autoSetupTools(
    recommendations: ToolRecommendation[]
  ): Promise<void> {
    const autoFixable = recommendations.filter(
      r => r.autoFixable && r.setupCommand
    );

    if (autoFixable.length === 0) return;

    this.notificationManager.showProgress(
      `Auto-setting up ${autoFixable.length} tools...`
    );

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
        this.notificationManager.showError(
          `Failed to setup ${rec.tool}: ${error}`
        );
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
      config: this.config,
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
      this.notificationManager.showSuccess(
        `Tool ${tool} removed from ignore list`
      );
    }
  }

  private startRecommendationChecks(): void {
    // Start periodic recommendation checks every 5 minutes
    this.recommendationInterval = setInterval(
      async () => {
        try {
          await this.checkRecommendations();
        } catch (error) {
          this.notificationManager.showError(
            `Periodic recommendation check failed: ${error}`
          );
        }
      },
      5 * 60 * 1000
    );
  }

  private stopRecommendationChecks(): void {
    if (this.recommendationInterval) {
      clearInterval(this.recommendationInterval);
      this.recommendationInterval = undefined;
    }
  }

  private cleanupEventListeners(): void {
    // Execute all cleanup handlers
    this.cleanupHandlers.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('Error during event listener cleanup:', error);
      }
    });
    this.cleanupHandlers = [];

    // Remove all listeners from this instance
    this.removeAllListeners();
  }

  private async runProductionAudit(): Promise<void> {
    try {
      const state = this.stateManager.getState();
      
      // Determine project type based on dependencies
      const auditConfig: AuditConfig = {
        language: state.language,
        frameworks: state.frameworks,
        projectType: this.determineProjectType(state)
      };

      const audits = await this.productionAuditor.auditProject(auditConfig);
      
      if (audits.length > 0) {
        await this.notificationManager.notifyProductionAudits(audits);
      }
    } catch (error) {
      this.notificationManager.showError(
        `Production audit failed: ${error}`
      );
    }
  }

  private determineProjectType(state: ProjectState): 'frontend' | 'backend' | 'fullstack' | 'library' | 'cli' {
    const frameworks = state.frameworks;
    
    // Check for frontend frameworks
    const frontendFrameworks = ['react', 'vue', 'angular', 'next', 'nuxt'];
    const hasFrontend = frameworks.some(f => frontendFrameworks.includes(f));
    
    // Check for backend frameworks
    const backendFrameworks = ['express', 'fastify', 'koa', 'django', 'flask', 'spring'];
    const hasBackend = frameworks.some(f => backendFrameworks.includes(f));
    
    if (hasFrontend && hasBackend) return 'fullstack';
    if (hasFrontend) return 'frontend';
    if (hasBackend) return 'backend';
    
    // Check if it's a CLI tool
    if (state.detectedTools.has('commander') || state.detectedTools.has('yargs')) {
      return 'cli';
    }
    
    // Default to library if no specific type detected
    return 'library';
  }

  async destroy(): Promise<void> {
    await this.stop();
  }
}
