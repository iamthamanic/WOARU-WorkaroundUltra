import * as path from 'path';
import * as fs from 'fs-extra';
import { QualityCheckResult, SnykResult } from '../quality/QualityRunner';
import { ProductionAudit } from '../auditor/ProductionReadinessAuditor';
import { GitDiffResult } from '../utils/GitDiffAnalyzer';
import { SecurityScanResult, SecurityFinding } from '../types/security';

export interface ReviewReportData {
  context?: { type: string; description: string };
  gitDiff: GitDiffResult;
  qualityResults: QualityCheckResult[];
  securityResults?: SecurityScanResult[];
  snykResults?: SnykResult[]; // Legacy support
  productionAudits: ProductionAudit[];
  currentBranch: string;
  commits: string[];
}

export class ReviewReportGenerator {
  async generateMarkdownReport(
    data: ReviewReportData,
    outputPath: string
  ): Promise<void> {
    const markdown = this.buildMarkdownReport(data);
    await fs.writeFile(outputPath, markdown, 'utf8');
  }

  generateJsonReport(data: ReviewReportData): string {
    const securitySummary = this.getSecuritySummaryFromResults(
      data.securityResults || []
    );

    return JSON.stringify(
      {
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
      },
      null,
      2
    );
  }

  private buildMarkdownReport(data: ReviewReportData): string {
    const lines: string[] = [];
    const securitySummary = this.getSecuritySummaryFromResults(
      data.securityResults || []
    );

    // Header
    lines.push('# WOARU Code Review');
    lines.push(`**Änderungen seit Branch: \`${data.gitDiff.baseBranch}\`**`);
    lines.push(`**Aktueller Branch: \`${data.currentBranch}\`**`);
    lines.push(`**Generiert am: ${new Date().toLocaleString('de-DE')}**`);
    lines.push('');

    // Security Issues FIRST (if any critical/high issues exist)
    if (securitySummary.critical > 0 || securitySummary.high > 0) {
      lines.push(
        '## 🚨 KRITISCHE SICHERHEITS-PROBLEME (gefunden von Snyk/Gitleaks)'
      );
      lines.push('');
      lines.push(
        `**⚠️ WARNUNG: ${securitySummary.critical} kritische und ${securitySummary.high} hohe Sicherheitslücken gefunden!**`
      );
      lines.push('');
      this.addCriticalSecuritySection(lines, data.securityResults || []);
      lines.push('');
    }

    // Summary
    lines.push('## 📊 Zusammenfassung');
    lines.push('');
    lines.push(`- **Geänderte Dateien:** ${data.gitDiff.totalChanges}`);
    lines.push(`- **Qualitäts-Probleme:** ${data.qualityResults.length}`);
    lines.push(
      `- **Sicherheits-Probleme:** ${securitySummary.total} (${securitySummary.critical} kritisch, ${securitySummary.high} hoch)`
    );
    lines.push(
      `- **Produktions-Empfehlungen:** ${data.productionAudits.length}`
    );
    lines.push(`- **Commits:** ${data.commits.length}`);
    lines.push('');

    // Changed Files
    if (data.gitDiff.changedFiles.length > 0) {
      lines.push('## 📋 Geänderte Dateien');
      lines.push('');
      data.gitDiff.changedFiles.forEach(file => {
        const relativePath = path.basename(file);
        lines.push(`- \`${relativePath}\``);
      });
      lines.push('');
    }

    // Security Issues (all, not just critical/high)
    if (
      data.securityResults &&
      data.securityResults.length > 0 &&
      securitySummary.total > 0
    ) {
      lines.push('## 🔒 Alle Sicherheits-Befunde');
      lines.push('');
      this.addAllSecuritySection(lines, data.securityResults);
    }

    // Quality Issues
    if (data.qualityResults.length > 0) {
      lines.push('## 🚨 Kritische Qualitäts-Probleme');
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
            lines.push(`💡 **Problem:** ${result.explanation}`);
            lines.push('');
          }

          // List all issues with better formatting
          lines.push('📋 **Gefundene Probleme:**');
          result.issues.forEach((issue, index) => {
            lines.push(`${index + 1}. ${issue}`);
          });
          lines.push('');

          // Add fixes if available
          if (result.fixes && result.fixes.length > 0) {
            lines.push('🔧 **Lösungsvorschläge:**');
            result.fixes.forEach((fix, index) => {
              lines.push(`${index + 1}. ${fix}`);
            });
            lines.push('');
          }

          // Add code examples or context if available in raw_output
          if (result.raw_output && this.shouldShowCodeContext(result)) {
            lines.push('📄 **Code-Kontext:**');
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

    // Production Audits
    if (data.productionAudits.length > 0) {
      lines.push('## 🏗️ Empfehlungen zur Produktionsreife');
      lines.push('');

      // Group by priority
      const auditsByPriority = this.groupAuditsByPriority(
        data.productionAudits
      );

      if (auditsByPriority.critical.length > 0) {
        lines.push('### 🔴 CRITICAL - Muss behoben werden');
        lines.push('');
        auditsByPriority.critical.forEach(audit => {
          lines.push(`**${audit.message}**`);
          lines.push(`→ ${audit.recommendation}`);
          if (audit.packages && audit.packages.length > 0) {
            lines.push(`📦 \`${audit.packages.join('`, `')}\``);
          }
          lines.push('');
        });
      }

      if (auditsByPriority.high.length > 0) {
        lines.push('### 🟡 HIGH PRIORITY - Sollte behoben werden');
        lines.push('');
        auditsByPriority.high.forEach(audit => {
          lines.push(`**${audit.message}**`);
          lines.push(`→ ${audit.recommendation}`);
          if (audit.packages && audit.packages.length > 0) {
            lines.push(`📦 \`${audit.packages.join('`, `')}\``);
          }
          lines.push('');
        });
      }

      if (auditsByPriority.medium.length > 0) {
        lines.push('### 🔵 MEDIUM - Verbesserung empfohlen');
        lines.push('');
        auditsByPriority.medium.forEach(audit => {
          lines.push(`**${audit.message}**`);
          lines.push(`→ ${audit.recommendation}`);
          lines.push('');
        });
      }

      if (auditsByPriority.low.length > 0) {
        lines.push('### ⚪ LOW - Optional');
        lines.push('');
        auditsByPriority.low.forEach(audit => {
          lines.push(`**${audit.message}**`);
          lines.push(`→ ${audit.recommendation}`);
          lines.push('');
        });
      }
    }

    // Commits
    if (data.commits.length > 0) {
      lines.push('## 📝 Commits in diesem Branch');
      lines.push('');
      data.commits.forEach(commit => {
        lines.push(`- ${commit}`);
      });
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
      return '✅ Keine kritischen Probleme gefunden - bereit für Review!';
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
              `#### ${this.getSeverityEmoji(severity as any)} ${severity.toUpperCase()} (${findings.length})`
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
}
