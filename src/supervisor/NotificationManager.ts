import { EventEmitter } from 'events';
import chalk from 'chalk';
import notifier from 'node-notifier';
import axios from 'axios';
import { ToolRecommendation, CodeIssue, SupervisorConfig } from './types';

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
      console.log(chalk.red('\n⚠️  Critical Issues Detected:'));
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
    console.log(chalk.cyan('\n📊 WAU Recommendations Update:\n'));

    if (critical.length > 0) {
      console.log(chalk.red('🔴 Critical:'));
      critical.forEach(rec => {
        console.log(chalk.red(`   ${rec.tool}: ${rec.reason}`));
        if (rec.setupCommand) {
          console.log(chalk.gray(`     → ${rec.setupCommand}`));
        }
      });
      console.log();
    }

    if (high.length > 0) {
      console.log(chalk.yellow('🟡 High Priority:'));
      high.forEach(rec => {
        console.log(chalk.yellow(`   ${rec.tool}: ${rec.reason}`));
      });
      console.log();
    }

    if (other.length > 0) {
      console.log(chalk.blue('🔵 Suggestions:'));
      other.forEach(rec => {
        console.log(chalk.blue(`   ${rec.tool}: ${rec.reason}`));
      });
      console.log();
    }

    console.log(chalk.gray('💡 Run "wau recommendations" for details\n'));
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
      title: 'WAU: Critical Tools Missing',
      message: `Missing: ${tools}. Run "wau setup" to fix.`,
      sound: true,
      wait: false,
    });

    this.notificationHistory.set('desktop', new Date());
  }

  private async sendWebhook(type: string, data: any): Promise<void> {
    if (!this.config.webhook) return;

    try {
      await axios.post(this.config.webhook, {
        type,
        timestamp: new Date().toISOString(),
        data,
      });
    } catch (error) {
      console.error('Failed to send webhook:', error);
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
        title: 'WAU Error',
        message,
        sound: true,
      });
    }
  }

  showHealthScore(score: number, previous?: number): void {
    if (!this.config.terminal) return;

    const bar = this.createProgressBar(score);
    const color =
      score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;

    let message = color(`Health Score: ${score}/100 ${bar}`);

    if (previous !== undefined) {
      const diff = score - previous;
      if (diff > 0) {
        message += chalk.green(` ↑${diff}`);
      } else if (diff < 0) {
        message += chalk.red(` ↓${Math.abs(diff)}`);
      }
    }

    console.log('\n' + message + '\n');
  }

  private createProgressBar(percentage: number): string {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
  }
}
