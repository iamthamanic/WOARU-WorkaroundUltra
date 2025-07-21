import { EventEmitter } from 'events';
import chalk from 'chalk';
import notifier from 'node-notifier';
import axios from 'axios';
import { ToolRecommendation, CodeIssue, SupervisorConfig } from './types';
import { ProductionAudit } from '../auditor/ProductionReadinessAuditor';
import { t } from '../config/i18n';

export class NotificationManager extends EventEmitter {
  private config: SupervisorConfig['notifications'];
  private notificationHistory: Map<string, Date> = new Map();
  private cooldownMinutes = 5;

  constructor(config: SupervisorConfig['notifications']) {
    super();
    this.config = config;
  }

  async notifyRecommendations(
    recommendations: ToolRecommendation[]
  ): Promise<void> {
    if (recommendations.length === 0) return;

    // Group by priority
    const critical = recommendations.filter(r => r.priority === 'critical');
    const high = recommendations.filter(r => r.priority === 'high');
    const other = recommendations.filter(
      r => r.priority === 'medium' || r.priority === 'low'
    );

    // Terminal notification
    if (this.config.terminal) {
      this.showTerminalNotification(critical, high, other);
    }

    // Desktop notification for critical
    if (this.config.desktop && critical.length > 0) {
      await this.showDesktopNotification(critical);
    }

    // Webhook
    if (this.config.webhook) {
      await this.sendWebhook('recommendations', recommendations);
    }
  }

  async notifyIssues(issues: CodeIssue[]): Promise<void> {
    const criticalIssues = issues.filter(i => i.severity === 'critical');

    if (criticalIssues.length > 0 && this.config.terminal) {
      console.log(
        chalk.red('\n' + t('notification_manager.critical_issues_detected'))
      );
      criticalIssues.forEach(issue => {
        console.log(
          chalk.red(
            `   - ${issue.file}:${issue.line || '?'} - ${issue.message}`
          )
        );
      });
    }
  }

  private showTerminalNotification(
    critical: ToolRecommendation[],
    high: ToolRecommendation[],
    other: ToolRecommendation[]
  ): void {
    console.log(
      chalk.cyan('\n' + t('notification_manager.recommendations_update') + '\n')
    );

    if (critical.length > 0) {
      console.log(chalk.red(t('notification_manager.critical_priority')));
      critical.forEach(rec => {
        console.log(chalk.red(`   ${rec.tool}: ${rec.reason}`));
        if (rec.setupCommand) {
          console.log(chalk.gray(`     → ${rec.setupCommand}`));
        }
      });
      console.log();
    }

    if (high.length > 0) {
      console.log(chalk.yellow(t('notification_manager.high_priority')));
      high.forEach(rec => {
        console.log(chalk.yellow(`   ${rec.tool}: ${rec.reason}`));
      });
      console.log();
    }

    if (other.length > 0) {
      console.log(chalk.blue(t('notification_manager.suggestions_priority')));
      other.forEach(rec => {
        console.log(chalk.blue(`   ${rec.tool}: ${rec.reason}`));
      });
      console.log();
    }

    console.log(
      chalk.gray(t('notification_manager.run_recommendations_details') + '\n')
    );
  }

  private async showDesktopNotification(
    critical: ToolRecommendation[]
  ): Promise<void> {
    // Check cooldown
    const lastNotification = this.notificationHistory.get('desktop');
    if (lastNotification) {
      const minutesSince =
        (Date.now() - lastNotification.getTime()) / 1000 / 60;
      if (minutesSince < this.cooldownMinutes) {
        return;
      }
    }

    const tools = critical.map(r => r.tool).join(', ');

    notifier.notify({
      title: t('notification_manager.desktop_critical_missing'),
      message: t('notification_manager.desktop_missing_tools', { tools }),
      sound: true,
      wait: false,
    });

    this.notificationHistory.set('desktop', new Date());
  }

  private async sendWebhook(type: string, data: unknown): Promise<void> {
    if (!this.config.webhook) return;

    try {
      await axios.post(this.config.webhook, {
        type,
        timestamp: new Date().toISOString(),
        data,
      });
    } catch (error) {
      console.error(t('ai_provider_utils.failed_webhook'), error);
    }
  }

  showProgress(message: string): void {
    if (this.config.terminal) {
      console.log(chalk.gray(`⏳ ${message}`));
    }
  }

  showSuccess(message: string): void {
    if (this.config.terminal) {
      console.log(chalk.green(`✅ ${message}`));
    }
  }

  showError(message: string): void {
    if (this.config.terminal) {
      console.log(chalk.red(`❌ ${message}`));
    }

    if (this.config.desktop) {
      notifier.notify({
        title: t('notification_manager.desktop_error_title'),
        message,
        sound: true,
      });
    }
  }

  showCriticalQualityError(
    filePath: string,
    toolName: string,
    output: string
  ): void {
    if (this.config.terminal) {
      console.log(
        chalk.red('\n' + t('notification_manager.critical_quality_failed'))
      );
      console.log(
        chalk.red(t('notification_manager.quality_file', { file: filePath }))
      );
      console.log(
        chalk.red(t('notification_manager.quality_tool', { tool: toolName }))
      );
      console.log(chalk.red('─'.repeat(50)));
      console.log(chalk.red(output));
      console.log(chalk.red('─'.repeat(50)));
      console.log(
        chalk.yellow(t('notification_manager.fix_before_continuing'))
      );
      console.log(
        chalk.gray(t('notification_manager.run_manually_detailed') + '\n')
      );
    }

    if (this.config.desktop) {
      notifier.notify({
        title: `🚨 ${toolName} Error`,
        message: `Quality check failed in ${filePath}`,
        sound: true,
        wait: false,
      });
    }
  }

  showQualitySuccess(filePath: string, toolName: string): void {
    if (this.config.terminal) {
      console.log(
        chalk.green(
          t('notification_manager.quality_passed', {
            tool: toolName,
            file: filePath,
          })
        )
      );
    }
  }

  async notifyProductionAudits(audits: ProductionAudit[]): Promise<void> {
    if (audits.length === 0) return;

    if (this.config.terminal) {
      this.showProductionAuditsTerminal(audits);
    }

    // Desktop notification for critical production issues
    const criticalAudits = audits.filter(
      audit => audit.priority === 'critical'
    );
    if (this.config.desktop && criticalAudits.length > 0) {
      await this.showProductionAuditsDesktop(criticalAudits);
    }

    // Webhook
    if (this.config.webhook) {
      await this.sendWebhook('production_audits', audits);
    }
  }

  private showProductionAuditsTerminal(audits: ProductionAudit[]): void {
    console.log(
      chalk.cyan(
        '\n' + t('notification_manager.production_readiness_audit') + '\n'
      )
    );

    // Group by priority
    const critical = audits.filter(a => a.priority === 'critical');
    const high = audits.filter(a => a.priority === 'high');
    const medium = audits.filter(a => a.priority === 'medium');
    const low = audits.filter(a => a.priority === 'low');

    if (critical.length > 0) {
      console.log(chalk.red.bold(t('notification_manager.critical_must_fix')));
      critical.forEach(audit => {
        console.log(chalk.red(`   ${audit.message}`));
        console.log(chalk.gray(`     → ${audit.recommendation}`));
        if (audit.packages?.length) {
          console.log(chalk.gray(`     📦 ${audit.packages.join(', ')}`));
        }
      });
      console.log();
    }

    if (high.length > 0) {
      console.log(chalk.yellow.bold(t('notification_manager.high_should_fix')));
      high.forEach(audit => {
        console.log(chalk.yellow(`   ${audit.message}`));
        console.log(chalk.gray(`     → ${audit.recommendation}`));
        if (audit.packages?.length) {
          console.log(chalk.gray(`     📦 ${audit.packages.join(', ')}`));
        }
      });
      console.log();
    }

    if (medium.length > 0) {
      console.log(
        chalk.blue.bold(t('notification_manager.medium_improvement'))
      );
      medium.forEach(audit => {
        console.log(chalk.blue(`   ${audit.message}`));
        console.log(chalk.gray(`     → ${audit.recommendation}`));
      });
      console.log();
    }

    if (low.length > 0) {
      console.log(chalk.gray.bold(t('notification_manager.low_optional')));
      low.forEach(audit => {
        console.log(chalk.gray(`   ${audit.message}`));
        console.log(chalk.gray(`     → ${audit.recommendation}`));
      });
      console.log();
    }

    console.log(chalk.cyan(t('notification_manager.run_audit_details') + '\n'));
  }

  private async showProductionAuditsDesktop(
    criticalAudits: ProductionAudit[]
  ): Promise<void> {
    // Check cooldown
    const lastNotification = this.notificationHistory.get('production_audit');
    if (lastNotification) {
      const minutesSince =
        (Date.now() - lastNotification.getTime()) / 1000 / 60;
      if (minutesSince < this.cooldownMinutes) {
        return;
      }
    }

    const issues = criticalAudits.map(a => a.check).join(', ');

    notifier.notify({
      title: t('notification_manager.desktop_production_issues'),
      message: t('notification_manager.desktop_production_missing', { issues }),
      sound: true,
      wait: false,
    });

    this.notificationHistory.set('production_audit', new Date());
  }

  showHealthScore(score: number, previous?: number): void {
    if (!this.config.terminal) return;

    const bar = this.createProgressBar(score);
    const color =
      score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;

    let message = color(t('notification_manager.health_score', { score, bar }));

    if (previous !== undefined) {
      const diff = score - previous;
      if (diff > 0) {
        message += chalk.green(
          ' ' + t('notification_manager.health_score_up', { diff })
        );
      } else if (diff < 0) {
        message += chalk.red(
          ' ' +
            t('notification_manager.health_score_down', {
              diff: Math.abs(diff),
            })
        );
      }
    }

    console.log('\n' + message + '\n');
  }

  private createProgressBar(percentage: number): string {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
  }

  showWarning(message: string): void {
    if (this.config.terminal) {
      console.log(chalk.yellow(`⚠️  ${message}`));
    }
  }

  /**
   * Shows prominent security alerts in the terminal
   * @param severity - 'critical' or 'high'
   * @param title - Main security issue title
   * @param details - Additional details about the vulnerability
   * @param action - Recommended action to fix
   */
  showSecurityAlert(
    severity: 'critical' | 'high',
    title: string,
    details?: string,
    action?: string
  ): void {
    if (!this.config.terminal) return;

    console.log(''); // Empty line for separation

    if (severity === 'critical') {
      // Critical alerts get the most prominent display
      console.log(
        chalk.bgRed.white.bold(
          ' ' + t('notification_manager.security_alert_title') + ' '
        )
      );
      console.log(chalk.red('═'.repeat(60)));
      console.log(chalk.red.bold(title));
      if (details) {
        console.log(chalk.red(details));
      }
      if (action) {
        console.log(
          chalk.yellow.bold(
            '\n' + t('notification_manager.action_required', { action })
          )
        );
      }
      console.log(chalk.red('═'.repeat(60)));
    } else {
      // High severity alerts
      console.log(
        chalk.bgYellow.black.bold(
          ' ' + t('notification_manager.security_warning_title') + ' '
        )
      );
      console.log(chalk.yellow('─'.repeat(60)));
      console.log(chalk.yellow.bold(title));
      if (details) {
        console.log(chalk.yellow(details));
      }
      if (action) {
        console.log(
          chalk.cyan(
            '\n' + t('notification_manager.recommended_action', { action })
          )
        );
      }
      console.log(chalk.yellow('─'.repeat(60)));
    }

    console.log(''); // Empty line after

    // Desktop notification for critical security issues
    if (this.config.desktop && severity === 'critical') {
      // Check cooldown
      const lastSecurityNotification =
        this.notificationHistory.get('security_alert');
      if (
        !lastSecurityNotification ||
        (Date.now() - lastSecurityNotification.getTime()) / 1000 / 60 >=
          this.cooldownMinutes
      ) {
        notifier.notify({
          title: t('notification_manager.desktop_security_alert'),
          message: title,
          sound: true,
          wait: false,
        });

        this.notificationHistory.set('security_alert', new Date());
      }
    }

    // Webhook for security alerts
    if (this.config.webhook) {
      this.sendWebhook('security_alert', {
        severity,
        title,
        details,
        action,
        timestamp: new Date().toISOString(),
      }).catch(error => {
        console.error(t('notification_manager.failed_security_webhook'), error);
      });
    }
  }
}
