import * as path from 'path';
import * as fs from 'fs-extra';
import { QualityCheckResult } from '../quality/QualityRunner';
import { ProductionAudit } from '../auditor/ProductionReadinessAuditor';
import { GitDiffResult } from '../utils/GitDiffAnalyzer';

export interface ReviewReportData {
  gitDiff: GitDiffResult;
  qualityResults: QualityCheckResult[];
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
    return JSON.stringify({
      summary: {
        baseBranch: data.gitDiff.baseBranch,
        currentBranch: data.currentBranch,
        totalChangedFiles: data.gitDiff.totalChanges,
        totalQualityIssues: data.qualityResults.length,
        totalProductionIssues: data.productionAudits.length,
        commits: data.commits.length
      },
      changedFiles: data.gitDiff.changedFiles.map(file => path.basename(file)),
      qualityIssues: data.qualityResults,
      productionAudits: data.productionAudits,
      commits: data.commits
    }, null, 2);
  }

  private buildMarkdownReport(data: ReviewReportData): string {
    const lines: string[] = [];
    
    // Header
    lines.push('# WOARU Code Review');
    lines.push(`**Änderungen seit Branch: \`${data.gitDiff.baseBranch}\`**`);
    lines.push(`**Aktueller Branch: \`${data.currentBranch}\`**`);
    lines.push(`**Generiert am: ${new Date().toLocaleString('de-DE')}**`);
    lines.push('');

    // Summary
    lines.push('## 📊 Zusammenfassung');
    lines.push('');
    lines.push(`- **Geänderte Dateien:** ${data.gitDiff.totalChanges}`);
    lines.push(`- **Qualitäts-Probleme:** ${data.qualityResults.length}`);
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
    const highPriorityAudits = data.productionAudits.filter(a => a.priority === 'high' || a.priority === 'critical').length;
    
    if (criticalIssues === 0 && highPriorityAudits === 0) {
      return '✅ Keine kritischen Probleme gefunden - bereit für Review!';
    }
    
    const issues = [];
    if (criticalIssues > 0) {
      issues.push(`${criticalIssues} Qualitäts-Probleme`);
    }
    if (highPriorityAudits > 0) {
      issues.push(`${highPriorityAudits} Produktions-Empfehlungen`);
    }
    
    return `⚠️ Gefunden: ${issues.join(', ')}`;
  }
}