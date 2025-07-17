import { ProjectAnalyzer } from '../analyzer/ProjectAnalyzer';
import { CodeAnalyzer } from '../analyzer/CodeAnalyzer';
import { DatabaseManager } from '../database/DatabaseManager';
import { PluginManager } from '../plugins/PluginManager';
import { ActionManager } from '../actions/ActionManager';
import { ProductionReadinessAuditor } from '../auditor/ProductionReadinessAuditor';
import { QualityRunner } from '../quality/QualityRunner';
import { NotificationManager } from '../supervisor/NotificationManager';
import { SecurityScanResult, SecurityFinding } from '../types/security';
import { AnalysisResult, SetupOptions, ProjectAnalysis } from '../types';
import chalk from 'chalk';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

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
      console.log(chalk.blue('🔍 Analyzing project...'));

      const analysis = await this.projectAnalyzer.analyzeProject(projectPath);
      const metadata =
        await this.projectAnalyzer.getProjectMetadata(projectPath);

      console.log(
        chalk.gray(`📦 Project: ${metadata.name} (${metadata.version})`)
      );
      console.log(chalk.gray(`🔧 Language: ${analysis.language}`));
      console.log(
        chalk.gray(
          `⚡ Frameworks: ${analysis.framework.join(', ') || 'None detected'}`
        )
      );

      // Analyze code for specific insights
      console.log(chalk.blue('🔬 Analyzing codebase for insights...'));
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
      console.log(chalk.blue('🔒 Running comprehensive security analysis...'));
      const securityResults =
        await this.runComprehensiveSecurityAnalysis(projectPath);

      // Run infrastructure security check
      console.log(chalk.blue('🛡️ Running infrastructure security audit...'));
      const infrastructureResults =
        await this.runInfrastructureSecurityCheck(projectPath);

      // Run production-readiness audit (including security)
      console.log(chalk.blue('🏗️ Running production readiness audit...'));
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
            `🚨 ${totalCritical} critical security issues found across codebase and infrastructure!`
          )
        );
      }
      if (totalHigh > 0) {
        console.log(
          chalk.yellow(`⚠️ ${totalHigh} high-severity security issues found!`)
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
          // Extended security metrics
          secrets_found: allSecurityFindings.secrets,
          vulnerabilities_found: allSecurityFindings.vulnerabilities,
          infrastructure_issues: infrastructureResults?.findings?.length || 0,
          tools_used: this.getSecurityToolsUsed(
            securityResults,
            infrastructureResults
          ),
          recommendations: this.generateSecurityRecommendations(
            allSecurityFindings,
            securityAudits
          ),
        } as any,
        // Add detailed security results (extended data)
        detailed_security: {
          dependency_vulnerabilities: securityResults,
          infrastructure_security: infrastructureResults,
          configuration_audits: securityAudits,
        },
      } as any; // Extended with comprehensive security analysis
    } catch (error) {
      throw new Error(
        `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
        console.log(chalk.green('✅ Project is already well configured!'));
        return true;
      }

      console.log(
        chalk.blue(`🎯 Found ${recommendations.length} recommendations`)
      );

      if (options.dryRun) {
        console.log(
          chalk.yellow('🔍 Dry run mode - showing what would be done:')
        );
        recommendations.forEach(rec => {
          console.log(chalk.gray(`  • ${rec.tool}: ${rec.reason}`));
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
          `❌ Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      return false;
    }
  }

  async updateDatabase(): Promise<boolean> {
    console.log(chalk.blue('📡 Updating tools database...'));

    const success = await this.databaseManager.updateDatabase();

    if (success) {
      console.log(chalk.green('✅ Database updated successfully'));
    } else {
      console.log(chalk.red('❌ Failed to update database'));
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
        `Warning: Tool detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
      throw new Error(`Invalid project path: ${validPath}`);
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
      automations.push(
        'Generate Next.js API routes with proper TypeScript types'
      );
      automations.push(
        'Create reusable Next.js components with proper prop types'
      );
      automations.push('Setup Next.js middleware for authentication');
    }

    if (analysis.framework.includes('react')) {
      automations.push(
        'Refactor class components to functional components with hooks'
      );
      automations.push('Generate custom hooks for common functionality');
      automations.push('Create component documentation with Storybook');
    }

    // Language-specific automations
    if (analysis.language === 'TypeScript') {
      automations.push('Generate TypeScript interfaces from API responses');
      automations.push('Add strict typing to existing JavaScript functions');
      automations.push('Create utility types for better type safety');
    }

    // Testing automations
    if (
      !analysis.devDependencies.includes('jest') &&
      !analysis.devDependencies.includes('vitest')
    ) {
      automations.push('Setup testing framework with example tests');
      automations.push('Generate unit tests for existing components');
    }

    // Documentation automations
    automations.push('Generate README.md with project setup instructions');
    automations.push('Create CONTRIBUTING.md with development guidelines');
    automations.push('Generate API documentation from code comments');

    return automations;
  }

  private enhanceRecommendationsWithInsights(
    recommendations: any[],
    codeInsights: Map<string, any>
  ): void {
    recommendations.forEach((rec: any) => {
      const insight = codeInsights.get(rec.tool);
      if (insight) {
        rec.reason = insight.reason;
        rec.evidence = insight.evidence;
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

  private calculateSecurityHealthScore(securityAudits: any[]): number {
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
    projectPath: string
  ): Promise<SecurityScanResult[]> {
    console.log(chalk.gray('   Running Snyk + Gitleaks security scan...'));

    try {
      // Get all project files for security scanning
      const allFiles: string[] = [];
      // For comprehensive analysis, we can scan the entire project

      const securityResults =
        await this.qualityRunner.runSecurityChecksForReview(allFiles);

      // Log summary of findings
      let totalFindings = 0;
      let criticalFindings = 0;
      securityResults.forEach(result => {
        totalFindings += result.summary.total;
        criticalFindings += result.summary.critical;

        if (result.error) {
          console.log(chalk.red(`   ⚠️  ${result.tool}: ${result.error}`));
        } else if (result.summary.total > 0) {
          console.log(
            chalk.yellow(
              `   🔍 ${result.tool}: ${result.summary.total} issues found`
            )
          );
        } else {
          console.log(chalk.green(`   ✅ ${result.tool}: No issues found`));
        }
      });

      if (criticalFindings > 0) {
        console.log(
          chalk.red(
            `   🚨 ${criticalFindings} critical security vulnerabilities detected!`
          )
        );
      }

      return securityResults;
    } catch (error) {
      console.log(chalk.red(`   ❌ Security analysis failed: ${error}`));
      return [];
    }
  }

  /**
   * Run infrastructure security check using Trivy
   */
  private async runInfrastructureSecurityCheck(
    projectPath: string
  ): Promise<any> {
    console.log(chalk.gray('   Scanning containers and infrastructure...'));

    try {
      // Check if Trivy is installed
      await execAsync('which trivy');

      const findings: any[] = [];
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
              results.Results.forEach((result: any) => {
                if (result.Misconfigurations) {
                  result.Misconfigurations.forEach((misc: any) => {
                    findings.push({
                      tool: 'trivy',
                      type: 'misconfiguration',
                      severity: misc.Severity?.toLowerCase() || 'medium',
                      title: misc.Title,
                      description: misc.Description,
                      file: target.path,
                      recommendation: misc.Resolution,
                      references: misc.References,
                    });
                  });
                }
              });
            }
          }

          console.log(
            chalk.green(`   ✅ Trivy: Scanned ${target.type} - ${target.path}`)
          );
        } catch (scanError) {
          console.log(
            chalk.yellow(`   ⚠️  Trivy: Failed to scan ${target.path}`)
          );
        }
      }

      if (scanTargets.length === 0) {
        console.log(chalk.gray('   📋 No infrastructure files found to scan'));
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
            `   🛡️  Trivy: ${findings.length} infrastructure issues found`
          )
        );
      } else {
        console.log(chalk.green(`   ✅ Trivy: No infrastructure issues found`));
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
          chalk.gray('   📋 Trivy not installed - skipping infrastructure scan')
        );
        console.log(
          chalk.gray(
            '   💡 Install with: brew install trivy (macOS) or apt-get install trivy (Linux)'
          )
        );
      } else {
        console.log(chalk.red(`   ❌ Infrastructure scan failed: ${error}`));
      }
      return null;
    }
  }

  /**
   * Combine security findings from different tools
   */
  private combineSecurityFindings(
    securityResults: SecurityScanResult[],
    infrastructureResults: any
  ): any {
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
    allFindings: any,
    securityAudits: any[],
    infrastructureResults: any
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
    infrastructureResults: any
  ): string[] {
    const tools = new Set<string>();

    securityResults.forEach(result => {
      if (!result.error) {
        tools.add(result.tool);
      }
    });

    if (infrastructureResults && !infrastructureResults.error) {
      tools.add('trivy');
    }

    return Array.from(tools);
  }

  /**
   * Generate actionable security recommendations
   */
  private generateSecurityRecommendations(
    allFindings: any,
    securityAudits: any[]
  ): string[] {
    const recommendations: string[] = [];

    if (allFindings.critical > 0) {
      recommendations.push(
        `🚨 URGENT: Fix ${allFindings.critical} critical security vulnerabilities immediately`
      );
    }

    if (allFindings.secrets > 0) {
      recommendations.push(
        `🔐 URGENT: Remove ${allFindings.secrets} exposed secrets from codebase and rotate them`
      );
    }

    if (allFindings.vulnerabilities > 0) {
      recommendations.push(
        `📦 Update vulnerable dependencies - ${allFindings.vulnerabilities} packages need attention`
      );
    }

    if (allFindings.high > 0) {
      recommendations.push(
        `⚠️ Address ${allFindings.high} high-severity security issues`
      );
    }

    const criticalAudits = securityAudits.filter(
      a => a.priority === 'critical'
    );
    if (criticalAudits.length > 0) {
      recommendations.push(
        `🔧 Configure missing security tools: ${criticalAudits.map(a => a.check).join(', ')}`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        '✅ No critical security issues found - maintain good security hygiene'
      );
    }

    return recommendations;
  }

  /**
   * Helper to check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const fs = require('fs-extra');
      return await fs.pathExists(filePath);
    } catch {
      return false;
    }
  }
}
