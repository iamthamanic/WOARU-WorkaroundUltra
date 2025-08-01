/**
 * WOARU Production Readiness Auditor Module
 * Production-Ready implementation with comprehensive security and error handling
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { PackageJson } from '../types';
import { ToolsDatabaseManager } from '../database/ToolsDatabaseManager';
import { QualityRunner } from '../quality/QualityRunner';
import { NotificationManager } from '../supervisor/NotificationManager';
import { t, initializeI18n } from '../config/i18n';

/**
 * Security constants for input validation
 */
const SECURITY_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_PATH_LENGTH: 500,
  MAX_PACKAGE_NAME_LENGTH: 100,
  MAX_VULNERABILITIES_DISPLAY: 10,
  MAX_AUDIT_TIME: 60000, // 60 seconds
} as const;

/**
 * Sanitizes package names to prevent injection attacks
 * @param packageName - The package name to sanitize
 * @returns Sanitized package name safe for display
 */
function sanitizePackageName(packageName: unknown): string {
  if (typeof packageName !== 'string') {
    return 'unknown-package';
  }

  return (
    packageName
      .replace(/[^a-zA-Z0-9@/_.-]/g, '')
      .substring(0, SECURITY_LIMITS.MAX_PACKAGE_NAME_LENGTH) ||
    'unknown-package'
  );
}

/**
 * Sanitizes file paths to prevent directory traversal
 * @param filePath - The file path to sanitize
 * @returns Sanitized file path safe for processing
 */
function sanitizeFilePath(filePath: unknown): string {
  if (typeof filePath !== 'string') {
    return 'unknown-file';
  }

  const normalized = path.normalize(filePath);

  // Check for directory traversal
  if (normalized.includes('..') || normalized.includes('\x00')) {
    return 'suspicious-file';
  }

  const baseName = path.basename(normalized);
  return (
    baseName.replace(/[^a-zA-Z0-9._-]/g, '').substring(0, 100) || 'unknown-file'
  );
}

/**
 * Sanitizes error messages to prevent information leakage
 * @param error - The error to sanitize
 * @returns Sanitized error message safe for display
 */
function sanitizeError(error: unknown): string {
  if (typeof error === 'string') {
    return error.replace(/\/[^\s]*\/[^\s]*/g, '[PATH]').substring(0, 200);
  }

  if (error instanceof Error) {
    return sanitizeError(error.message);
  }

  return 'Unknown audit error';
}

// Removed unused isValidVulnerability function

/**
 * Validates project path for security
 * @param projectPath - Project path to validate
 * @returns True if path appears safe
 */
function isSecureProjectPath(projectPath: string): boolean {
  try {
    const normalized = path.normalize(projectPath);

    // Check for suspicious patterns
    if (
      normalized.includes('..') ||
      normalized.includes('\x00') ||
      normalized.length > SECURITY_LIMITS.MAX_PATH_LENGTH
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

interface Tool {
  name: string;
  languages: string[];
  frameworks: string[] | { [framework: string]: string };
  popularity: number;
  keywords: string[];
  installCommand: string | { [platform: string]: string };
  configFiles?: string[];
  description: string;
  homepage: string;
  isRecommended: boolean;
  isNewAndTrending?: boolean;
  successorOf?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  filePatterns?: { [type: string]: string[] };

  // Enriched ecosystem data
  downloads?: {
    weekly: number;
    lastWeek: string;
  };
  stars?: number;
  lastCommit?: string;
  lastRelease?: string;
  openIssues?: number;
  contributors?: number;
  isDeprecated?: boolean;
  successor?: string;
  lastDataUpdate?: string;
}

export interface ProductionAudit {
  category:
    | 'error-monitoring'
    | 'testing'
    | 'containerization'
    | 'security'
    | 'config';
  check: string;
  status: 'missing' | 'found' | 'partial';
  priority: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  recommendation: string;
  packages?: string[];
  files?: string[];
}

export interface AuditConfig {
  language: string;
  frameworks: string[];
  projectType: 'frontend' | 'backend' | 'fullstack' | 'library' | 'cli';
}

export class ProductionReadinessAuditor {
  private projectPath: string;
  private databaseManager: ToolsDatabaseManager;
  private auditMetrics = {
    auditsPerformed: 0,
    totalIssuesFound: 0,
    criticalIssuesFound: 0,
    averageAuditTime: 0,
    securityIssues: 0,
  };

  constructor(projectPath: string) {
    if (!isSecureProjectPath(projectPath)) {
      throw new Error('Invalid or suspicious project path provided');
    }

    this.projectPath = path.normalize(projectPath);
    this.databaseManager = new ToolsDatabaseManager();
  }

  /**
   * Perform comprehensive project audit with security validation
   * @param config - Audit configuration
   * @returns Promise<ProductionAudit[]> Array of audit findings
   */
  async auditProject(config: AuditConfig): Promise<ProductionAudit[]> {
    const startTime = Date.now();

    try {
      await initializeI18n();

      // Validate configuration
      if (!this.validateAuditConfig(config)) {
        console.warn('Invalid audit configuration provided');
        return [];
      }

      const audits: ProductionAudit[] = [];

      // Run all audit categories with timeout protection
      const auditPromises = [
        this.auditErrorMonitoring(config),
        this.auditTestingFramework(config),
        this.auditContainerization(config),
        this.auditSecurity(config),
        this.auditEnvironmentConfig(config),
      ];

      const results = await Promise.allSettled(
        auditPromises.map(p =>
          this.withTimeout(p, SECURITY_LIMITS.MAX_AUDIT_TIME)
        )
      );

      // Process results and collect successful audits
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          audits.push(...result.value);
        } else {
          console.debug(
            `Audit ${index} failed: ${sanitizeError(result.reason)}`
          );
        }
      });

      // Update metrics
      this.updateAuditMetrics(audits, Date.now() - startTime);

      return audits.filter(
        audit => audit.status === 'missing' || audit.status === 'partial'
      );
    } catch (error) {
      console.error(`Project audit failed: ${sanitizeError(error)}`);
      return [];
    }
  }

  /**
   * Validate audit configuration for security
   */
  private validateAuditConfig(config: AuditConfig): boolean {
    if (!config || typeof config !== 'object') {
      return false;
    }

    const validLanguages = [
      'javascript',
      'typescript',
      'python',
      'java',
      'go',
      'rust',
    ];
    const validProjectTypes = [
      'frontend',
      'backend',
      'fullstack',
      'library',
      'cli',
    ];

    return (
      typeof config.language === 'string' &&
      validLanguages.includes(config.language.toLowerCase()) &&
      typeof config.projectType === 'string' &&
      validProjectTypes.includes(config.projectType) &&
      Array.isArray(config.frameworks)
    );
  }

  /**
   * Add timeout protection to audit operations
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Audit operation timeout'));
      }, timeout);

      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  /**
   * Update audit performance metrics
   */
  private updateAuditMetrics(
    audits: ProductionAudit[],
    duration: number
  ): void {
    this.auditMetrics.auditsPerformed++;
    this.auditMetrics.totalIssuesFound += audits.length;
    this.auditMetrics.criticalIssuesFound += audits.filter(
      a => a.priority === 'critical'
    ).length;
    this.auditMetrics.averageAuditTime =
      (this.auditMetrics.averageAuditTime + duration) / 2;
  }

  /**
   * Focused audit on changed files only with security validation
   * @param changedFiles - Array of changed file paths
   * @param config - Audit configuration
   * @returns Promise<ProductionAudit[]> Array of relevant audit findings
   */
  async auditChangedFiles(
    changedFiles: string[],
    config: AuditConfig
  ): Promise<ProductionAudit[]> {
    try {
      await initializeI18n();

      // Validate inputs
      if (!Array.isArray(changedFiles) || !this.validateAuditConfig(config)) {
        console.warn(t('production_auditor.invalid_changed_files_config'));
        return [];
      }

      // Sanitize file paths
      const sanitizedFiles = changedFiles
        .filter(file => typeof file === 'string' && file.length > 0)
        .map(file => sanitizeFilePath(file))
        .slice(0, 100); // Limit number of files

      const audits: ProductionAudit[] = [];

      // Categorize changed files
      const relevantFiles = this.categorizeRelevantFiles(sanitizedFiles);

      // Only audit categories that are relevant to the changed files
      if (relevantFiles.packageJson.length > 0) {
        audits.push(...(await this.auditErrorMonitoring(config)));
        audits.push(...(await this.auditTestingFramework(config)));
        audits.push(...(await this.auditSecurity(config)));
      }

      if (relevantFiles.docker.length > 0) {
        audits.push(...(await this.auditContainerization(config)));
      }

      if (relevantFiles.config.length > 0) {
        audits.push(...(await this.auditEnvironmentConfig(config)));
      }

      if (relevantFiles.source.length > 0) {
        audits.push(
          ...this.auditSourceFileChanges(relevantFiles.source, config)
        );
      }

      return audits.filter(
        audit => audit.status === 'missing' || audit.status === 'partial'
      );
    } catch (error) {
      console.error(
        t('production_auditor.audit_changed_files_error'),
        sanitizeError(error)
      );
      return [];
    }
  }

  private async auditErrorMonitoring(
    config: AuditConfig
  ): Promise<ProductionAudit[]> {
    const audits: ProductionAudit[] = [];

    try {
      // Get error monitoring tools from live database
      const errorMonitoringTools =
        await this.databaseManager.getToolsByCategory('error-monitoring');

      if (
        config.language === 'javascript' ||
        config.language === 'typescript'
      ) {
        const packageJson = await this.readPackageJson();
        if (!packageJson) return audits;

        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        const depsList = Object.keys(allDeps);

        // Check if any error monitoring tools are installed using database keywords
        let hasErrorTracking = false;
        // foundTool tracking removed as unused

        for (const [toolKey, tool] of Object.entries(errorMonitoringTools) as [
          string,
          Tool,
        ][]) {
          const hasThisTool = tool.keywords.some((keyword: string) =>
            depsList.some(dep => dep.includes(keyword))
          );

          if (hasThisTool) {
            hasErrorTracking = true;
            // tool.name would be stored in foundTool but not used

            // Check if the found tool is deprecated
            if (tool.isDeprecated) {
              this.addDeprecationWarning(audits, tool, toolKey);
            }
            break;
          }
        }

        if (!hasErrorTracking) {
          // Get recommended tool for the specific framework
          const recommendedTool = this.getRecommendedErrorMonitoringTool(
            errorMonitoringTools as Record<string, Tool>,
            config.frameworks
          );

          // Get alternative recommendations (sorted by popularity, excluding deprecated)
          const alternatives = (Object.values(errorMonitoringTools) as Tool[])
            .filter(
              (tool: Tool) =>
                tool.name !== recommendedTool.name && !tool.isDeprecated
            )
            .sort((a: Tool, b: Tool) => {
              const popularityDiff = (b.popularity || 0) - (a.popularity || 0);
              if (popularityDiff !== 0) return popularityDiff;
              return (b.downloads?.weekly || 0) - (a.downloads?.weekly || 0);
            })
            .slice(0, 2);

          // Single consolidated recommendation
          audits.push({
            category: 'error-monitoring',
            check: 'error-tracking-setup',
            status: 'missing',
            priority: config.projectType === 'library' ? 'low' : 'critical',
            message: t('production_auditor.error_monitoring_critical'),
            recommendation: t(
              'production_auditor.error_monitoring_recommendation',
              {
                tool: sanitizePackageName(recommendedTool.name),
                alternatives:
                  alternatives.length > 0
                    ? ` (Alternativen: ${alternatives.map(t => sanitizePackageName(t.name)).join(', ')})`
                    : '',
                installCommand: this.getInstallCommand(
                  recommendedTool,
                  config.frameworks
                ),
              }
            ),
            packages: [
              ...this.getRecommendedPackages(
                recommendedTool,
                config.frameworks
              ),
              ...this.getAllErrorMonitoringPackages(
                errorMonitoringTools as Record<string, Tool>,
                config.frameworks
              ).slice(0, 3),
            ],
          });
        }
      }
    } catch {
      // Fallback to original logic if database fails
      return this.auditErrorMonitoringFallback(config);
    }

    if (config.language === 'python') {
      // Check for Python error monitoring
      const requirementFiles = [
        'requirements.txt',
        'pyproject.toml',
        'Pipfile',
      ];
      let hasPythonErrorTracking = false;

      for (const file of requirementFiles) {
        const filePath = path.join(this.projectPath, file);
        if (await fs.pathExists(filePath)) {
          const content = await fs.readFile(filePath, 'utf-8');
          if (
            content.includes('sentry-sdk') ||
            content.includes('rollbar') ||
            content.includes('bugsnag')
          ) {
            hasPythonErrorTracking = true;
            break;
          }
        }
      }

      if (!hasPythonErrorTracking) {
        audits.push({
          category: 'error-monitoring',
          check: 'python-error-tracking',
          status: 'missing',
          priority: 'high',
          message: '💡 PRO-TIPP: Kein Error-Monitoring für Python gefunden',
          recommendation: 'Installiere sentry-sdk: pip install sentry-sdk',
          packages: ['sentry-sdk'],
        });
      }
    }

    return audits;
  }

  private async auditTestingFramework(
    config: AuditConfig
  ): Promise<ProductionAudit[]> {
    const audits: ProductionAudit[] = [];

    if (config.language === 'javascript' || config.language === 'typescript') {
      const packageJson = await this.readPackageJson();
      if (!packageJson) return audits;

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      const testingFrameworks = [
        'jest',
        'vitest',
        'mocha',
        'jasmine',
        'cypress',
        'playwright',
        '@testing-library/react',
      ];
      const hasTestingFramework = testingFrameworks.some(
        framework => allDeps[framework]
      );

      if (!hasTestingFramework) {
        audits.push({
          category: 'testing',
          check: 'testing-framework',
          status: 'missing',
          priority: config.projectType === 'library' ? 'critical' : 'high',
          message: '⚠️ WARNUNG: Kein Testing-Framework gefunden',
          recommendation:
            'Tests sind essentiell für Code-Qualität. Für React: npm install --save-dev jest @testing-library/react, für allgemein: npm install --save-dev vitest',
          packages: ['jest', 'vitest', '@testing-library/react'],
        });
      }

      // Check for test scripts
      const hasTestScript =
        packageJson.scripts &&
        (packageJson.scripts.test ||
          packageJson.scripts['test:unit'] ||
          packageJson.scripts['test:e2e']);

      if (hasTestingFramework && !hasTestScript) {
        audits.push({
          category: 'testing',
          check: 'test-scripts',
          status: 'partial',
          priority: 'medium',
          message:
            'Testing-Framework gefunden, aber keine Test-Scripts in package.json',
          recommendation:
            'Füge Test-Scripts hinzu: "test": "jest" oder "test": "vitest"',
        });
      }
    }

    if (config.language === 'python') {
      const requirementFiles = [
        'requirements.txt',
        'pyproject.toml',
        'Pipfile',
      ];
      let hasPythonTesting = false;

      for (const file of requirementFiles) {
        const filePath = path.join(this.projectPath, file);
        if (await fs.pathExists(filePath)) {
          const content = await fs.readFile(filePath, 'utf-8');
          if (
            content.includes('pytest') ||
            content.includes('unittest') ||
            content.includes('nose')
          ) {
            hasPythonTesting = true;
            break;
          }
        }
      }

      if (!hasPythonTesting) {
        audits.push({
          category: 'testing',
          check: 'python-testing',
          status: 'missing',
          priority: 'high',
          message: '⚠️ WARNUNG: Kein Testing-Framework für Python gefunden',
          recommendation: 'Installiere pytest: pip install pytest',
          packages: ['pytest'],
        });
      }
    }

    return audits;
  }

  private async auditContainerization(
    config: AuditConfig
  ): Promise<ProductionAudit[]> {
    const audits: ProductionAudit[] = [];

    const dockerfilePath = path.join(this.projectPath, 'Dockerfile');
    const hasDockerfile = await fs.pathExists(dockerfilePath);

    if (!hasDockerfile && config.projectType !== 'library') {
      audits.push({
        category: 'containerization',
        check: 'dockerfile',
        status: 'missing',
        priority: 'medium',
        message: '🐳 Kein Dockerfile gefunden',
        recommendation:
          'Containerisierung vereinfacht Deployment und Skalierung. Erstelle ein Dockerfile für konsistente Deployments.',
        files: ['Dockerfile'],
      });
    }

    const dockerIgnorePath = path.join(this.projectPath, '.dockerignore');
    const hasDockerIgnore = await fs.pathExists(dockerIgnorePath);

    if (hasDockerfile && !hasDockerIgnore) {
      audits.push({
        category: 'containerization',
        check: 'dockerignore',
        status: 'partial',
        priority: 'low',
        message: 'Dockerfile gefunden, aber keine .dockerignore',
        recommendation:
          'Erstelle .dockerignore um Build-Performance zu verbessern und Image-Größe zu reduzieren.',
        files: ['.dockerignore'],
      });
    }

    return audits;
  }

  private async auditSecurity(config: AuditConfig): Promise<ProductionAudit[]> {
    const audits: ProductionAudit[] = [];

    // Run comprehensive Snyk security scan
    try {
      const notificationManager = new NotificationManager({
        terminal: false,
        desktop: false,
      });
      const qualityRunner = new QualityRunner(notificationManager);

      // Get all project files for comprehensive scan
      const allFiles = await this.getAllProjectFiles();
      const snykResults = await qualityRunner.runSnykChecks(allFiles);

      // Process Snyk results into production audits
      for (const result of snykResults) {
        if (result.error) {
          // If Snyk is not installed or configured
          audits.push({
            category: 'security',
            check: 'snyk-setup',
            status: 'missing',
            priority: 'critical',
            message: '🚨 Snyk Security Scanner nicht konfiguriert',
            recommendation: result.error.includes('not installed')
              ? 'Installiere Snyk global: npm install -g snyk && snyk auth'
              : 'Konfiguriere Snyk: snyk auth',
            packages: ['snyk'],
          });
          continue;
        }

        // Process dependency vulnerabilities
        if (
          result.type === 'dependencies' &&
          result.vulnerabilities &&
          result.vulnerabilities.length > 0
        ) {
          const criticalVulns = result.vulnerabilities.filter(
            v => v.severity === 'critical'
          );
          const highVulns = result.vulnerabilities.filter(
            v => v.severity === 'high'
          );
          const mediumVulns = result.vulnerabilities.filter(
            v => v.severity === 'medium'
          );

          if (criticalVulns.length > 0) {
            audits.push({
              category: 'security',
              check: 'critical-vulnerabilities',
              status: 'missing',
              priority: 'critical',
              message: `🚨 ${criticalVulns.length} KRITISCHE Sicherheitslücken in Dependencies gefunden`,
              recommendation: `Sofortiges Handeln erforderlich! ${criticalVulns.filter(v => v.isUpgradable).length} können durch Updates behoben werden. Führe "snyk wizard" aus für geführte Behebung.`,
              packages: [
                ...new Set(
                  criticalVulns
                    .filter(v => v.isUpgradable)
                    .map(v => v.packageName)
                ),
              ],
            });

            // Add specific critical vulnerabilities (max 3)
            criticalVulns.slice(0, 3).forEach(vuln => {
              audits.push({
                category: 'security',
                check: `vuln-${vuln.id}`,
                status: 'missing',
                priority: 'critical',
                message: `🔴 ${vuln.title} in ${vuln.packageName}@${vuln.version}`,
                recommendation: vuln.isUpgradable
                  ? `Update auf ${vuln.fixedIn?.[0] || 'neueste Version'}: npm update ${vuln.packageName}`
                  : `Kein direkter Fix verfügbar. Erwäge Alternative oder warte auf Patch.`,
                packages: vuln.isUpgradable ? [vuln.packageName] : [],
              });
            });
          }

          if (highVulns.length > 0) {
            audits.push({
              category: 'security',
              check: 'high-vulnerabilities',
              status: 'missing',
              priority: 'high',
              message: `⚠️ ${highVulns.length} hohe Sicherheitslücken in Dependencies`,
              recommendation: `${highVulns.filter(v => v.isUpgradable).length} können durch Updates behoben werden. Führe "snyk test" für Details aus.`,
              packages: [
                ...new Set(
                  highVulns
                    .filter(v => v.isUpgradable)
                    .map(v => v.packageName)
                    .slice(0, 5)
                ),
              ],
            });
          }

          if (mediumVulns.length > 5) {
            audits.push({
              category: 'security',
              check: 'medium-vulnerabilities',
              status: 'partial',
              priority: 'medium',
              message: `🔵 ${mediumVulns.length} mittlere Sicherheitslücken gefunden`,
              recommendation:
                'Plane Updates für betroffene Packages ein. Führe "snyk test --severity-threshold=medium" aus.',
              packages: [],
            });
          }
        }

        // Process code vulnerabilities
        if (
          result.type === 'code' &&
          result.codeIssues &&
          result.codeIssues.length > 0
        ) {
          const criticalCodeIssues = result.codeIssues.filter(
            i => i.severity === 'critical'
          );
          const highCodeIssues = result.codeIssues.filter(
            i => i.severity === 'high'
          );

          if (criticalCodeIssues.length > 0) {
            audits.push({
              category: 'security',
              check: 'code-vulnerabilities-critical',
              status: 'missing',
              priority: 'critical',
              message: `🚨 ${criticalCodeIssues.length} kritische Sicherheitsprobleme im Code gefunden`,
              recommendation:
                'Behebe diese Sicherheitslücken sofort! Führe "snyk code test" für Details aus.',
              files: [...new Set(criticalCodeIssues.map(i => i.filePath))],
            });
          }

          if (highCodeIssues.length > 0) {
            audits.push({
              category: 'security',
              check: 'code-vulnerabilities-high',
              status: 'missing',
              priority: 'high',
              message: `⚠️ ${highCodeIssues.length} hohe Sicherheitsprobleme im Code`,
              recommendation:
                'Review und behebe diese Sicherheitsprobleme vor dem Production-Deploy.',
              files: [
                ...new Set(highCodeIssues.map(i => i.filePath).slice(0, 5)),
              ],
            });
          }
        }
      }
    } catch (error) {
      // If Snyk scan fails completely, still run basic security checks
      console.warn(
        'Snyk security scan failed, falling back to basic checks:',
        error
      );
    }

    // Basic security checks (always run these)
    if (config.language === 'javascript' || config.language === 'typescript') {
      const packageJson = await this.readPackageJson();
      if (!packageJson) return audits;

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Check for helmet (Express security)
      if (allDeps.express && !allDeps.helmet) {
        audits.push({
          category: 'security',
          check: 'helmet',
          status: 'missing',
          priority: 'high',
          message: '🔒 Express ohne Helmet-Schutz',
          recommendation:
            'Installiere Helmet für sichere HTTP-Headers: npm install helmet',
          packages: ['helmet'],
        });
      }

      // Check for HTTPS enforcement
      const hasHttpsEnforcement =
        allDeps['express-enforces-ssl'] || allDeps['express-sslify'];

      if (
        allDeps.express &&
        !hasHttpsEnforcement &&
        config.projectType === 'backend'
      ) {
        audits.push({
          category: 'security',
          check: 'https-enforcement',
          status: 'missing',
          priority: 'high',
          message: '🔒 Keine HTTPS-Enforcement gefunden',
          recommendation:
            'Erzwinge HTTPS in Production: npm install express-enforces-ssl',
          packages: ['express-enforces-ssl'],
        });
      }

      // Check for security headers middleware
      if (
        config.frameworks.includes('next') &&
        !allDeps['next-secure-headers']
      ) {
        audits.push({
          category: 'security',
          check: 'security-headers',
          status: 'missing',
          priority: 'medium',
          message: '🔒 Keine Security Headers Konfiguration für Next.js',
          recommendation:
            'Installiere next-secure-headers für besseren Schutz: npm install next-secure-headers',
          packages: ['next-secure-headers'],
        });
      }

      // Check for rate limiting
      if (
        allDeps.express &&
        !allDeps['express-rate-limit'] &&
        !allDeps['rate-limiter-flexible']
      ) {
        audits.push({
          category: 'security',
          check: 'rate-limiting',
          status: 'missing',
          priority: 'high',
          message: '🔒 Kein Rate Limiting zum Schutz vor DDoS/Brute-Force',
          recommendation:
            'Installiere express-rate-limit: npm install express-rate-limit',
          packages: ['express-rate-limit'],
        });
      }

      // Check for input validation
      if (
        !allDeps.joi &&
        !allDeps.yup &&
        !allDeps['express-validator'] &&
        !allDeps.zod
      ) {
        audits.push({
          category: 'security',
          check: 'input-validation',
          status: 'missing',
          priority: 'high',
          message: '🔒 Keine Input-Validierungs-Bibliothek gefunden',
          recommendation:
            'Installiere eine Validierungs-Bibliothek wie Joi oder Zod für sichere Input-Verarbeitung',
          packages: ['joi', 'zod', 'yup'],
        });
      }
    }

    // Python security checks
    if (config.language === 'python') {
      const requirementFiles = [
        'requirements.txt',
        'pyproject.toml',
        'Pipfile',
      ];
      let hasBandit = false;
      // hasSafety variable removed as unused

      for (const file of requirementFiles) {
        const filePath = path.join(this.projectPath, file);
        if (await fs.pathExists(filePath)) {
          const content = await fs.readFile(filePath, 'utf-8');
          if (content.includes('bandit')) hasBandit = true;
          // if (content.includes('safety')) { /* hasSafety would be set but unused */ }
        }
      }

      if (!hasBandit) {
        audits.push({
          category: 'security',
          check: 'python-security-linter',
          status: 'missing',
          priority: 'high',
          message: '🔒 Kein Python Security Linter (Bandit) gefunden',
          recommendation:
            'Installiere Bandit für Security-Checks: pip install bandit',
          packages: ['bandit'],
        });
      }
    }

    return audits;
  }

  /**
   * Helper to get all project files (for comprehensive Snyk scan)
   */
  private async getAllProjectFiles(): Promise<string[]> {
    // Return empty array as Snyk scans the whole project anyway
    return [];
  }

  private async auditEnvironmentConfig(
    config: AuditConfig
  ): Promise<ProductionAudit[]> {
    const audits: ProductionAudit[] = [];

    const envExamplePath = path.join(this.projectPath, '.env.example');
    const envPath = path.join(this.projectPath, '.env');

    const hasEnvExample = await fs.pathExists(envExamplePath);
    const hasEnv = await fs.pathExists(envPath);

    if (hasEnv && !hasEnvExample) {
      audits.push({
        category: 'config',
        check: 'env-example',
        status: 'missing',
        priority: 'medium',
        message: '.env gefunden, aber keine .env.example',
        recommendation:
          'Erstelle .env.example für Team-Kollaboration und Setup-Dokumentation.',
        files: ['.env.example'],
      });
    }

    if (config.language === 'javascript' || config.language === 'typescript') {
      const packageJson = await this.readPackageJson();
      if (packageJson?.dependencies?.dotenv && !hasEnv && !hasEnvExample) {
        audits.push({
          category: 'config',
          check: 'env-config',
          status: 'partial',
          priority: 'medium',
          message: 'dotenv installiert, aber keine .env-Dateien gefunden',
          recommendation:
            'Erstelle .env für lokale Konfiguration und .env.example als Template.',
          files: ['.env', '.env.example'],
        });
      }
    }

    return audits;
  }

  private getSentryPackageForFramework(frameworks: string[]): string[] {
    if (frameworks.includes('next')) return ['@sentry/nextjs'];
    if (frameworks.includes('react')) return ['@sentry/react'];
    if (frameworks.includes('vue')) return ['@sentry/vue'];
    if (frameworks.includes('express')) return ['@sentry/node'];
    return ['@sentry/browser'];
  }

  private async readPackageJson(): Promise<PackageJson | null> {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const content = await fs.readJson(packageJsonPath);
      return content as PackageJson;
    } catch {
      return null;
    }
  }

  // Helper methods for changed file analysis
  private categorizeRelevantFiles(changedFiles: string[]): {
    packageJson: string[];
    docker: string[];
    config: string[];
    source: string[];
  } {
    const result = {
      packageJson: [] as string[],
      docker: [] as string[],
      config: [] as string[],
      source: [] as string[],
    };

    changedFiles.forEach(file => {
      const filename = path.basename(file);
      const ext = path.extname(file).toLowerCase();

      if (filename === 'package.json') {
        result.packageJson.push(file);
      } else if (
        filename.startsWith('Dockerfile') ||
        filename === '.dockerignore'
      ) {
        result.docker.push(file);
      } else if (this.isConfigFile(filename)) {
        result.config.push(file);
      } else if (this.isSourceFile(ext)) {
        result.source.push(file);
      }
    });

    return result;
  }

  private isConfigFile(filename: string): boolean {
    const configFiles = [
      '.env',
      '.env.example',
      '.env.local',
      '.env.production',
      'tsconfig.json',
      'jest.config.js',
      'webpack.config.js',
      '.eslintrc',
      '.prettierrc',
      'babel.config.js',
    ];
    return configFiles.some(config => filename.includes(config));
  }

  private isSourceFile(ext: string): boolean {
    const sourceExtensions = [
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.py',
      '.rs',
      '.go',
      '.java',
      '.cs',
      '.php',
      '.rb',
    ];
    return sourceExtensions.includes(ext);
  }

  private auditSourceFileChanges(
    sourceFiles: string[],
    _config: AuditConfig
  ): ProductionAudit[] {
    const audits: ProductionAudit[] = [];

    // Check if new components were added without tests
    const newComponents = sourceFiles.filter(
      file => file.includes('component') || file.includes('Component')
    );

    if (newComponents.length > 0) {
      audits.push({
        category: 'testing',
        check: 'new-components-testing',
        status: 'missing',
        priority: 'high',
        message: `${newComponents.length} neue Komponenten ohne Tests`,
        recommendation: `Erstelle Tests für die neuen Komponenten: ${newComponents.map(f => path.basename(f)).join(', ')}`,
        files: newComponents,
      });
    }

    // Check for new API endpoints without error handling
    const apiFiles = sourceFiles.filter(
      file =>
        file.includes('api') ||
        file.includes('route') ||
        file.includes('endpoint')
    );

    if (apiFiles.length > 0) {
      audits.push({
        category: 'error-monitoring',
        check: 'api-error-handling',
        status: 'missing',
        priority: 'high',
        message: 'Neue API-Endpunkte ohne Error-Monitoring',
        recommendation:
          'Integriere Sentry oder ähnliche Tools für API-Error-Tracking',
        packages: ['@sentry/node', '@sentry/react'],
        files: apiFiles,
      });
    }

    return audits;
  }

  // New database-driven helper methods
  private getRecommendedErrorMonitoringTool(
    tools: Record<string, Tool>,
    frameworks: string[]
  ): Tool {
    // Prioritize based on framework compatibility and popularity
    const toolsArray = Object.values(tools) as Tool[];

    // First, try to find a tool that specifically supports the frameworks
    for (const framework of frameworks) {
      const frameworkTool = toolsArray.find(
        (tool: Tool) =>
          typeof tool.frameworks === 'object' &&
          !Array.isArray(tool.frameworks) &&
          tool.frameworks[framework]
      );
      if (
        frameworkTool &&
        frameworkTool.isRecommended &&
        !frameworkTool.isDeprecated
      ) {
        return frameworkTool;
      }
    }

    // Fallback to most popular recommended tool (prioritize by downloads and stars)
    return (
      toolsArray
        .filter((tool: Tool) => tool.isRecommended && !tool.isDeprecated)
        .sort((a: Tool, b: Tool) => {
          // Primary sort: popularity score
          const popularityDiff = (b.popularity || 0) - (a.popularity || 0);
          if (popularityDiff !== 0) return popularityDiff;

          // Secondary sort: weekly downloads
          const downloadsDiff =
            (b.downloads?.weekly || 0) - (a.downloads?.weekly || 0);
          if (downloadsDiff !== 0) return downloadsDiff;

          // Tertiary sort: GitHub stars
          return (b.stars || 0) - (a.stars || 0);
        })[0] || toolsArray[0]
    );
  }

  private getInstallCommand(tool: Tool, frameworks: string[]): string {
    if (typeof tool.installCommand === 'string') {
      return tool.installCommand;
    }

    // Find specific install command for framework
    for (const framework of frameworks) {
      if (
        typeof tool.installCommand === 'object' &&
        tool.installCommand[framework]
      ) {
        return tool.installCommand[framework];
      }
    }

    // Fallback to common commands
    if (typeof tool.installCommand === 'object') {
      const commands = tool.installCommand as { [key: string]: string };
      if (commands.javascript || commands.react) {
        return commands.javascript || commands.react;
      }
    }

    return `Install ${tool.name}`;
  }

  private getRecommendedPackages(tool: Tool, frameworks: string[]): string[] {
    const packages: string[] = [];

    if (
      typeof tool.frameworks === 'object' &&
      !Array.isArray(tool.frameworks)
    ) {
      // Get framework-specific packages
      frameworks.forEach(framework => {
        const frameworkPackage = (tool.frameworks as { [key: string]: string })[
          framework
        ];
        if (frameworkPackage) {
          packages.push(frameworkPackage);
        }
      });
    }

    // If no framework-specific packages, use keywords
    if (packages.length === 0) {
      packages.push(...tool.keywords.slice(0, 3));
    }

    return packages;
  }

  private getAllErrorMonitoringPackages(
    tools: Record<string, Tool>,
    frameworks: string[]
  ): string[] {
    const packages: string[] = [];

    (Object.values(tools) as Tool[]).forEach((tool: Tool) => {
      if (
        typeof tool.frameworks === 'object' &&
        !Array.isArray(tool.frameworks)
      ) {
        frameworks.forEach(framework => {
          const frameworkPackage = (
            tool.frameworks as { [key: string]: string }
          )[framework];
          if (frameworkPackage) {
            packages.push(frameworkPackage);
          }
        });
      }

      // Add main keywords
      packages.push(...tool.keywords.slice(0, 2));
    });

    return [...new Set(packages)]; // Remove duplicates
  }

  // Method to add deprecation warnings to audit results
  private addDeprecationWarning(
    audits: ProductionAudit[],
    tool: Tool,
    _toolKey: string
  ): void {
    audits.push({
      category: 'error-monitoring',
      check: 'deprecated-tool',
      status: 'missing',
      priority: 'high',
      message: `⚠️ WARNUNG: Das von dir genutzte Tool ${tool.name} ist veraltet`,
      recommendation: tool.successor
        ? `Der empfohlene Nachfolger ist ${tool.successor}. Migriere zu: npm install ${tool.successor}`
        : `Erwäge Migration zu einer modernen Alternative`,
      packages: tool.successor ? [tool.successor] : [],
    });
  }

  // Fallback method for when database is unavailable
  private async auditErrorMonitoringFallback(
    config: AuditConfig
  ): Promise<ProductionAudit[]> {
    const audits: ProductionAudit[] = [];

    if (config.language === 'javascript' || config.language === 'typescript') {
      const packageJson = await this.readPackageJson();
      if (!packageJson) return audits;

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Check for Sentry (fallback)
      const sentryPackages = [
        '@sentry/node',
        '@sentry/react',
        '@sentry/browser',
        '@sentry/nextjs',
      ];
      const hasSentry = sentryPackages.some(pkg => allDeps[pkg]);

      if (!hasSentry) {
        audits.push({
          category: 'error-monitoring',
          check: 'sentry-fallback',
          status: 'missing',
          priority: config.projectType === 'library' ? 'low' : 'high',
          message: '💡 PRO-TIPP: Kein Error-Monitoring gefunden (Fallback)',
          recommendation:
            'Installiere Sentry für Production-Error-Tracking. Für React: npm install @sentry/react, für Node.js: npm install @sentry/node',
          packages: ['@sentry/react', '@sentry/node'],
        });
      }
    }

    return audits;
  }
}
