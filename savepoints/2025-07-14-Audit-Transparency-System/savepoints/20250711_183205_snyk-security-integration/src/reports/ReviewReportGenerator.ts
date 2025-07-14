import * as path from 'path';
import * as fs from 'fs-extra';
import { QualityCheckResult, SnykResult } from '../quality/QualityRunner';
import { ProductionAudit } from '../auditor/ProductionReadinessAuditor';
import { GitDiffResult } from '../utils/GitDiffAnalyzer';

export interface ReviewReportData {
  gitDiff: GitDiffResult;
  qualityResults: QualityCheckResult[];
  snykResults?: SnykResult[];
  productionAudits: ProductionAudit[];
  currentBranch: string;
  commits: string[];
}

export class ReviewReportGenerator {
  
  async generateMarkdownReport(data: ReviewReportData, outputPath: string): Promise<void> {
    const markdown = this.buildMarkdownReport(data);
    await fs.writeFile(outputPath, markdown, 'utf8');
  }

  generateJsonReport(data: ReviewReportData): string {
    const securitySummary = this.getSecuritySummary(data.snykResults || []);
    
    return JSON.stringify({
      summary: {
        baseBranch: data.gitDiff.baseBranch,
        currentBranch: data.currentBranch,
        totalChangedFiles: data.gitDiff.totalChanges,
        totalQualityIssues: data.qualityResults.length,
        totalSecurityIssues: securitySummary.total,
        criticalVulnerabilities: securitySummary.critical,
        highVulnerabilities: securitySummary.high,
        totalProductionIssues: data.productionAudits.length,
        commits: data.commits.length
      },
      changedFiles: data.gitDiff.changedFiles.map(file => path.basename(file)),
      qualityIssues: data.qualityResults,
      securityIssues: data.snykResults,
      productionAudits: data.productionAudits,
      commits: data.commits
    }, null, 2);
  }

  private buildMarkdownReport(data: ReviewReportData): string {
    const lines: string[] = [];
    const securitySummary = this.getSecuritySummary(data.snykResults || []);
    
    // Header
    lines.push('# WOARU Code Review');
    lines.push(`**Änderungen seit Branch: \`${data.gitDiff.baseBranch}\`**`);
    lines.push(`**Aktueller Branch: \`${data.currentBranch}\`**`);
    lines.push(`**Generiert am: ${new Date().toLocaleString('de-DE')}**`);
    lines.push('');

    // Security Issues FIRST (if any critical/high issues exist)
    if (securitySummary.critical > 0 || securitySummary.high > 0) {
      lines.push('## 🚨 KRITISCHE SICHERHEITS-PROBLEME (gefunden von Snyk)');
      lines.push('');
      lines.push(`**⚠️ WARNUNG: ${securitySummary.critical} kritische und ${securitySummary.high} hohe Sicherheitslücken gefunden!**`);
      lines.push('');
      this.addSecuritySection(lines, data.snykResults || []);
      lines.push('');
    }

    // Summary
    lines.push('## 📊 Zusammenfassung');
    lines.push('');
    lines.push(`- **Geänderte Dateien:** ${data.gitDiff.totalChanges}`);
    lines.push(`- **Qualitäts-Probleme:** ${data.qualityResults.length}`);
    lines.push(`- **Sicherheits-Probleme:** ${securitySummary.total} (${securitySummary.critical} kritisch, ${securitySummary.high} hoch)`);
    lines.push(`- **Produktions-Empfehlungen:** ${data.productionAudits.length}`);
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
    if (data.snykResults && data.snykResults.length > 0 && securitySummary.total > 0) {
      lines.push('## 🔒 Alle Sicherheits-Befunde');
      lines.push('');
      this.addDetailedSecuritySection(lines, data.snykResults);
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
          lines.push(`**${result.tool}:**`);
          result.issues.forEach(issue => {
            lines.push(`- ${issue}`);
          });
          lines.push('');
        });
      });
    }

    // Production Audits
    if (data.productionAudits.length > 0) {
      lines.push('## 🏗️ Empfehlungen zur Produktionsreife');
      lines.push('');
      
      // Group by priority
      const auditsByPriority = this.groupAuditsByPriority(data.productionAudits);
      
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
    lines.push(`**Basis: \`${data.gitDiff.baseBranch}\` → \`${data.currentBranch}\`**`);
    
    return lines.join('\n');
  }

  private groupQualityIssuesByFile(results: QualityCheckResult[]): Record<string, QualityCheckResult[]> {
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
      low: audits.filter(a => a.priority === 'low')
    };
  }

  getReportSummary(data: ReviewReportData): string {
    const criticalIssues = data.qualityResults.filter(r => r.severity === 'error').length;
    const securitySummary = this.getSecuritySummary(data.snykResults || []);
    const highPriorityAudits = data.productionAudits.filter(a => a.priority === 'high' || a.priority === 'critical').length;
    
    if (criticalIssues === 0 && securitySummary.critical === 0 && securitySummary.high === 0 && highPriorityAudits === 0) {
      return '✅ Keine kritischen Probleme gefunden - bereit für Review!';
    }
    
    const issues = [];
    if (securitySummary.critical > 0 || securitySummary.high > 0) {
      issues.push(`${securitySummary.critical + securitySummary.high} Sicherheits-Probleme`);
    }
    if (criticalIssues > 0) {
      issues.push(`${criticalIssues} Qualitäts-Probleme`);
    }
    if (highPriorityAudits > 0) {
      issues.push(`${highPriorityAudits} Produktions-Empfehlungen`);
    }
    
    return `⚠️ Gefunden: ${issues.join(', ')}`;
  }

  private getSecuritySummary(snykResults: SnykResult[]): {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  } {
    const summary = {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    snykResults.forEach(result => {
      if (result.summary) {
        summary.total += result.summary.total;
        summary.critical += result.summary.critical;
        summary.high += result.summary.high;
        summary.medium += result.summary.medium;
        summary.low += result.summary.low;
      }
    });

    return summary;
  }

  private addSecuritySection(lines: string[], snykResults: SnykResult[]): void {
    snykResults.forEach(result => {
      if (result.type === 'dependencies' && result.vulnerabilities) {
        // Show only critical and high vulnerabilities in the urgent section
        const criticalVulns = result.vulnerabilities.filter(v => v.severity === 'critical');
        const highVulns = result.vulnerabilities.filter(v => v.severity === 'high');

        if (criticalVulns.length > 0) {
          lines.push('### 🔴 KRITISCHE Abhängigkeits-Schwachstellen');
          lines.push('');
          criticalVulns.forEach(vuln => {
            lines.push(`**${vuln.title}**`);
            lines.push(`- **Paket:** ${vuln.packageName}@${vuln.version}`);
            lines.push(`- **Schweregrad:** KRITISCH`);
            if (vuln.CVSSv3) {
              lines.push(`- **CVSS Score:** ${vuln.CVSSv3}`);
            }
            if (vuln.isUpgradable) {
              lines.push(`- **✅ Fix verfügbar:** Upgrade auf ${vuln.fixedIn?.[0] || 'neueste Version'}`);
              lines.push(`- **Empfehlung:** \`npm update ${vuln.packageName}\` oder manuell in package.json aktualisieren`);
            } else {
              lines.push(`- **❌ Kein direkter Fix verfügbar**`);
              lines.push(`- **Empfehlung:** Überprüfe alternative Pakete oder warte auf Patch`);
            }
            lines.push('');
          });
        }

        if (highVulns.length > 0) {
          lines.push('### 🟡 HOHE Abhängigkeits-Schwachstellen');
          lines.push('');
          highVulns.forEach(vuln => {
            lines.push(`**${vuln.title}**`);
            lines.push(`- **Paket:** ${vuln.packageName}@${vuln.version}`);
            lines.push(`- **Schweregrad:** HOCH`);
            if (vuln.isUpgradable) {
              lines.push(`- **✅ Fix verfügbar:** Upgrade empfohlen`);
            }
            lines.push('');
          });
        }
      }

      if (result.type === 'code' && result.codeIssues) {
        const criticalCodeIssues = result.codeIssues.filter(i => i.severity === 'critical' || i.severity === 'high');
        if (criticalCodeIssues.length > 0) {
          lines.push('### 🔍 Code-Sicherheitsprobleme (Snyk Code)');
          lines.push('');
          criticalCodeIssues.forEach(issue => {
            lines.push(`**${issue.title}**`);
            lines.push(`- **Datei:** ${issue.filePath}:${issue.line}`);
            lines.push(`- **Schweregrad:** ${issue.severity.toUpperCase()}`);
            lines.push(`- **Kategorie:** ${issue.categories.join(', ')}`);
            lines.push('');
          });
        }
      }
    });
  }

  private addDetailedSecuritySection(lines: string[], snykResults: SnykResult[]): void {
    snykResults.forEach(result => {
      if (result.error) {
        lines.push(`⚠️ **Snyk Error:** ${result.error}`);
        lines.push('');
        return;
      }

      if (result.type === 'dependencies' && result.vulnerabilities && result.vulnerabilities.length > 0) {
        lines.push('### 📦 Abhängigkeits-Schwachstellen');
        lines.push('');
        
        // Group by severity
        const bySeverity = {
          critical: result.vulnerabilities.filter(v => v.severity === 'critical'),
          high: result.vulnerabilities.filter(v => v.severity === 'high'),
          medium: result.vulnerabilities.filter(v => v.severity === 'medium'),
          low: result.vulnerabilities.filter(v => v.severity === 'low')
        };

        Object.entries(bySeverity).forEach(([severity, vulns]) => {
          if (vulns.length > 0) {
            lines.push(`#### ${this.getSeverityEmoji(severity as any)} ${severity.toUpperCase()} (${vulns.length})`);
            lines.push('');
            vulns.forEach(vuln => {
              lines.push(`- **${vuln.title}** in ${vuln.packageName}@${vuln.version}`);
            });
            lines.push('');
          }
        });
      }

      if (result.type === 'code' && result.codeIssues && result.codeIssues.length > 0) {
        lines.push('### 🔍 Code-Sicherheitsprobleme');
        lines.push('');
        
        result.codeIssues.forEach(issue => {
          lines.push(`- **${issue.title}** (${issue.severity})`);
          lines.push(`  - Datei: ${issue.filePath}:${issue.line}`);
        });
        lines.push('');
      }
    });
  }

  private getSeverityEmoji(severity: 'critical' | 'high' | 'medium' | 'low'): string {
    switch (severity) {
      case 'critical': return '🔴';
      case 'high': return '🟡';
      case 'medium': return '🔵';
      case 'low': return '⚪';
    }
  }
}