import * as path from 'path';
import * as fs from 'fs-extra';
import { QualityCheckResult, SnykResult } from '../quality/QualityRunner';
import { ProductionAudit } from '../auditor/ProductionReadinessAuditor';
import { GitDiffResult } from '../utils/GitDiffAnalyzer';
import { SecurityScanResult, SecurityFinding } from '../types/security';
import { SOLIDCheckResult, SOLIDViolation } from '../solid/types/solid-types';
import { CodeSmellFinding } from '../types/code-smell';
import { MultiLLMReviewResult, AIReviewFinding } from '../types/ai-review';
import { FilenameHelper } from '../utils/filenameHelper';
import { t, initializeI18n } from '../config/i18n';

/**
 * Security constants for input validation
 */
const SECURITY_LIMITS = {
  MAX_FILE_PATH_LENGTH: 500,
  MAX_BRANCH_NAME_LENGTH: 200,
  MAX_COMMIT_MESSAGE_LENGTH: 1000,
  MAX_ERROR_MESSAGE_LENGTH: 500,
  MAX_FINDINGS_PER_REPORT: 10000,
} as const;

/**
 * Sanitizes branch names to prevent injection attacks
 * @param branchName - The branch name to sanitize
 * @returns Sanitized branch name safe for display
 */
function sanitizeBranchName(branchName: unknown): string {
  if (typeof branchName !== 'string') {
    return 'unknown-branch';
  }

  return (
    branchName
      .replace(/[^a-zA-Z0-9/_.-]/g, '')
      .substring(0, SECURITY_LIMITS.MAX_BRANCH_NAME_LENGTH) || 'unknown-branch'
  );
}

/**
 * Sanitizes file paths to prevent information leakage
 * @param filePath - The file path to sanitize
 * @returns Sanitized file path safe for display
 */
function sanitizeFilePath(filePath: unknown): string {
  if (typeof filePath !== 'string') {
    return 'unknown-file';
  }

  const baseName = path.basename(filePath);
  return (
    baseName.replace(/[^a-zA-Z0-9._-]/g, '').substring(0, 100) || 'unknown-file'
  );
}

/**
 * Sanitizes commit messages to prevent XSS
 * @param message - The commit message to sanitize
 * @returns Sanitized commit message safe for display
 */
function sanitizeCommitMessage(message: unknown): string {
  if (typeof message !== 'string') {
    return t('report_generator.invalid_commit_message');
  }

  return message
    .replace(/[<>"'&]/g, '')
    .substring(0, SECURITY_LIMITS.MAX_COMMIT_MESSAGE_LENGTH);
}

/**
 * Sanitizes numeric values to prevent injection
 * @param value - The numeric value to sanitize
 * @returns Safe numeric value or 0
 */
function sanitizeNumeric(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    return Math.max(0, Math.min(value, 999999));
  }
  return 0;
}

/**
 * Data structure for review report generation
 */
export interface ReviewReportData {
  context?: { type: string; description: string };
  gitDiff: GitDiffResult;
  qualityResults: QualityCheckResult[];
  securityResults?: SecurityScanResult[];
  snykResults?: SnykResult[]; // Legacy support
  productionAudits: ProductionAudit[];
  aiReviewResults?: MultiLLMReviewResult; // AI review results from runAIReviewOnFiles
  currentBranch: string;
  commits: string[];
}

// Explain-for-humans: This class takes all the code analysis results from WOARU and converts them into readable reports in both Markdown and JSON formats, with standardized file naming.
export class ReviewReportGenerator {
  private reportMetrics = {
    reportsGenerated: 0,
    totalFindings: 0,
    securityIssuesFound: 0,
    averageGenerationTime: 0,
  };
  /**
   * Generate markdown report with standardized filename
   * @param data - Review report data containing all analysis results
   * @param outputPath - Optional output path, will use standardized naming if not provided
   * @returns The path where the report was saved
   */
  /**
   * Generate markdown report with comprehensive security validation
   * @param data - Review report data containing all analysis results
   * @param outputPath - Optional output path, will use standardized naming if not provided
   * @returns The path where the report was saved
   */
  async generateMarkdownReport(
    data: ReviewReportData,
    outputPath?: string
  ): Promise<string> {
    const startTime = Date.now();

    try {
      await initializeI18n();

      // Validate input data
      if (!this.validateReportData(data)) {
        throw new Error(t('report_generator.error_invalid_data'));
      }

      const markdown = await this.buildMarkdownReport(data);

      if (!outputPath) {
        const commandType = sanitizeFilePath(data.context?.type || 'review');
        const filename = FilenameHelper.generateReportFilename(commandType);
        outputPath = path.join(process.cwd(), '.woaru', 'reports', filename);
      }

      // Security check for output path
      if (!this.isSecureOutputPath(outputPath)) {
        throw new Error(t('report_generator.error_unsafe_path'));
      }

      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, markdown, 'utf8');

      // Update metrics
      this.updateMetrics(data, Date.now() - startTime);

      return outputPath;
    } catch (error) {
      console.error(
        t('report_generator.error_generating_markdown'),
        this.sanitizeError(error)
      );
      throw error;
    }
  }

  /**
   * Generate JSON report for programmatic consumption
   * @param data - Review report data containing all analysis results
   * @returns JSON string representation of the report
   */
  /**
   * Generate JSON report for programmatic consumption with security validation
   * @param data - Review report data containing all analysis results
   * @returns JSON string representation of the report
   */
  generateJsonReport(data: ReviewReportData): string {
    try {
      if (!this.validateReportData(data)) {
        throw new Error(t('report_generator.invalid_report_data'));
      }
      const securitySummary = this.getSecuritySummaryFromResults(
        data.securityResults || []
      );

      const result: Record<string, unknown> = {
        summary: {
          reviewType: data.context?.type || 'git',
          description: data.context?.description || '',
          baseBranch: data.gitDiff.baseBranch,
          currentBranch: data.currentBranch,
          totalChangedFiles: data.gitDiff.totalChanges,
          totalQualityIssues: data.qualityResults.length,
          totalSecurityIssues: securitySummary.total,
          criticalVulnerabilities: securitySummary.critical,
          highVulnerabilities: securitySummary.high,
          totalProductionIssues: data.productionAudits.length,
          commits: data.commits.length,
        },
        changedFiles: data.gitDiff.changedFiles.map(file =>
          path.basename(file)
        ),
        qualityIssues: data.qualityResults,
        securityFindings: this.flattenSecurityResults(
          data.securityResults || []
        ),
        productionAudits: data.productionAudits,
        commits: data.commits,
      };

      // Add AI review data if available
      if (data.aiReviewResults) {
        interface ResultSummaryExtended {
          reviewType: string;
          description: string;
          baseBranch: string;
          currentBranch: string;
          totalChangedFiles: number;
          totalQualityIssues: number;
          totalSecurityIssues: number;
          criticalVulnerabilities: number;
          highVulnerabilities: number;
          totalProductionIssues: number;
          commits: number;
          aiReviewEnabled?: boolean;
          aiFilesAnalyzed?: number;
          aiTotalFindings?: number;
          aiEstimatedCost?: number;
        }
        const resultSummary = result.summary as ResultSummaryExtended;
        resultSummary.aiReviewEnabled = true;
        const aiResults = data.aiReviewResults as MultiLLMReviewResult;
        const aiSummary =
          'summary' in aiResults
            ? (aiResults.summary as {
                filesAnalyzed?: number;
                totalFindings?: number;
                estimatedCost?: number;
              })
            : undefined;
        resultSummary.aiFilesAnalyzed = aiSummary?.filesAnalyzed || 0;
        resultSummary.aiTotalFindings = aiSummary?.totalFindings || 0;
        resultSummary.aiEstimatedCost = aiSummary?.estimatedCost || 0;
        result.aiReview = data.aiReviewResults;
      } else {
        interface ResultSummaryBase {
          aiReviewEnabled?: boolean;
        }
        (result.summary as ResultSummaryBase).aiReviewEnabled = false;
      }

      return JSON.stringify(result, null, 2);
    } catch (error) {
      console.error('Error generating JSON report:', this.sanitizeError(error));
      return JSON.stringify(
        { error: t('report_generator.failed_to_generate') },
        null,
        2
      );
    }
  }

  /**
   * Validate report data for security and completeness
   */
  private validateReportData(data: ReviewReportData): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Validate required fields
    if (
      !data.gitDiff ||
      !Array.isArray(data.qualityResults) ||
      !Array.isArray(data.productionAudits)
    ) {
      return false;
    }

    // Validate array sizes to prevent DoS
    if (
      data.qualityResults.length > SECURITY_LIMITS.MAX_FINDINGS_PER_REPORT ||
      data.productionAudits.length > SECURITY_LIMITS.MAX_FINDINGS_PER_REPORT
    ) {
      return false;
    }

    return true;
  }

  /**
   * Check if output path is secure
   */
  private isSecureOutputPath(outputPath: string): boolean {
    try {
      const normalized = path.normalize(outputPath);

      // Check for directory traversal
      if (normalized.includes('..') || normalized.includes('\x00')) {
        return false;
      }

      // Check path length
      if (normalized.length > SECURITY_LIMITS.MAX_FILE_PATH_LENGTH) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize error messages for security
   */
  private sanitizeError(error: unknown): string {
    if (typeof error === 'string') {
      return error
        .replace(/\/[^\s]*\/[^\s]*/g, '[PATH]')
        .substring(0, SECURITY_LIMITS.MAX_ERROR_MESSAGE_LENGTH);
    }

    if (error instanceof Error) {
      return this.sanitizeError(error.message);
    }

    return 'Unknown report generation error';
  }

  /**
   * Update report generation metrics
   */
  private updateMetrics(data: ReviewReportData, duration: number): void {
    this.reportMetrics.reportsGenerated++;
    this.reportMetrics.totalFindings +=
      data.qualityResults.length + data.productionAudits.length;

    if (data.securityResults) {
      this.reportMetrics.securityIssuesFound += data.securityResults.reduce(
        (sum, result) => sum + (result.findings?.length || 0),
        0
      );
    }

    this.reportMetrics.averageGenerationTime =
      (this.reportMetrics.averageGenerationTime + duration) / 2;
  }

  /**
   * Sanitize audit messages for security
   */
  private sanitizeAuditMessage(message: unknown): string {
    if (typeof message !== 'string') {
      return t('report_generator.invalid_audit_message');
    }

    return message
      .replace(/[<>"'&]/g, '')
      .substring(0, SECURITY_LIMITS.MAX_ERROR_MESSAGE_LENGTH);
  }

  /**
   * Get report generation metrics
   */
  public getReportMetrics() {
    return { ...this.reportMetrics };
  }

  /**
   * Reset report generation metrics
   */
  public resetMetrics(): void {
    this.reportMetrics = {
      reportsGenerated: 0,
      totalFindings: 0,
      securityIssuesFound: 0,
      averageGenerationTime: 0,
    };
  }

  /**
   * Build markdown report with comprehensive security validation
   */
  private async buildMarkdownReport(data: ReviewReportData): Promise<string> {
    await initializeI18n();
    const lines: string[] = [];
    const securitySummary = this.getSecuritySummaryFromResults(
      data.securityResults || []
    );

    // Header
    lines.push('# WOARU Code Review');
    lines.push(
      t('report_generator.summary.changes_since_branch', {
        branch: sanitizeBranchName(data.gitDiff.baseBranch),
      })
    );
    lines.push(
      t('report_generator.summary.current_branch', {
        branch: sanitizeBranchName(data.currentBranch),
      })
    );
    lines.push(
      t('report_generator.summary.generated_at', {
        date: new Date().toLocaleString('de-DE'),
      })
    );
    lines.push('');

    // Security Issues FIRST (if any critical/high issues exist)
    if (securitySummary.critical > 0 || securitySummary.high > 0) {
      lines.push(t('report_generator.headers.critical_security_issues'));
      lines.push('');
      lines.push(
        t('report_generator.summary.security_warnings', {
          critical: sanitizeNumeric(securitySummary.critical),
          high: sanitizeNumeric(securitySummary.high),
        })
      );
      lines.push('');
      this.addCriticalSecuritySection(lines, data.securityResults || []);
      lines.push('');
    }

    // Summary
    lines.push(t('report_generator.headers.summary'));
    lines.push('');
    lines.push(
      t('report_generator.summary.changed_files', {
        count: sanitizeNumeric(data.gitDiff.totalChanges),
      })
    );
    lines.push(
      t('report_generator.summary.quality_problems', {
        count: sanitizeNumeric(data.qualityResults.length),
      })
    );
    lines.push(
      t('report_generator.summary.security_problems', {
        total: sanitizeNumeric(securitySummary.total),
        critical: sanitizeNumeric(securitySummary.critical),
        high: sanitizeNumeric(securitySummary.high),
      })
    );
    lines.push(
      t('report_generator.summary.production_recommendations', {
        count: sanitizeNumeric(data.productionAudits.length),
      })
    );

    // Add AI Review summary if available
    interface AIResultsWithSummary {
      summary?: {
        filesAnalyzed: number;
        totalFindings: number;
        estimatedCost: number;
        timestamp: string;
      };
    }
    const aiResults = data.aiReviewResults as AIResultsWithSummary | undefined;
    if (aiResults && aiResults.summary) {
      const aiSummary = aiResults.summary;
      lines.push(
        t('report_generator.summary.ai_review', {
          filesAnalyzed: sanitizeNumeric(aiSummary.filesAnalyzed),
          totalFindings: sanitizeNumeric(aiSummary.totalFindings),
        })
      );
      if (sanitizeNumeric(aiSummary.estimatedCost) > 0) {
        lines.push(
          t('report_generator.summary.ai_cost', {
            cost: sanitizeNumeric(aiSummary.estimatedCost).toFixed(4),
          })
        );
      }
    }

    lines.push(
      t('report_generator.summary.commits', {
        count: sanitizeNumeric(data.commits.length),
      })
    );
    lines.push('');

    // Changed Files
    if (data.gitDiff.changedFiles && data.gitDiff.changedFiles.length > 0) {
      lines.push(`## ${t('report_generator.headers.changed_files')}`);
      lines.push('');
      data.gitDiff.changedFiles.slice(0, 100).forEach(file => {
        const sanitizedPath = sanitizeFilePath(file);
        lines.push(`- \`${sanitizedPath}\``);
      });

      if (data.gitDiff.changedFiles.length > 100) {
        lines.push(
          t('report_generator.summary.more_files', {
            count: data.gitDiff.changedFiles.length - 100,
          })
        );
      }
      lines.push('');
    }

    // Security Issues (all, not just critical/high)
    if (
      data.securityResults &&
      data.securityResults.length > 0 &&
      securitySummary.total > 0
    ) {
      lines.push(t('report_generator.headers.all_security_findings'));
      lines.push('');
      this.addAllSecuritySection(lines, data.securityResults);
    }

    // Quality Issues
    if (data.qualityResults.length > 0) {
      lines.push(`## ${t('report_generator.headers.critical_quality_issues')}`);
      lines.push('');

      // Group by file
      const issuesByFile = this.groupQualityIssuesByFile(data.qualityResults);

      Object.entries(issuesByFile).forEach(([file, results]) => {
        lines.push(`### \`${file}\``);
        lines.push('');

        results.forEach(result => {
          lines.push(
            `**${result.tool} - ${this.getSeverityEmoji(result.severity)} ${result.severity.toUpperCase()}:**`
          );
          lines.push('');

          // Add explanation if available
          if (result.explanation) {
            lines.push(
              t('report_generator.problem_label', {
                explanation: result.explanation,
              })
            );
            lines.push('');
          }

          // List all issues with better formatting
          lines.push(t('report_generator.found_problems'));
          result.issues.forEach((issue, index) => {
            lines.push(`${index + 1}. ${issue}`);
          });
          lines.push('');

          // Add fixes if available
          if (result.fixes && result.fixes.length > 0) {
            lines.push(t('report_generator.headers.solution_suggestions'));
            result.fixes.forEach((fix, index) => {
              lines.push(`${index + 1}. ${fix}`);
            });
            lines.push('');
          }

          // Add code examples or context if available in raw_output
          if (result.raw_output && this.shouldShowCodeContext(result)) {
            lines.push(t('report_generator.status.code_context'));
            lines.push('```');
            lines.push(this.extractRelevantCodeContext(result.raw_output));
            lines.push('```');
            lines.push('');
          }

          lines.push('---');
          lines.push('');
        });
      });
    }

    // SOLID Architecture Analysis
    this.addSOLIDAnalysisSection(lines, data.qualityResults);

    // Code Smell Analysis
    this.addCodeSmellAnalysisSection(lines, data.qualityResults);

    // AI Code Review Analysis
    if (data.aiReviewResults) {
      this.addAIReviewSection(lines, data.aiReviewResults);
    }

    // Production Audits
    if (data.productionAudits.length > 0) {
      lines.push(
        `## ${t('report_generator.headers.production_recommendations')}`
      );
      lines.push('');

      // Group by priority
      const auditsByPriority = this.groupAuditsByPriority(
        data.productionAudits
      );

      if (auditsByPriority.critical.length > 0) {
        lines.push(t('report_generator.priorities.critical'));
        lines.push('');
        auditsByPriority.critical.forEach(audit => {
          lines.push(`**${this.sanitizeAuditMessage(audit.message)}**`);
          lines.push(`→ ${this.sanitizeAuditMessage(audit.recommendation)}`);
          if (audit.packages && audit.packages.length > 0) {
            const sanitizedPackages = audit.packages
              .map(p => sanitizeFilePath(p))
              .join('`, `');
            lines.push(`📦 \`${sanitizedPackages}\``);
          }
          lines.push('');
        });
      }

      if (auditsByPriority.high.length > 0) {
        lines.push(t('report_generator.priorities.high'));
        lines.push('');
        auditsByPriority.high.forEach(audit => {
          lines.push(`**${this.sanitizeAuditMessage(audit.message)}**`);
          lines.push(`→ ${this.sanitizeAuditMessage(audit.recommendation)}`);
          if (audit.packages && audit.packages.length > 0) {
            const sanitizedPackages = audit.packages
              .map(p => sanitizeFilePath(p))
              .join('`, `');
            lines.push(`📦 \`${sanitizedPackages}\``);
          }
          lines.push('');
        });
      }

      if (auditsByPriority.medium.length > 0) {
        lines.push(t('report_generator.priorities.medium'));
        lines.push('');
        auditsByPriority.medium.forEach(audit => {
          lines.push(`**${this.sanitizeAuditMessage(audit.message)}**`);
          lines.push(`→ ${this.sanitizeAuditMessage(audit.recommendation)}`);
          lines.push('');
        });
      }

      if (auditsByPriority.low.length > 0) {
        lines.push(t('report_generator.priorities.low'));
        lines.push('');
        auditsByPriority.low.forEach(audit => {
          lines.push(`**${this.sanitizeAuditMessage(audit.message)}**`);
          lines.push(`→ ${this.sanitizeAuditMessage(audit.recommendation)}`);
          lines.push('');
        });
      }
    }

    // Commits
    if (data.commits && data.commits.length > 0) {
      lines.push(`## ${t('report_generator.headers.commits')}`);
      lines.push('');
      data.commits.slice(0, 50).forEach(commit => {
        const sanitizedCommit = sanitizeCommitMessage(commit);
        lines.push(`- ${sanitizedCommit}`);
      });

      if (data.commits.length > 50) {
        lines.push(
          t('report_generator.summary.more_commits', {
            count: data.commits.length - 50,
          })
        );
      }
      lines.push('');
    }

    // Footer
    lines.push('---');
    lines.push('');
    lines.push('**Generiert von WOARU Review** 🚀');
    lines.push(
      `**Basis: \`${data.gitDiff.baseBranch}\` → \`${data.currentBranch}\`**`
    );

    return lines.join('\n');
  }

  private groupQualityIssuesByFile(
    results: QualityCheckResult[]
  ): Record<string, QualityCheckResult[]> {
    const grouped: Record<string, QualityCheckResult[]> = {};

    results.forEach(result => {
      const file = path.basename(result.filePath);
      if (!grouped[file]) {
        grouped[file] = [];
      }
      grouped[file].push(result);
    });

    return grouped;
  }

  private groupAuditsByPriority(audits: ProductionAudit[]): {
    critical: ProductionAudit[];
    high: ProductionAudit[];
    medium: ProductionAudit[];
    low: ProductionAudit[];
  } {
    return {
      critical: audits.filter(a => a.priority === 'critical'),
      high: audits.filter(a => a.priority === 'high'),
      medium: audits.filter(a => a.priority === 'medium'),
      low: audits.filter(a => a.priority === 'low'),
    };
  }

  getReportSummary(data: ReviewReportData): string {
    const criticalIssues = data.qualityResults.filter(
      r => r.severity === 'error'
    ).length;
    const securitySummary = this.getSecuritySummaryFromResults(
      data.securityResults || []
    );
    const highPriorityAudits = data.productionAudits.filter(
      a => a.priority === 'high' || a.priority === 'critical'
    ).length;

    if (
      criticalIssues === 0 &&
      securitySummary.critical === 0 &&
      securitySummary.high === 0 &&
      highPriorityAudits === 0
    ) {
      return t('report_generator.no_critical_issues');
    }

    const issues = [];
    if (securitySummary.critical > 0 || securitySummary.high > 0) {
      issues.push(
        `${securitySummary.critical + securitySummary.high} Sicherheits-Probleme`
      );
    }
    if (criticalIssues > 0) {
      issues.push(`${criticalIssues} Qualitäts-Probleme`);
    }
    if (highPriorityAudits > 0) {
      issues.push(`${highPriorityAudits} Produktions-Empfehlungen`);
    }

    return `⚠️ Gefunden: ${issues.join(', ')}`;
  }

  /**
   * Add critical/high security findings section
   */
  private addCriticalSecuritySection(
    lines: string[],
    securityResults: SecurityScanResult[]
  ): void {
    securityResults.forEach(result => {
      if (result.error) {
        lines.push(`⚠️ **${result.tool} Error:** ${result.error}`);
        lines.push('');
        return;
      }

      const criticalFindings = result.findings.filter(
        f => f.severity === 'critical'
      );
      const highFindings = result.findings.filter(f => f.severity === 'high');

      if (criticalFindings.length > 0) {
        lines.push(`### 🔴 KRITISCHE ${result.tool.toUpperCase()}-Befunde`);
        lines.push('');
        criticalFindings.forEach(finding => {
          lines.push(`**${finding.title}**`);
          if (finding.package) {
            lines.push(`- **Paket:** ${finding.package}@${finding.version}`);
          }
          if (finding.file) {
            lines.push(
              `- **Datei:** ${finding.file}${finding.line ? `:${finding.line}` : ''}`
            );
          }
          lines.push(`- **Schweregrad:** KRITISCH`);
          if (finding.cve) {
            lines.push(`- **CVE:** ${finding.cve}`);
          }
          if (finding.fixedIn) {
            lines.push(
              `- **✅ Fix verfügbar:** Upgrade auf ${finding.fixedIn}`
            );
          }
          if (finding.recommendation) {
            lines.push(`- **Empfehlung:** ${finding.recommendation}`);
          }
          lines.push('');
        });
      }

      if (highFindings.length > 0) {
        lines.push(`### 🟡 HOHE ${result.tool.toUpperCase()}-Befunde`);
        lines.push('');
        highFindings.forEach(finding => {
          lines.push(`**${finding.title}**`);
          if (finding.package) {
            lines.push(`- **Paket:** ${finding.package}@${finding.version}`);
          }
          if (finding.file) {
            lines.push(
              `- **Datei:** ${finding.file}${finding.line ? `:${finding.line}` : ''}`
            );
          }
          lines.push(`- **Schweregrad:** HOCH`);
          if (finding.recommendation) {
            lines.push(`- **Empfehlung:** ${finding.recommendation}`);
          }
          lines.push('');
        });
      }
    });
  }

  /**
   * Add all security findings section
   */
  private addAllSecuritySection(
    lines: string[],
    securityResults: SecurityScanResult[]
  ): void {
    securityResults.forEach(result => {
      if (result.error) {
        lines.push(`⚠️ **${result.tool} Error:** ${result.error}`);
        lines.push('');
        return;
      }

      if (result.findings.length > 0) {
        lines.push(
          `### ${this.getToolEmoji(result.tool)} ${result.tool.toUpperCase()}-Befunde`
        );
        lines.push('');

        // Group by severity
        const bySeverity = {
          critical: result.findings.filter(f => f.severity === 'critical'),
          high: result.findings.filter(f => f.severity === 'high'),
          medium: result.findings.filter(f => f.severity === 'medium'),
          low: result.findings.filter(f => f.severity === 'low'),
          info: result.findings.filter(f => f.severity === 'info'),
        };

        Object.entries(bySeverity).forEach(([severity, findings]) => {
          if (findings.length > 0) {
            lines.push(
              `#### ${this.getSeverityEmoji(severity as 'critical' | 'high' | 'medium' | 'low' | 'info')} ${severity.toUpperCase()} (${findings.length})`
            );
            lines.push('');
            findings.forEach(finding => {
              if (finding.package) {
                lines.push(
                  `- **${finding.title}** in ${finding.package}@${finding.version}`
                );
              } else if (finding.file) {
                lines.push(
                  `- **${finding.title}** in ${finding.file}${finding.line ? `:${finding.line}` : ''}`
                );
              } else {
                lines.push(`- **${finding.title}**`);
              }
            });
            lines.push('');
          }
        });
      }
    });
  }

  private getToolEmoji(tool: string): string {
    switch (tool.toLowerCase()) {
      case 'snyk':
        return '📦';
      case 'gitleaks':
        return '🔍';
      case 'trufflehog':
        return '🕵️';
      case 'trivy':
        return '🛡️';
      default:
        return '🔒';
    }
  }

  private getSeverityEmoji(
    severity:
      | 'critical'
      | 'high'
      | 'medium'
      | 'low'
      | 'error'
      | 'warning'
      | 'info'
  ): string {
    switch (severity) {
      case 'critical':
      case 'error':
        return '🔴';
      case 'high':
      case 'warning':
        return '🟡';
      case 'medium':
        return '🔵';
      case 'low':
      case 'info':
        return '⚪';
      default:
        return '🔴';
    }
  }

  /**
   * Determine if code context should be shown for this result
   */
  private shouldShowCodeContext(result: QualityCheckResult): boolean {
    // Show context for syntax errors, formatting issues, or when raw_output contains useful snippets
    return (
      result.tool.toLowerCase().includes('eslint') ||
      result.tool.toLowerCase().includes('prettier') ||
      result.tool.toLowerCase().includes('ruff') ||
      (result.raw_output !== undefined && result.raw_output.length < 1000)
    ); // Don't show very long outputs
  }

  /**
   * Extract relevant code context from raw tool output
   */
  private extractRelevantCodeContext(rawOutput: string): string {
    const lines = rawOutput.split('\n');
    const relevantLines: string[] = [];

    // Look for actual code lines (usually indented or contain code patterns)
    let foundCode = false;
    for (const line of lines) {
      if (
        line.match(/^\s*(\d+:|>|\+|-)/) || // Line numbers or diff markers
        line.match(/^\s{2,}/) || // Indented lines (likely code)
        line.match(/[{}();,]/) // Contains code-like characters
      ) {
        relevantLines.push(line);
        foundCode = true;
      } else if (foundCode && line.trim() === '') {
        // Include empty lines in code blocks
        relevantLines.push(line);
      } else if (foundCode && !line.match(/^\s*[a-zA-Z]/)) {
        // Stop at non-code lines after finding code
        break;
      }
    }

    // If no code found, return first few non-empty lines
    if (relevantLines.length === 0) {
      return lines
        .filter(line => line.trim())
        .slice(0, 5)
        .join('\n');
    }

    return relevantLines.slice(0, 15).join('\n'); // Limit to 15 lines
  }

  /**
   * Extract summary from SecurityScanResult array
   */
  private getSecuritySummaryFromResults(
    securityResults: SecurityScanResult[]
  ): {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  } {
    const summary = {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    securityResults.forEach(result => {
      summary.total += result.summary.total;
      summary.critical += result.summary.critical;
      summary.high += result.summary.high;
      summary.medium += result.summary.medium;
      summary.low += result.summary.low;
      summary.info += result.summary.info;
    });

    return summary;
  }

  /**
   * Flatten SecurityScanResult array to SecurityFinding array for JSON output
   */
  private flattenSecurityResults(
    securityResults: SecurityScanResult[]
  ): SecurityFinding[] {
    const allFindings: SecurityFinding[] = [];

    securityResults.forEach(result => {
      allFindings.push(...result.findings);
    });

    return allFindings;
  }

  /**
   * Adds SOLID Architecture Analysis section to the report
   */
  private addSOLIDAnalysisSection(
    lines: string[],
    qualityResults: QualityCheckResult[]
  ): void {
    // Extract SOLID results from quality results
    const solidResults = qualityResults
      .map(result => result.solidResult)
      .filter(
        (solidResult): solidResult is SOLIDCheckResult =>
          solidResult !== undefined
      );

    if (solidResults.length === 0) {
      return; // No SOLID analysis available
    }

    // Calculate summary metrics
    const totalViolations = solidResults.reduce(
      (sum, result) => sum + result.violations.length,
      0
    );
    const avgSOLIDScore =
      solidResults.reduce((sum, result) => sum + result.metrics.solidScore, 0) /
      solidResults.length;

    // Only show section if there are violations or low scores
    if (totalViolations === 0 && avgSOLIDScore >= 80) {
      // Add short positive note
      lines.push('## 🏗️ SOLID Architecture Analysis');
      lines.push('');
      lines.push(
        `✅ **Excellent SOLID Score: ${Math.round(avgSOLIDScore)}/100** - Keine Architektur-Probleme gefunden!`
      );
      lines.push('');
      return;
    }

    lines.push('## 🏗️ SOLID Architecture Analysis');
    lines.push('');
    lines.push(
      `📊 **SOLID Score: ${Math.round(avgSOLIDScore)}/100** (${totalViolations} Verstöße gefunden)`
    );
    lines.push('');

    // Group violations by principle
    const violationsByPrinciple =
      this.groupSOLIDViolationsByPrinciple(solidResults);

    // Show violations by principle
    Object.entries(violationsByPrinciple).forEach(([principle, violations]) => {
      if (violations.length === 0) return;

      const principleNames: { [key: string]: string } = {
        SRP: 'Single Responsibility Principle',
        OCP: 'Open/Closed Principle',
        LSP: 'Liskov Substitution Principle',
        ISP: 'Interface Segregation Principle',
        DIP: 'Dependency Inversion Principle',
      };

      lines.push(
        `### 🔴 ${principleNames[principle]} (${violations.length} Verstöße)`
      );
      lines.push('');

      // Group by severity
      const critical = violations.filter(v => v.severity === 'critical');
      const high = violations.filter(v => v.severity === 'high');
      const medium = violations.filter(v => v.severity === 'medium');

      [
        { label: 'KRITISCH', violations: critical, emoji: '🔴' },
        { label: 'HOCH', violations: high, emoji: '🟡' },
        { label: 'MITTEL', violations: medium, emoji: '🔵' },
      ].forEach(({ label, violations: severityViolations, emoji }) => {
        if (severityViolations.length === 0) return;

        lines.push(`#### ${emoji} ${label} (${severityViolations.length})`);
        lines.push('');

        severityViolations.slice(0, 5).forEach((violation, index) => {
          lines.push(`**${index + 1}. ${violation.description}**`);

          // Location info
          if (violation.class) {
            const location = violation.line
              ? `${violation.class}:${violation.line}`
              : violation.class;
            lines.push(`📍 **Klasse:** ${location}`);
          }
          if (violation.method) {
            lines.push(`🔧 **Methode:** ${violation.method}`);
          }

          // Explanation
          lines.push(`💡 **Problem:** ${violation.explanation}`);

          // Impact
          lines.push(`⚠️ **Auswirkung:** ${violation.impact}`);

          // Suggestion
          lines.push(`🔨 **Lösung:** ${violation.suggestion}`);

          // Metrics if available
          if (violation.metrics) {
            const metrics = [];
            if (violation.metrics.complexity)
              metrics.push(`Komplexität: ${violation.metrics.complexity}`);
            if (violation.metrics.methodCount)
              metrics.push(`Methoden: ${violation.metrics.methodCount}`);
            if (violation.metrics.parameters)
              metrics.push(`Parameter: ${violation.metrics.parameters}`);
            if (violation.metrics.linesOfCode)
              metrics.push(`Zeilen: ${violation.metrics.linesOfCode}`);

            if (metrics.length > 0) {
              lines.push(`📊 **Metriken:** ${metrics.join(', ')}`);
            }
          }

          lines.push('');
        });

        if (severityViolations.length > 5) {
          lines.push(
            `*... und ${severityViolations.length - 5} weitere ${label}-Verstöße*`
          );
          lines.push('');
        }
      });
    });

    // Add general SOLID recommendations
    lines.push(t('report_generator.solid_recommendations'));
    lines.push('');

    const recommendations = this.generateSOLIDRecommendations(solidResults);
    recommendations.forEach((rec, index) => {
      lines.push(`${index + 1}. ${rec}`);
    });
    lines.push('');
  }

  /**
   * Groups SOLID violations by principle
   */
  private groupSOLIDViolationsByPrinciple(solidResults: SOLIDCheckResult[]): {
    [principle: string]: SOLIDViolation[];
  } {
    const grouped: { [principle: string]: SOLIDViolation[] } = {
      SRP: [],
      OCP: [],
      LSP: [],
      ISP: [],
      DIP: [],
    };

    solidResults.forEach(result => {
      result.violations.forEach(violation => {
        grouped[violation.principle].push(violation);
      });
    });

    return grouped;
  }

  /**
   * Generates specific SOLID recommendations based on violations
   */
  private generateSOLIDRecommendations(
    solidResults: SOLIDCheckResult[]
  ): string[] {
    const recommendations: string[] = [];
    const allViolations = solidResults.flatMap(result => result.violations);

    // SRP recommendations
    const srpViolations = allViolations.filter(v => v.principle === 'SRP');
    if (srpViolations.length > 0) {
      const classesWithManyMethods = srpViolations.filter(
        v => v.metrics?.methodCount && v.metrics.methodCount > 15
      ).length;

      if (classesWithManyMethods > 0) {
        recommendations.push(
          `🎯 ${classesWithManyMethods} Klassen mit zu vielen Methoden gefunden - teile diese in kleinere, fokussierte Services auf`
        );
      }

      const complexClasses = srpViolations.filter(
        v => v.metrics?.complexity && v.metrics.complexity > 30
      ).length;

      if (complexClasses > 0) {
        recommendations.push(
          `🔄 ${complexClasses} Klassen mit hoher Komplexität - extrahiere komplexe Logik in separate Utility-Klassen`
        );
      }

      const concernViolations = srpViolations.filter(
        v => v.metrics?.importConcerns && v.metrics.importConcerns.length > 3
      ).length;

      if (concernViolations > 0) {
        recommendations.push(
          `📦 ${concernViolations} Klassen mit zu vielen verschiedenen Concerns - verwende Dependency Injection und Service-Pattern`
        );
      }
    }

    // General recommendations
    const avgScore =
      solidResults.reduce((sum, r) => sum + r.metrics.solidScore, 0) /
      solidResults.length;
    if (avgScore < 70) {
      recommendations.push(
        '🏗️ Führe systematisches Refactoring durch - beginne mit den kritischsten SOLID-Verstößen'
      );
    }

    const filesWithManyViolations = solidResults.filter(
      r => r.violations.length > 5
    ).length;
    if (filesWithManyViolations > 0) {
      recommendations.push(
        `⚠️ ${filesWithManyViolations} Dateien mit vielen SOLID-Verstößen - priorisiere diese für Architektur-Überarbeitung`
      );
    }

    // Add fallback recommendation
    if (recommendations.length === 0 && allViolations.length > 0) {
      recommendations.push(
        '📚 Überprüfe die SOLID-Prinzipien Dokumentation für weitere Verbesserungsideen'
      );
    }

    return recommendations;
  }

  /**
   * Add code smell analysis section to the report
   */
  private addCodeSmellAnalysisSection(
    lines: string[],
    qualityResults: QualityCheckResult[]
  ): void {
    // Collect all code smell findings from all quality results
    const allCodeSmellFindings: Array<{
      filePath: string;
      findings: CodeSmellFinding[];
    }> = [];

    qualityResults.forEach(result => {
      if (result.codeSmellFindings && result.codeSmellFindings.length > 0) {
        allCodeSmellFindings.push({
          filePath: result.filePath,
          findings: result.codeSmellFindings,
        });
      }
    });

    if (allCodeSmellFindings.length === 0) {
      return; // No code smells found
    }

    lines.push('## 🧼 Code Smell Analysis (WOARU Internal)');
    lines.push('');

    // Calculate overall statistics
    const totalFindings = allCodeSmellFindings.reduce(
      (sum, file) => sum + file.findings.length,
      0
    );

    const findingsByType = allCodeSmellFindings
      .flatMap(file => file.findings)
      .reduce(
        (acc, finding) => {
          acc[finding.type] = (acc[finding.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

    const criticalFindings = allCodeSmellFindings
      .flatMap(file => file.findings)
      .filter(f => f.severity === 'error').length;

    const warningFindings = allCodeSmellFindings
      .flatMap(file => file.findings)
      .filter(f => f.severity === 'warning').length;

    // Summary
    lines.push(
      `📊 **Gefunden: ${totalFindings} Code Smells** (${criticalFindings} kritisch, ${warningFindings} Warnungen)`
    );
    lines.push('');

    // Summary by type
    lines.push('### 📋 Verteilung nach Typ:');
    Object.entries(findingsByType)
      .sort(([, a], [, b]) => b - a) // Sort by count descending
      .forEach(([type, count]) => {
        const icon = this.getCodeSmellIcon(type);
        lines.push(`- ${icon} **${type.replace('-', ' ')}**: ${count}`);
      });
    lines.push('');

    // Detailed findings by file
    allCodeSmellFindings.forEach(({ filePath, findings }) => {
      lines.push(`### 📄 \`${path.basename(filePath)}\``);
      lines.push('');

      // Group findings by severity
      const criticalFindings = findings.filter(f => f.severity === 'error');
      const warningFindings = findings.filter(f => f.severity === 'warning');
      const infoFindings = findings.filter(f => f.severity === 'info');

      if (criticalFindings.length > 0) {
        lines.push(t('report_generator.critical_problems'));
        this.addCodeSmellFindingsList(lines, criticalFindings);
      }

      if (warningFindings.length > 0) {
        lines.push(t('report_generator.warnings'));
        this.addCodeSmellFindingsList(lines, warningFindings);
      }

      if (infoFindings.length > 0) {
        lines.push(t('report_generator.information'));
        this.addCodeSmellFindingsList(lines, infoFindings);
      }

      lines.push('');
    });

    // Recommendations
    lines.push(t('report_generator.code_smell_recommendations'));
    const recommendations =
      this.generateCodeSmellRecommendations(findingsByType);
    recommendations.forEach(rec => {
      lines.push(`- ${rec}`);
    });
    lines.push('');

    lines.push('---');
    lines.push('');
  }

  /**
   * Add list of code smell findings
   */
  private addCodeSmellFindingsList(
    lines: string[],
    findings: CodeSmellFinding[]
  ): void {
    findings.forEach(finding => {
      lines.push(
        t('report_generator.code_smell_line', {
          line: finding.line,
          column: finding.column,
          message: finding.message,
        })
      );
      if (finding.suggestion) {
        lines.push(`  💡 *${finding.suggestion}*`);
      }
    });
    lines.push('');
  }

  /**
   * Get icon for code smell type
   */
  private getCodeSmellIcon(type: string): string {
    const icons: Record<string, string> = {
      complexity: '🔄',
      'var-keyword': '📦',
      'weak-equality': '⚖️',
      'console-log': '🖨️',
      'function-length': '📏',
      'parameter-count': '📝',
      'nested-depth': '🏗️',
      'magic-number': '🔢',
      'duplicate-code': '📋',
      'dead-code': '💀',
    };
    return icons[type] || '⚠️';
  }

  /**
   * Generate code smell recommendations
   */
  private generateCodeSmellRecommendations(
    findingsByType: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];

    Object.entries(findingsByType).forEach(([type, count]) => {
      switch (type) {
        case 'var-keyword':
          recommendations.push(
            `🔄 Ersetze ${count} \`var\` Deklarationen durch \`let\` oder \`const\``
          );
          break;
        case 'weak-equality':
          recommendations.push(
            `⚖️ Verwende strikte Gleichheit (\`===\`, \`!==\`) statt schwacher Gleichheit (${count} Vorkommen)`
          );
          break;
        case 'console-log':
          recommendations.push(
            `🖨️ Entferne ${count} Debug-Statements (\`console.log\`) vor Production`
          );
          break;
        case 'complexity':
          recommendations.push(
            `🔄 Reduziere zyklomatische Komplexität in ${count} Funktionen durch Aufteilen`
          );
          break;
        case 'function-length':
          recommendations.push(
            `📏 Kürze ${count} zu lange Funktionen durch Extraktion von Logik`
          );
          break;
        case 'parameter-count':
          recommendations.push(
            `📝 Reduziere Parameter-Anzahl in ${count} Funktionen (verwende Options-Objekte)`
          );
          break;
        case 'nested-depth':
          recommendations.push(
            `🏗️ Reduziere Verschachtelungstiefe durch Guard-Clauses oder Funktions-Extraktion`
          );
          break;
        case 'magic-number':
          recommendations.push(
            `🔢 Extrahiere ${count} magische Zahlen in benannte Konstanten`
          );
          break;
      }
    });

    if (recommendations.length === 0) {
      recommendations.push(
        '✅ Keine spezifischen Code Smell Empfehlungen erforderlich'
      );
    }

    return recommendations;
  }

  /**
   * Add AI Review section to the report
   */
  private addAIReviewSection(
    lines: string[],
    aiReviewResults: MultiLLMReviewResult
  ): void {
    lines.push('## 🧠 AI Code Review Analysis');
    lines.push('');

    const codeContext = aiReviewResults.codeContext;
    const aggregation = aiReviewResults.aggregation;
    const meta = aiReviewResults.meta;
    const results = aiReviewResults.results;

    // Overview
    lines.push(
      `🤖 **Analysiert durch Multi-LLM System** - 1 Datei, ${aggregation.totalFindings} Befunde`
    );
    if (meta.totalEstimatedCost > 0) {
      lines.push(
        `💰 **Geschätzte Kosten:** $${meta.totalEstimatedCost.toFixed(4)}`
      );
    }
    lines.push(`⏰ **Analysedauer:** ${meta.totalDuration}ms`);
    lines.push('');

    if (Object.keys(results).length === 0) {
      lines.push('✅ Keine AI-basierten Befunde gefunden.');
      lines.push('');
      return;
    }

    // Process file results
    lines.push(`### 📄 \`${codeContext.filePath}\` (${codeContext.language})`);
    lines.push('');

    // File-level summary
    lines.push(
      `📊 **${aggregation.totalFindings} Befunde gefunden** | **Analysedauer:** ${meta.totalDuration}ms | **LLM Übereinstimmung:** ${(aggregation.llmAgreementScore * 100).toFixed(1)}%`
    );
    lines.push('');

    // Show findings by severity
    if (
      aggregation.findingsBySeverity &&
      Object.keys(aggregation.findingsBySeverity).length > 0
    ) {
      lines.push('#### 📈 Befunde nach Schweregrad:');
      Object.entries(aggregation.findingsBySeverity).forEach(
        ([severity, count]) => {
          const icon = this.getAISeverityIcon(severity);
          lines.push(`- ${icon} **${severity.toUpperCase()}**: ${count}`);
        }
      );
      lines.push('');
    }

    // Show findings by category
    if (
      aggregation.findingsByCategory &&
      Object.keys(aggregation.findingsByCategory).length > 0
    ) {
      lines.push('#### 🏷️ Befunde nach Kategorie:');
      Object.entries(aggregation.findingsByCategory).forEach(
        ([category, count]) => {
          const icon = this.getAICategoryIcon(category);
          lines.push(`- ${icon} **${category}**: ${count}`);
        }
      );
      lines.push('');
    }

    // Show consensus findings (issues found by multiple LLMs)
    if (
      aggregation.consensusFindings &&
      aggregation.consensusFindings.length > 0
    ) {
      lines.push('#### 🤝 Konsens-Befunde (mehrere LLMs sind sich einig):');
      this.addAIFindingsList(lines, aggregation.consensusFindings, true);
    }

    // Show unique findings per LLM
    if (
      aggregation.uniqueFindings &&
      Object.keys(aggregation.uniqueFindings).length > 0
    ) {
      lines.push('#### 🔍 Spezifische LLM-Befunde:');
      Object.entries(aggregation.uniqueFindings).forEach(
        ([llmId, findings]) => {
          if (findings.length > 0) {
            lines.push(
              `**${llmId}** (${findings.length} einzigartige Befunde):`
            );
            this.addAIFindingsList(lines, findings.slice(0, 3), false); // Show max 3 per LLM
            if (findings.length > 3) {
              lines.push(`  *... und ${findings.length - 3} weitere Befunde*`);
              lines.push('');
            }
          }
        }
      );
    }

    // Show LLM performance details
    if (
      meta.llmResponseTimes &&
      Object.keys(meta.llmResponseTimes).length > 1
    ) {
      lines.push('#### ⚡ LLM Performance:');
      Object.entries(meta.llmResponseTimes).forEach(([llmId, responseTime]) => {
        const cost = meta.estimatedCost[llmId] || 0;
        const tokens = meta.tokensUsed[llmId] || 0;
        const error = meta.llmErrors[llmId];

        if (error) {
          lines.push(`- ❌ **${llmId}**: Fehler - ${error}`);
        } else {
          lines.push(
            `- ✅ **${llmId}**: ${responseTime}ms, ${tokens} Tokens, $${cost.toFixed(4)}`
          );
        }
      });
      lines.push('');
    }

    lines.push('---');
    lines.push('');

    // Overall AI Review recommendations
    lines.push(t('report_generator.ai_review_recommendations'));
    const aiRecommendations =
      this.generateAIReviewRecommendations(aiReviewResults);
    aiRecommendations.forEach(rec => {
      lines.push(`- ${rec}`);
    });
    lines.push('');

    lines.push('---');
    lines.push('');
  }

  /**
   * Add list of AI findings
   */
  private addAIFindingsList(
    lines: string[],
    findings: AIReviewFinding[],
    showConfidence: boolean
  ): void {
    findings.forEach(finding => {
      const severityIcon = this.getAISeverityIcon(finding.severity);
      const categoryIcon = this.getAICategoryIcon(finding.category);

      lines.push(`- ${severityIcon} **${finding.message}**`);
      lines.push(
        t('report_generator.ai_finding_category', {
          categoryIcon,
          category: finding.category,
          lineNumber: finding.lineNumber || '',
        })
      );

      if (finding.rationale) {
        lines.push(
          t('report_generator.ai_rationale', { rationale: finding.rationale })
        );
      }

      if (finding.suggestion) {
        lines.push(
          t('report_generator.ai_suggestion', {
            suggestion: finding.suggestion,
          })
        );
      }

      if (showConfidence && finding.confidence) {
        lines.push(
          t('report_generator.ai_confidence', {
            confidence: (finding.confidence * 100).toFixed(0),
          })
        );
      }

      if (finding.estimatedFixTime) {
        lines.push(
          `  ⏱️ **Geschätzte Behebungszeit:** ${finding.estimatedFixTime}`
        );
      }

      lines.push('');
    });
  }

  /**
   * Get icon for AI severity
   */
  private getAISeverityIcon(severity: string): string {
    const icons: Record<string, string> = {
      critical: '🔴',
      high: '🟡',
      medium: '🔵',
      low: '⚪',
    };
    return icons[severity] || '⚠️';
  }

  /**
   * Get icon for AI category
   */
  private getAICategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      security: '🔒',
      performance: '⚡',
      maintainability: '🛠️',
      architecture: '🏗️',
      'code-smell': '🧼',
      'best-practice': '⭐',
    };
    return icons[category] || '📋';
  }

  /**
   * Generate AI review recommendations
   */
  private generateAIReviewRecommendations(
    aiReviewResults: MultiLLMReviewResult
  ): string[] {
    const recommendations: string[] = [];

    // Aggregate all findings across LLMs
    const allFindings = Object.values(aiReviewResults.results).flat();

    const criticalFindings = allFindings.filter(
      (f: AIReviewFinding) => f.severity === 'critical'
    );
    const securityFindings = allFindings.filter(
      (f: AIReviewFinding) => f.category === 'security'
    );
    const performanceFindings = allFindings.filter(
      (f: AIReviewFinding) => f.category === 'performance'
    );
    const maintainabilityFindings = allFindings.filter(
      (f: AIReviewFinding) => f.category === 'maintainability'
    );

    if (criticalFindings.length > 0) {
      recommendations.push(
        `🔴 Priorisiere die Behebung von ${criticalFindings.length} kritischen Problemen`
      );
    }

    if (securityFindings.length > 0) {
      recommendations.push(
        `🔒 Überprüfe ${securityFindings.length} potenzielle Sicherheitsprobleme`
      );
    }

    if (performanceFindings.length > 0) {
      recommendations.push(
        `⚡ Optimiere ${performanceFindings.length} Performance-relevante Stellen`
      );
    }

    if (maintainabilityFindings.length > 0) {
      recommendations.push(
        `🛠️ Verbessere die Wartbarkeit in ${maintainabilityFindings.length} Bereichen`
      );
    }

    // Check LLM agreement
    if (aiReviewResults.aggregation.llmAgreementScore < 0.5) {
      recommendations.push(
        '🤔 Niedrige LLM-Übereinstimmung - manuelle Überprüfung empfohlen'
      );
    }

    // Cost considerations
    if (aiReviewResults.meta.totalEstimatedCost > 0.1) {
      recommendations.push(
        '💰 Hohe AI-Kosten - erwäge Batch-Processing für große Codebasen'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Code erfüllt AI-basierte Qualitätsstandards');
    }

    return recommendations;
  }
}
