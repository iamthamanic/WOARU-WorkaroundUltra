import { ProjectAnalyzer } from '../analyzer/ProjectAnalyzer';
import {
  CodeAnalyzer,
  CodeInsight as AnalyzerCodeInsight,
} from '../analyzer/CodeAnalyzer';
import { DatabaseManager } from '../database/DatabaseManager';
import { PluginManager } from '../plugins/PluginManager';
import { ActionManager } from '../actions/ActionManager';
import { ProductionReadinessAuditor } from '../auditor/ProductionReadinessAuditor';
import { QualityRunner } from '../quality/QualityRunner';
import { NotificationManager } from '../supervisor/NotificationManager';
import { SecurityScanResult } from '../types/security';
import {
  AnalysisResult,
  SetupOptions,
  ProjectAnalysis,
  SetupRecommendation,
  ConfigurationAudit,
  InfrastructureFinding,
  InfrastructureSecurityResult,
  SecurityCombinedFindings,
  TrivyResult,
  TrivyMisconfiguration,
} from '../types';
import chalk from 'chalk';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { t } from '../config/i18n';

const execAsync = promisify(exec);

export class WOARUEngine {
  private projectAnalyzer: ProjectAnalyzer;
  private codeAnalyzer: CodeAnalyzer;
  private databaseManager: DatabaseManager;
  private pluginManager: PluginManager;
  private actionManager: ActionManager;
  private qualityRunner: QualityRunner;
  private notificationManager: NotificationManager;

  constructor() {
    this.projectAnalyzer = new ProjectAnalyzer();
    this.codeAnalyzer = new CodeAnalyzer();
    this.databaseManager = new DatabaseManager();
    this.pluginManager = new PluginManager();
    this.actionManager = new ActionManager();
    this.notificationManager = new NotificationManager({
      terminal: false,
      desktop: false,
    });
    this.qualityRunner = new QualityRunner(this.notificationManager);
  }

  async analyzeProject(projectPath: string): Promise<AnalysisResult> {
    try {
      console.log(chalk.blue(t('woaru_engine.analyzing_project')));

      const analysis = await this.projectAnalyzer.analyzeProject(projectPath);
      const metadata =
        await this.projectAnalyzer.getProjectMetadata(projectPath);

      console.log(
        chalk.gray(
          t('woaru_engine.project_info', {
            name: metadata.name,
            version: metadata.version,
          })
        )
      );
      console.log(
        chalk.gray(
          t('woaru_engine.language_info', { language: analysis.language })
        )
      );
      console.log(
        chalk.gray(
          t('woaru_engine.frameworks_info', {
            frameworks:
              analysis.framework.join(', ') || t('woaru_engine.none_detected'),
          })
        )
      );

      // Analyze code for specific insights
      console.log(chalk.blue(t('woaru_engine.analyzing_codebase')));
      const codeInsights = await this.codeAnalyzer.analyzeCodebase(
        projectPath,
        analysis.language
      );

      // Get recommendations from plugins with code insights
      const recommendations =
        this.pluginManager.getAllRecommendations(analysis);

      // Enhance recommendations with code insights
      this.enhanceRecommendationsWithInsights(recommendations, codeInsights);

      const refactorSuggestions =
        this.pluginManager.getAllRefactorSuggestions(analysis);
      const frameworkSpecificPackages =
        this.pluginManager.getAllSpecificPackages(analysis);

      // Detect already installed tools
      const installedTools = await this.detectInstalledTools(analysis);

      // Run comprehensive security analysis
      console.log(chalk.blue(t('woaru_engine.security_analysis')));
      const securityResults =
        await this.runComprehensiveSecurityAnalysis(projectPath);

      // Run infrastructure security check
      console.log(chalk.blue(t('woaru_engine.infrastructure_audit')));
      const infrastructureResults =
        await this.runInfrastructureSecurityCheck(projectPath);

      // Run production-readiness audit (including security)
      console.log(chalk.blue(t('woaru_engine.production_audit')));
      const productionAuditor = new ProductionReadinessAuditor(projectPath);
      const auditConfig = {
        language: analysis.language,
        frameworks: analysis.framework,
        projectType: this.determineProjectType(analysis),
      };

      const productionAudits =
        await productionAuditor.auditProject(auditConfig);

      // Combine all security findings
      const allSecurityFindings = this.combineSecurityFindings(
        securityResults,
        infrastructureResults
      );

      // Group production audits by category and priority
      const securityAudits = productionAudits.filter(
        audit => audit.category === 'security'
      );
      const criticalSecurityAudits = securityAudits.filter(
        audit => audit.priority === 'critical'
      );
      const highSecurityAudits = securityAudits.filter(
        audit => audit.priority === 'high'
      );

      // Calculate comprehensive security metrics
      const totalCritical =
        allSecurityFindings.critical + criticalSecurityAudits.length;
      const totalHigh = allSecurityFindings.high + highSecurityAudits.length;

      // Log critical security issues immediately
      if (totalCritical > 0) {
        console.log(
          chalk.red(
            t('woaru_engine.critical_security_issues', { count: totalCritical })
          )
        );
      }
      if (totalHigh > 0) {
        console.log(
          chalk.yellow(
            t('woaru_engine.high_security_issues', { count: totalHigh })
          )
        );
      }

      // Generate Claude automation suggestions
      const claudeAutomations = this.generateClaudeAutomations(analysis);

      return {
        setup_recommendations: recommendations.map(
          r => `Install ${r.tool} for ${r.category}: ${r.reason}`
        ),
        tool_suggestions: recommendations.map(r => r.tool),
        framework_specific_tools: frameworkSpecificPackages,
        refactor_suggestions: refactorSuggestions,
        installed_tools_detected: installedTools,
        claude_automations: claudeAutomations,
        code_insights: Array.from(codeInsights.entries()).map(
          ([tool, insight]) => ({
            tool,
            reason: insight.reason,
            evidence: insight.evidence,
            severity: insight.severity,
          })
        ),
        // Add production audit results
        production_audits: productionAudits.map(audit => ({
          category: audit.category,
          check: audit.check,
          priority: audit.priority,
          message: audit.message,
          recommendation: audit.recommendation,
          packages: audit.packages || [],
          files: audit.files || [],
        })),
        security_summary: {
          total_issues: allSecurityFindings.total + securityAudits.length,
          critical: totalCritical,
          high: totalHigh,
          medium:
            allSecurityFindings.medium +
            securityAudits.filter(audit => audit.priority === 'medium').length,
          low:
            allSecurityFindings.low +
            securityAudits.filter(audit => audit.priority === 'low').length,
          health_score: this.calculateComprehensiveSecurityScore(
            allSecurityFindings,
            securityAudits,
            infrastructureResults
          ),
          // Note: Extended metrics stored in detailed_security instead
          recommendations: this.generateSecurityRecommendations(
            allSecurityFindings,
            securityAudits
          ),
        },
        // Add detailed security results (extended data)
        detailed_security: {
          dependency_vulnerabilities: securityResults.flatMap(r =>
            r.findings.map(f => ({
              id: f.cve || `${f.tool}-${f.file || f.package}`,
              title: f.title,
              severity: (f.severity === 'info'
                ? 'low'
                : f.severity === 'critical' ||
                    f.severity === 'high' ||
                    f.severity === 'medium' ||
                    f.severity === 'low'
                  ? f.severity
                  : 'low') as 'critical' | 'high' | 'medium' | 'low',
              description: f.description || '',
              packageName: f.package || 'unknown',
              vulnerableVersions: f.version || 'unknown',
              patchedVersions: f.fixedIn,
              recommendation: f.recommendation || '',
            }))
          ),
          infrastructure_security: infrastructureResults || undefined,
          configuration_audits: securityAudits,
        },
      };
    } catch (error) {
      throw new Error(
        t('woaru_engine.analysis_failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      );
    }
  }

  async setupProject(
    projectPath: string,
    options: SetupOptions = {}
  ): Promise<boolean> {
    try {
      const analysis = await this.projectAnalyzer.analyzeProject(projectPath);
      const recommendations =
        this.pluginManager.getAllRecommendations(analysis);

      if (recommendations.length === 0) {
        console.log(chalk.green(t('woaru_engine.project_well_configured')));
        return true;
      }

      console.log(
        chalk.blue(
          t('woaru_engine.recommendations_found', {
            count: recommendations.length,
          })
        )
      );

      if (options.dryRun) {
        console.log(chalk.yellow(t('woaru_engine.dry_run_mode')));
        recommendations.forEach(rec => {
          console.log(
            chalk.gray(
              t('woaru_engine.dry_run_item', {
                tool: rec.tool,
                reason: rec.reason,
              })
            )
          );
        });
        return true;
      }

      const result = await this.actionManager.executeRecommendations(
        projectPath,
        recommendations,
        options
      );

      return result.success;
    } catch (error) {
      console.error(
        chalk.red(
          t('woaru_engine.setup_failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        )
      );
      return false;
    }
  }

  async updateDatabase(): Promise<boolean> {
    console.log(chalk.blue(t('woaru_engine.updating_database')));

    const success = await this.databaseManager.updateDatabase();

    if (success) {
      console.log(chalk.green(t('woaru_engine.database_updated')));
    } else {
      console.log(chalk.red(t('woaru_engine.database_update_failed')));
    }

    return success;
  }

  private async detectInstalledTools(
    analysis: ProjectAnalysis
  ): Promise<string[]> {
    try {
      const installedTools: string[] = [];
      const allDeps = [...analysis.dependencies, ...analysis.devDependencies];

      const toolChecks = this.getToolChecks();
      const projectPath = this.getValidatedProjectPath(analysis.projectPath);

      for (const [tool, check] of Object.entries(toolChecks)) {
        const hasPackage = this.checkPackageDependency(check.packages, allDeps);
        const hasConfig = await this.checkConfigFiles(
          check.configs || [],
          projectPath
        );

        if (hasPackage || hasConfig) {
          installedTools.push(tool);
        }
      }

      return installedTools;
    } catch (error) {
      console.warn(
        t('woaru_engine.tool_detection_warning', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      );
      return [];
    }
  }

  private getToolChecks() {
    return {
      eslint: {
        packages: ['eslint'],
        configs: [
          '.eslintrc.js',
          '.eslintrc.json',
          '.eslintrc.yml',
          '.eslintrc.yaml',
          '.eslintrc',
          'eslint.config.js',
        ],
      },
      prettier: {
        packages: ['prettier'],
        configs: [
          '.prettierrc',
          '.prettierrc.json',
          '.prettierrc.yml',
          '.prettierrc.yaml',
          '.prettierrc.js',
          'prettier.config.js',
        ],
      },
      husky: {
        packages: ['husky'],
        configs: ['.husky', '.git/hooks'],
      },
      jest: {
        packages: ['jest'],
        configs: ['jest.config.js', 'jest.config.ts', 'jest.config.json'],
      },
      typescript: {
        packages: ['typescript'],
        configs: ['tsconfig.json'],
      },
      tailwindcss: {
        packages: ['tailwindcss'],
        configs: ['tailwind.config.js', 'tailwind.config.ts'],
      },
      postcss: {
        packages: ['postcss'],
        configs: ['postcss.config.js', 'postcss.config.ts'],
      },
      commitlint: {
        packages: ['@commitlint/cli', '@commitlint/config-conventional'],
        configs: [
          'commitlint.config.js',
          '.commitlintrc.js',
          '.commitlintrc.json',
        ],
      },
      webpack: {
        packages: ['webpack'],
        configs: ['webpack.config.js', 'webpack.config.ts'],
      },
      vite: {
        packages: ['vite'],
        configs: ['vite.config.js', 'vite.config.ts'],
      },
      rollup: {
        packages: ['rollup'],
        configs: ['rollup.config.js', 'rollup.config.ts'],
      },
      babel: {
        packages: ['@babel/core', 'babel-core'],
        configs: [
          '.babelrc',
          '.babelrc.js',
          '.babelrc.json',
          'babel.config.js',
        ],
      },
    };
  }

  private getValidatedProjectPath(projectPath?: string): string {
    const validPath = projectPath || process.cwd();

    try {
      return path.resolve(validPath);
    } catch {
      throw new Error(
        t('woaru_engine.invalid_project_path', { path: validPath })
      );
    }
  }

  private checkPackageDependency(
    packages: string[],
    allDeps: string[]
  ): boolean {
    return packages.some(pkg => allDeps.includes(pkg));
  }

  private async checkConfigFiles(
    configFiles: string[],
    projectPath: string
  ): Promise<boolean> {
    const fs = await import('fs-extra');

    for (const configFile of configFiles) {
      try {
        const configPath = path.join(projectPath, configFile);
        if (await fs.pathExists(configPath)) {
          return true;
        }
      } catch {
        // Continue checking other config files
        continue;
      }
    }
    return false;
  }

  private generateClaudeAutomations(analysis: ProjectAnalysis): string[] {
    const automations: string[] = [];

    // Framework-specific automations
    if (analysis.framework.includes('nextjs')) {
      automations.push(t('woaru_engine.automations.nextjs_api_routes'));
      automations.push(t('woaru_engine.automations.nextjs_components'));
      automations.push(t('woaru_engine.automations.nextjs_middleware'));
    }

    if (analysis.framework.includes('react')) {
      automations.push(
        t('woaru_engine.automations.react_functional_components')
      );
      automations.push(t('woaru_engine.automations.react_custom_hooks'));
      automations.push(t('woaru_engine.automations.react_storybook'));
    }

    // Language-specific automations
    if (analysis.language === 'TypeScript') {
      automations.push(t('woaru_engine.automations.typescript_interfaces'));
      automations.push(t('woaru_engine.automations.typescript_strict'));
      automations.push(t('woaru_engine.automations.typescript_utility_types'));
    }

    // Testing automations
    if (
      !analysis.devDependencies.includes('jest') &&
      !analysis.devDependencies.includes('vitest')
    ) {
      automations.push(t('woaru_engine.automations.setup_testing'));
      automations.push(t('woaru_engine.automations.generate_unit_tests'));
    }

    // Documentation automations
    automations.push(t('woaru_engine.automations.generate_readme'));
    automations.push(t('woaru_engine.automations.generate_contributing'));
    automations.push(t('woaru_engine.automations.generate_api_docs'));

    return automations;
  }

  private enhanceRecommendationsWithInsights(
    recommendations: SetupRecommendation[],
    codeInsights: Map<string, AnalyzerCodeInsight>
  ): void {
    recommendations.forEach((rec: SetupRecommendation) => {
      const insight = codeInsights.get(rec.tool);
      if (insight) {
        rec.reason = insight.reason;
        rec.evidence = insight.evidence.join('; ');
        rec.priority =
          insight.severity === 'critical'
            ? 'high'
            : insight.severity === 'high'
              ? 'high'
              : insight.severity === 'medium'
                ? 'medium'
                : 'low';
      }
    });
  }

  private determineProjectType(
    analysis: ProjectAnalysis
  ): 'frontend' | 'backend' | 'fullstack' | 'library' | 'cli' {
    // Check for frontend frameworks
    const frontendFrameworks = ['react', 'vue', 'angular', 'svelte', 'next'];
    const hasFrontend = analysis.framework.some(f =>
      frontendFrameworks.includes(f)
    );

    // Check for backend frameworks
    const backendFrameworks = ['express', 'fastify', 'koa', 'nest'];
    const hasBackend = analysis.framework.some(f =>
      backendFrameworks.includes(f)
    );

    // Check dependencies for more clues
    const allDeps = [...analysis.dependencies, ...analysis.devDependencies];
    const hasServerDeps = allDeps.some(dep =>
      ['express', 'fastify', 'koa', '@nestjs/core', 'http-server'].includes(dep)
    );
    const hasFrontendDeps = allDeps.some(dep =>
      ['react', 'vue', '@angular/core', 'svelte'].includes(dep)
    );

    // Check for CLI tools
    const hasCliDeps = allDeps.some(dep =>
      ['commander', 'yargs', 'inquirer', '@oclif/core'].includes(dep)
    );

    // Determine type based on evidence
    if (hasCliDeps) return 'cli';
    if (hasFrontend && (hasBackend || hasServerDeps)) return 'fullstack';
    if (hasFrontend || hasFrontendDeps) return 'frontend';
    if (hasBackend || hasServerDeps) return 'backend';

    // Default to library if no clear indicators
    return 'library';
  }

  private calculateSecurityHealthScore(
    securityAudits: ConfigurationAudit[]
  ): number {
    if (securityAudits.length === 0) return 100;

    let score = 100;

    securityAudits.forEach(audit => {
      switch (audit.priority) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 8;
          break;
        case 'low':
          score -= 3;
          break;
      }
    });

    return Math.max(0, score);
  }

  /**
   * Run comprehensive security analysis using multiple tools
   */
  private async runComprehensiveSecurityAnalysis(
    _projectPath: string
  ): Promise<SecurityScanResult[]> {
    console.log(
      chalk.gray(t('woaru_engine.security_scan.running_snyk_gitleaks'))
    );

    try {
      // Get all project files for security scanning
      const allFiles: string[] = [];
      // For comprehensive analysis, we can scan the entire project

      const securityResults =
        await this.qualityRunner.runSecurityChecksForReview(allFiles);

      // Log summary of findings
      let criticalFindings = 0;
      securityResults.forEach(result => {
        criticalFindings += result.summary.critical;

        if (result.error) {
          console.log(
            chalk.red(
              t('woaru_engine.security_scan.tool_error', {
                tool: result.tool,
                error: result.error,
              })
            )
          );
        } else if (result.summary.total > 0) {
          console.log(
            chalk.yellow(
              t('woaru_engine.security_scan.issues_found', {
                tool: result.tool,
                count: result.summary.total,
              })
            )
          );
        } else {
          console.log(
            chalk.green(
              t('woaru_engine.security_scan.no_issues', { tool: result.tool })
            )
          );
        }
      });

      if (criticalFindings > 0) {
        console.log(
          chalk.red(
            t('woaru_engine.security_scan.critical_vulnerabilities', {
              count: criticalFindings,
            })
          )
        );
      }

      return securityResults;
    } catch (error) {
      console.log(
        chalk.red(
          t('woaru_engine.security_scan.analysis_failed', { error: error })
        )
      );
      return [];
    }
  }

  /**
   * Run infrastructure security check using Trivy
   */
  private async runInfrastructureSecurityCheck(
    projectPath: string
  ): Promise<InfrastructureSecurityResult | null> {
    console.log(
      chalk.gray(t('woaru_engine.infrastructure_scan.scanning_containers'))
    );

    try {
      // Check if Trivy is installed
      await execAsync('which trivy');

      const findings: InfrastructureFinding[] = [];
      const scanTargets = [];

      // Look for Docker files
      const dockerFile = path.join(projectPath, 'Dockerfile');
      if (await this.fileExists(dockerFile)) {
        scanTargets.push({ type: 'dockerfile', path: dockerFile });
      }

      // Look for docker-compose files
      const composeFiles = [
        'docker-compose.yml',
        'docker-compose.yaml',
        'compose.yml',
      ];
      for (const file of composeFiles) {
        const composePath = path.join(projectPath, file);
        if (await this.fileExists(composePath)) {
          scanTargets.push({ type: 'compose', path: composePath });
        }
      }

      // Look for Kubernetes manifests
      const k8sDir = path.join(projectPath, 'k8s');
      if (await this.fileExists(k8sDir)) {
        scanTargets.push({ type: 'kubernetes', path: k8sDir });
      }

      // Scan each target
      for (const target of scanTargets) {
        try {
          const { stdout } = await execAsync(
            `trivy config --format json "${target.path}"`,
            { cwd: projectPath, maxBuffer: 10 * 1024 * 1024 }
          );

          if (stdout) {
            const results = JSON.parse(stdout);
            if (results.Results) {
              results.Results.forEach((result: TrivyResult) => {
                const resultWithMisconfigs = result as TrivyResult & {
                  Misconfigurations?: TrivyMisconfiguration[];
                };
                if (resultWithMisconfigs.Misconfigurations) {
                  resultWithMisconfigs.Misconfigurations.forEach(
                    (misc: TrivyMisconfiguration) => {
                      findings.push({
                        tool: 'trivy',
                        type: 'misconfiguration',
                        severity: (misc.Severity?.toLowerCase() || 'medium') as
                          | 'critical'
                          | 'high'
                          | 'medium'
                          | 'low'
                          | 'info',
                        title: misc.Title,
                        description: misc.Description,
                        file: target.path,
                        recommendation: misc.Resolution,
                        references: misc.References,
                      });
                    }
                  );
                }
              });
            }
          }

          console.log(
            chalk.green(
              t('woaru_engine.infrastructure_scan.trivy_scanned', {
                type: target.type,
                path: target.path,
              })
            )
          );
        } catch {
          console.log(
            chalk.yellow(
              t('woaru_engine.infrastructure_scan.trivy_scan_failed', {
                path: target.path,
              })
            )
          );
        }
      }

      if (scanTargets.length === 0) {
        console.log(
          chalk.gray(
            t('woaru_engine.infrastructure_scan.no_infrastructure_files')
          )
        );
        return null;
      }

      const summary = {
        total: findings.length,
        critical: findings.filter(f => f.severity === 'critical').length,
        high: findings.filter(f => f.severity === 'high').length,
        medium: findings.filter(f => f.severity === 'medium').length,
        low: findings.filter(f => f.severity === 'low').length,
        info: findings.filter(f => f.severity === 'info').length,
      };

      if (findings.length > 0) {
        console.log(
          chalk.yellow(
            t('woaru_engine.infrastructure_scan.issues_found', {
              count: findings.length,
            })
          )
        );
      } else {
        console.log(
          chalk.green(t('woaru_engine.infrastructure_scan.no_issues'))
        );
      }

      return {
        tool: 'trivy',
        scanTime: new Date(),
        findings,
        summary,
        targets_scanned: scanTargets.length,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('command not found')
      ) {
        console.log(
          chalk.gray(t('woaru_engine.infrastructure_scan.trivy_not_installed'))
        );
        console.log(
          chalk.gray(t('woaru_engine.infrastructure_scan.trivy_install_hint'))
        );
      } else {
        console.log(
          chalk.red(
            t('woaru_engine.infrastructure_scan.scan_failed', { error: error })
          )
        );
      }
      return null;
    }
  }

  /**
   * Combine security findings from different tools
   */
  private combineSecurityFindings(
    securityResults: SecurityScanResult[],
    infrastructureResults: InfrastructureSecurityResult | null
  ): SecurityCombinedFindings {
    let total = 0;
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let secrets = 0;
    let vulnerabilities = 0;

    // Count findings from security tools (Snyk, Gitleaks)
    securityResults.forEach(result => {
      total += result.summary.total;
      critical += result.summary.critical;
      high += result.summary.high;
      medium += result.summary.medium;
      low += result.summary.low;

      if (result.tool === 'gitleaks') {
        secrets += result.findings.length;
      } else if (result.tool === 'snyk') {
        vulnerabilities += result.findings.length;
      }
    });

    // Add infrastructure findings
    if (infrastructureResults) {
      total += infrastructureResults.summary.total;
      critical += infrastructureResults.summary.critical;
      high += infrastructureResults.summary.high;
      medium += infrastructureResults.summary.medium;
      low += infrastructureResults.summary.low;
    }

    return {
      total,
      critical,
      high,
      medium,
      low,
      secrets,
      vulnerabilities,
    };
  }

  /**
   * Calculate comprehensive security score including all security aspects
   */
  private calculateComprehensiveSecurityScore(
    allFindings: SecurityCombinedFindings,
    securityAudits: ConfigurationAudit[],
    infrastructureResults: InfrastructureSecurityResult | null
  ): number {
    let score = 100;

    // Penalize based on security findings
    score -= allFindings.critical * 30; // Critical vulnerabilities are severe
    score -= allFindings.high * 20;
    score -= allFindings.medium * 10;
    score -= allFindings.low * 3;
    score -= allFindings.secrets * 25; // Exposed secrets are very serious

    // Penalize based on production audit findings
    securityAudits.forEach(audit => {
      switch (audit.priority) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 8;
          break;
        case 'low':
          score -= 3;
          break;
      }
    });

    // Penalize for infrastructure issues
    if (infrastructureResults) {
      score -= infrastructureResults.summary.critical * 20;
      score -= infrastructureResults.summary.high * 12;
      score -= infrastructureResults.summary.medium * 6;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get list of security tools that were used in the analysis
   */
  private getSecurityToolsUsed(
    securityResults: SecurityScanResult[],
    infrastructureResults: InfrastructureSecurityResult | null
  ): string[] {
    const tools = new Set<string>();

    securityResults.forEach(result => {
      if (!result.error) {
        tools.add(result.tool);
      }
    });

    if (infrastructureResults && !('error' in infrastructureResults)) {
      tools.add('trivy');
    }

    return Array.from(tools);
  }

  /**
   * Generate actionable security recommendations
   */
  private generateSecurityRecommendations(
    allFindings: SecurityCombinedFindings,
    securityAudits: ConfigurationAudit[]
  ): string[] {
    const recommendations: string[] = [];

    if (allFindings.critical > 0) {
      recommendations.push(
        t('woaru_engine.security_recommendations.critical_urgent', {
          count: allFindings.critical,
        })
      );
    }

    if (allFindings.secrets > 0) {
      recommendations.push(
        t('woaru_engine.security_recommendations.secrets_urgent', {
          count: allFindings.secrets,
        })
      );
    }

    if (allFindings.vulnerabilities > 0) {
      recommendations.push(
        t('woaru_engine.security_recommendations.update_dependencies', {
          count: allFindings.vulnerabilities,
        })
      );
    }

    if (allFindings.high > 0) {
      recommendations.push(
        t('woaru_engine.security_recommendations.high_severity', {
          count: allFindings.high,
        })
      );
    }

    const criticalAudits = securityAudits.filter(
      a => a.priority === 'critical'
    );
    if (criticalAudits.length > 0) {
      recommendations.push(
        t('woaru_engine.security_recommendations.configure_tools', {
          tools: criticalAudits.map(a => a.check).join(', '),
        })
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        t('woaru_engine.security_recommendations.no_critical_issues')
      );
    }

    return recommendations;
  }

  /**
   * Helper to check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const fs = await import('fs-extra');
      return await fs.pathExists(filePath);
    } catch {
      return false;
    }
  }
}
