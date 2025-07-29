import { EventEmitter } from 'events';
import * as path from 'path';
import { t } from '../config/i18n';
import { StateManager } from './StateManager';
import { FileWatcher } from './FileWatcher';
import { NotificationManager } from './NotificationManager';
import { ToolRecommendationEngine } from './ToolRecommendationEngine';
import { ProjectAnalyzer } from '../analyzer/ProjectAnalyzer';
import { LanguageDetector } from '../analyzer/LanguageDetector';
import { QualityRunner } from '../quality/QualityRunner';
import {
  ProductionReadinessAuditor,
  AuditConfig,
} from '../auditor/ProductionReadinessAuditor';
import { ToolsDatabaseManager } from '../database/ToolsDatabaseManager';
import { SecurityScanResult, SecurityFinding } from '../types/security';
import { ProjectAnalysis } from '../types/index';
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
  private lastSecurityCheck = new Date();
  private recommendationInterval?: NodeJS.Timeout;
  private securityInterval?: NodeJS.Timeout;
  private cleanupHandlers: Array<() => void> = [];
  private lastSecurityFindings: SecurityFinding[] = [];

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
        '**/.next/**',
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
      this.notificationManager.showSuccess(
        t('supervisor.tool_detected', { tool })
      );
    };
    this.stateManager.on('tool_detected', handleToolDetected);
    this.cleanupHandlers.push(() =>
      this.stateManager.off('tool_detected', handleToolDetected)
    );

    const handleCriticalIssues = (issues: CodeIssue[]) => {
      try {
        this.notificationManager.notifyIssues(issues);
      } catch (error) {
        // Don't crash supervisor on notification errors
        console.warn('Failed to notify issues:', error);
      }
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

    const handleRecommendation = (recommendation: ToolRecommendation) => {
      this.emit('recommendation', recommendation);
    };
    this.stateManager.on('recommendation', handleRecommendation);
    this.cleanupHandlers.push(() =>
      this.stateManager.off('recommendation', handleRecommendation)
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

      // Start security monitoring
      this.startSecurityMonitoring();

      this.isRunning = true;

      // Show success immediately - file watcher will notify when ready
      this.notificationManager.showSuccess(
        `WOARU Supervisor started for ${path.basename(this.projectPath)}`
      );

      this.emit('started');

      // Run initial checks asynchronously (don't block startup)
      this.checkRecommendations().catch(error =>
        this.notificationManager.showError(
          `Initial recommendations failed: ${error}`
        )
      );

      this.runProductionAudit().catch(error =>
        this.notificationManager.showError(
          `Initial production audit failed: ${error}`
        )
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
      this.stopSecurityMonitoring();

      // Stop components
      this.fileWatcher.stop();
      this.stateManager.stopAutoSave();
      this.databaseManager.stopBackgroundUpdates();

      // Clean up event listeners
      this.cleanupEventListeners();

      // Save final state
      await this.stateManager.save();

      // Destroy state manager
      await this.stateManager.destroy();

      this.isRunning = false;
      this.notificationManager.showSuccess(t('supervisor.stopped'));

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
      this.detectExistingTools(analysis);

      this.notificationManager.showSuccess(
        `Project analyzed: ${language} ${frameworks.length > 0 ? `(${frameworks.join(', ')})` : ''}`
      );
    } catch (error) {
      this.notificationManager.showError(
        t('supervisor.analysis_failed', { error })
      );
    }
  }

  private detectExistingTools(analysis: ProjectAnalysis): void {
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
      ...analysis.dependencies,
      ...analysis.devDependencies,
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

    analysis.configFiles.forEach((file: string) => {
      Object.entries(configTools).forEach(([pattern, tool]) => {
        if (file.includes(pattern)) {
          this.stateManager.addDetectedTool(tool);
        }
      });
    });
  }

  private async handleFileChanges(changes: FileChange[]): Promise<void> {
    try {
      // Apply changes to state and emit events
      changes.forEach(change => {
        this.stateManager.applyFileChange(change);
        this.emit('file-changed', change.path);
      });

      // Check for package definition changes for security scanning
      const packageFiles = [
        'package.json',
        'package-lock.json',
        'pyproject.toml',
        'requirements.txt',
        'Gemfile',
        'go.mod',
      ];
      const hasPackageChanges = changes.some(change =>
        packageFiles.some(pkgFile => change.path.endsWith(pkgFile))
      );

      // Check for new recommendations based on changes
      const fileSpecificRecommendations: ToolRecommendation[] = [];

      for (const change of changes) {
        if (change.type === 'change') {
          // Run immediate quality checks
          await this.qualityRunner.runChecksOnFileChange(
            path.join(this.projectPath, change.path)
          );

          // Run auto-fix if enabled
          if (this.config.autoFix) {
            await this.qualityRunner.runChecksOnFileList([
              path.join(this.projectPath, change.path),
            ]);
          }

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

      // Run security check asynchronously if package files changed or critical code files
      const securityTriggerFiles = [
        ...packageFiles,
        '.env',
        '.env.example',
        'docker-compose.yml',
        'Dockerfile',
      ];
      const hasSecurityTriggers = changes.some(
        change =>
          securityTriggerFiles.some(secFile => change.path.endsWith(secFile)) ||
          change.path.includes('auth') ||
          change.path.includes('secret') ||
          change.path.includes('key') ||
          change.path.includes('password')
      );

      if (hasPackageChanges || hasSecurityTriggers) {
        this.runBackgroundSecurityCheck(
          changes.map(c => path.join(this.projectPath, c.path))
        ).catch(error => {
          console.error('Background security check failed:', error);
        });
      }

      // Note: Periodic checks are now handled by dedicated interval
    } catch (error) {
      this.notificationManager.showError(
        `Quality check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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
          this.notificationManager.showSuccess(
            t('supervisor.setup_completed', { tool: rec.tool })
          );
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
      this.notificationManager.showSuccess(
        t('supervisor.tool_ignored', { tool })
      );
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

  private startSecurityMonitoring(): void {
    // Start periodic security checks every 15 minutes
    this.securityInterval = setInterval(
      async () => {
        try {
          await this.runPeriodicSecurityCheck();
        } catch (error) {
          this.notificationManager.showError(
            `Periodic security check failed: ${error}`
          );
        }
      },
      15 * 60 * 1000 // 15 minutes
    );
  }

  private stopSecurityMonitoring(): void {
    if (this.securityInterval) {
      clearInterval(this.securityInterval);
      this.securityInterval = undefined;
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
        projectType: this.determineProjectType(state),
      };

      const audits = await this.productionAuditor.auditProject(auditConfig);

      if (audits.length > 0) {
        await this.notificationManager.notifyProductionAudits(audits);
      }
    } catch (error) {
      this.notificationManager.showError(
        t('supervisor.audit_failed', { error })
      );
    }
  }

  private determineProjectType(
    state: ProjectState
  ): 'frontend' | 'backend' | 'fullstack' | 'library' | 'cli' {
    const frameworks = state.frameworks;

    // Check for frontend frameworks
    const frontendFrameworks = ['react', 'vue', 'angular', 'next', 'nuxt'];
    const hasFrontend = frameworks.some(f => frontendFrameworks.includes(f));

    // Check for backend frameworks
    const backendFrameworks = [
      'express',
      'fastify',
      'koa',
      'django',
      'flask',
      'spring',
    ];
    const hasBackend = frameworks.some(f => backendFrameworks.includes(f));

    if (hasFrontend && hasBackend) return 'fullstack';
    if (hasFrontend) return 'frontend';
    if (hasBackend) return 'backend';

    // Check if it's a CLI tool
    if (
      state.detectedTools.has('commander') ||
      state.detectedTools.has('yargs')
    ) {
      return 'cli';
    }

    // Default to library if no specific type detected
    return 'library';
  }

  async destroy(): Promise<void> {
    await this.stop();
  }

  /**
   * Runs comprehensive security check in the background when files change
   */
  private async runBackgroundSecurityCheck(
    changedFiles?: string[]
  ): Promise<void> {
    this.notificationManager.showProgress(
      '🔒 Running security scan on updated dependencies...'
    );

    try {
      // Get list of files for security check
      const filesToCheck = changedFiles || (await this.getAllProjectFiles());

      // Run comprehensive security checks (Snyk + Gitleaks)
      const securityResults =
        await this.qualityRunner.runSecurityChecksForReview(filesToCheck);

      // Store findings for comparison in future checks
      const allFindings: SecurityFinding[] = [];
      securityResults.forEach(result => {
        allFindings.push(...result.findings);
      });

      // Process results and show alerts for critical/high vulnerabilities
      let hasCriticalIssues = false;
      let criticalCount = 0;
      let highCount = 0;
      let secretsFound = 0;

      securityResults.forEach(result => {
        criticalCount += result.summary.critical;
        highCount += result.summary.high;

        if (result.summary.critical > 0 || result.summary.high > 0) {
          hasCriticalIssues = true;
        }

        // Count secrets found by Gitleaks
        if (result.tool === 'gitleaks') {
          secretsFound += result.findings.length;
        }

        // Show specific critical and high findings
        const criticalFindings = result.findings.filter(
          f => f.severity === 'critical'
        );
        const highFindings = result.findings.filter(f => f.severity === 'high');

        // Show critical findings individually
        criticalFindings.forEach(finding => {
          let description = '';
          let recommendation = finding.recommendation;

          if (finding.package) {
            description = `Package: ${finding.package}@${finding.version || 'unknown'}`;
            if (finding.fixedIn) {
              description += ' (Fix available)';
              recommendation = recommendation || `Update to ${finding.fixedIn}`;
            }
          } else if (finding.file) {
            description = `File: ${finding.file}${finding.line ? `:${finding.line}` : ''}`;
          }

          this.notificationManager.showSecurityAlert(
            'critical',
            `🚨 CRITICAL [${finding.tool.toUpperCase()}]: ${finding.title}`,
            description,
            recommendation
          );
        });

        // Show high findings (summarized if many)
        if (highFindings.length > 0 && highFindings.length <= 3) {
          highFindings.forEach(finding => {
            let description = '';
            if (finding.package) {
              description = `Package: ${finding.package}@${finding.version || 'unknown'}`;
            } else if (finding.file) {
              description = `File: ${finding.file}${finding.line ? `:${finding.line}` : ''}`;
            }

            this.notificationManager.showSecurityAlert(
              'high',
              `⚠️ HIGH [${finding.tool.toUpperCase()}]: ${finding.title}`,
              description,
              finding.recommendation
            );
          });
        } else if (highFindings.length > 3) {
          this.notificationManager.showSecurityAlert(
            'high',
            `⚠️ ${highFindings.length} HIGH severity security issues found`,
            `Tools: ${result.tool}`,
            'Run "woaru review" for detailed report'
          );
        }

        // Show secrets found by Gitleaks
        if (result.tool === 'gitleaks' && result.findings.length > 0) {
          result.findings.slice(0, 3).forEach(finding => {
            this.notificationManager.showSecurityAlert(
              'critical',
              `🔍 SECRET DETECTED: ${finding.title}`,
              `File: ${finding.file}${finding.line ? `:${finding.line}` : ''}`,
              'Remove or encrypt the secret immediately'
            );
          });

          if (result.findings.length > 3) {
            this.notificationManager.showSecurityAlert(
              'critical',
              `🔍 ${result.findings.length - 3} more secrets detected`,
              'Multiple secrets found in codebase',
              'Run "woaru review" for complete list'
            );
          }
        }
      });

      // Store findings for next comparison
      this.lastSecurityFindings = allFindings;
      this.lastSecurityCheck = new Date();

      if (!hasCriticalIssues && secretsFound === 0) {
        this.notificationManager.showSuccess(
          '✅ Security scan complete - no critical issues found'
        );
      } else {
        // Show summary alert
        const summaryParts = [];
        if (criticalCount > 0) summaryParts.push(`${criticalCount} critical`);
        if (highCount > 0) summaryParts.push(`${highCount} high`);
        if (secretsFound > 0) summaryParts.push(`${secretsFound} secrets`);

        this.notificationManager.showSecurityAlert(
          'critical',
          `🚨 SECURITY ALERT: ${summaryParts.join(', ')} issues found!`,
          'Security issues detected in your project',
          'Run "woaru review" for detailed analysis and fixes'
        );
      }
    } catch (error) {
      // Don't crash the supervisor if security check fails
      this.notificationManager.showWarning(
        `Security scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Runs periodic security check (every 15 minutes)
   */
  private async runPeriodicSecurityCheck(): Promise<void> {
    const now = new Date();
    const timeSinceLastCheck = now.getTime() - this.lastSecurityCheck.getTime();

    // Skip if we just ran a security check (less than 10 minutes ago)
    if (timeSinceLastCheck < 10 * 60 * 1000) {
      return;
    }

    this.notificationManager.showProgress(
      '🔒 Running periodic security scan...'
    );

    try {
      const allFiles = await this.getAllProjectFiles();
      const securityResults =
        await this.qualityRunner.runSecurityChecksForReview(allFiles);

      // Only show new critical issues (not previously reported)
      const newCriticalFindings = this.getNewCriticalFindings(securityResults);

      if (newCriticalFindings.length > 0) {
        this.notificationManager.showSecurityAlert(
          'critical',
          `🚨 NEW SECURITY ISSUES DETECTED`,
          `${newCriticalFindings.length} new critical/high security issues found`,
          'Run "woaru review" for detailed analysis'
        );

        // Show top 2 new issues
        newCriticalFindings.slice(0, 2).forEach(finding => {
          let description = '';
          if (finding.package) {
            description = `Package: ${finding.package}`;
          } else if (finding.file) {
            description = `File: ${finding.file}`;
          }

          this.notificationManager.showSecurityAlert(
            finding.severity as 'critical' | 'high',
            `NEW [${finding.tool.toUpperCase()}]: ${finding.title}`,
            description,
            finding.recommendation
          );
        });
      } else {
        // Silent success for periodic checks
        console.log('✅ Periodic security scan: No new issues');
      }

      // Update stored findings
      const allFindings: SecurityFinding[] = [];
      securityResults.forEach(result => {
        allFindings.push(...result.findings);
      });
      this.lastSecurityFindings = allFindings;
      this.lastSecurityCheck = now;
    } catch (error) {
      console.error('Periodic security check failed:', error);
    }
  }

  /**
   * Compare current findings with previous ones to identify new critical issues
   */
  private getNewCriticalFindings(
    currentResults: SecurityScanResult[]
  ): SecurityFinding[] {
    const currentFindings: SecurityFinding[] = [];
    currentResults.forEach(result => {
      currentFindings.push(
        ...result.findings.filter(
          f => f.severity === 'critical' || f.severity === 'high'
        )
      );
    });

    // Find findings that weren't in the last check
    const newFindings = currentFindings.filter(current => {
      return !this.lastSecurityFindings.some(
        previous =>
          previous.title === current.title &&
          previous.file === current.file &&
          previous.package === current.package &&
          previous.tool === current.tool
      );
    });

    return newFindings;
  }

  /**
   * Helper to get all project files (for security analysis)
   */
  private async getAllProjectFiles(): Promise<string[]> {
    // For now, return empty array as security tools scan the whole project anyway
    // This could be enhanced to return actual file list if needed for file-specific scans
    return [];
  }
}
