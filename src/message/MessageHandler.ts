import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { initializeI18n } from '../config/i18n';
import { FilenameHelper } from '../utils/filenameHelper';

/**
 * MessageHandler options for sending reports
 */
export interface MessageHandlerOptions {
  type?: 'analyze' | 'review' | 'audit' | 'llm-review' | 'all';
  latest?: boolean;
  url?: string;
  format?: 'markdown' | 'json';
  verbose?: boolean;
}

/**
 * Report metadata structure
 */
export interface ReportMetadata {
  filename: string;
  filepath: string;
  timestamp: Date;
  type: string;
  size: number;
}

/**
 * Webhook payload structure
 */
export interface WebhookPayload {
  reportType: string;
  timestamp: string;
  filename: string;
  content: string;
  metadata: {
    size: number;
    originalPath: string;
  };
}

/**
 * Security constants for input validation
 */
const SECURITY_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_URL_LENGTH: 2048,
  MAX_REPORTS_TO_PROCESS: 100,
  TIMEOUT_MS: 30000, // 30 seconds
} as const;

/**
 * MessageHandler - Core system for reading, filtering, and sending WOARU reports
 * Handles integration with CLI commands and external services via webhooks
 */
export class MessageHandler {
  private sentReportsDir: string;
  private woaruDir: string;

  constructor() {
    this.woaruDir = path.join(os.homedir(), '.woaru');
    this.sentReportsDir = path.join(this.woaruDir, 'sent-reports');
  }

  /**
   * Static method for CLI integration - main entry point
   * @param options - MessageHandler options from CLI arguments
   * @returns Promise<void>
   */
  static async send(options: MessageHandlerOptions): Promise<void> {
    try {
      await initializeI18n();
      
      const handler = new MessageHandler();

      console.log(chalk.blue('📤 WOARU Message Handler'));
      console.log(chalk.gray('═'.repeat(50)));

      // Read and filter reports
      const reports = await handler.readReports();
      if (reports.length === 0) {
        console.log(chalk.yellow('📭 No reports found in sent-reports directory'));
        console.log(chalk.gray(`   Location: ${handler.sentReportsDir}`));
        return;
      }

      const filteredReports = handler.filterReports(reports, options);
      if (filteredReports.length === 0) {
        console.log(chalk.yellow('📭 No reports match the specified criteria'));
        return;
      }

      console.log(chalk.green(`📋 Found ${filteredReports.length} matching reports`));

      // Display reports in terminal
      await handler.formatForTerminal(filteredReports, options);

      // Send webhook if URL provided
      if (options.url) {
        await handler.sendWebhook(options.url, filteredReports, options);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`❌ Error: ${errorMessage}`));
      
      if (options?.verbose) {
        console.error(chalk.gray('Stack trace:'), error);
      }
      
      throw error;
    }
  }

  /**
   * Read all reports from .woaru/sent-reports/ directory
   * @returns Promise<ReportMetadata[]> Array of report metadata
   */
  async readReports(): Promise<ReportMetadata[]> {
    try {
      // Ensure directory exists
      await fs.ensureDir(this.sentReportsDir);

      // Read directory contents
      const files = await fs.readdir(this.sentReportsDir);
      const reports: ReportMetadata[] = [];

      for (const filename of files) {
        // Only process markdown files that match WOARU naming pattern
        if (!filename.endsWith('.md') || !this.isWOARUReportFile(filename)) {
          continue;
        }

        const filepath = path.join(this.sentReportsDir, filename);
        
        try {
          const stats = await fs.stat(filepath);
          
          // Security check: skip files that are too large
          if (stats.size > SECURITY_LIMITS.MAX_FILE_SIZE) {
            console.warn(chalk.yellow(`⚠️ Skipping large file: ${filename} (${stats.size} bytes)`));
            continue;
          }

          const timestamp = this.extractTimestampFromFilename(filename);
          const type = this.extractReportType(filename);

          reports.push({
            filename,
            filepath,
            timestamp: timestamp || stats.mtime,
            type: type || 'unknown',
            size: stats.size,
          });
        } catch (fileError) {
          console.warn(chalk.yellow(`⚠️ Could not process file: ${filename}`));
          continue;
        }
      }

      // Sort by timestamp (newest first)
      reports.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return reports.slice(0, SECURITY_LIMITS.MAX_REPORTS_TO_PROCESS);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        console.warn(chalk.yellow('📁 sent-reports directory does not exist'));
        return [];
      }
      throw new Error(`Failed to read reports: ${error?.message || String(error)}`);
    }
  }

  /**
   * Filter reports based on criteria
   * @param reports - Array of report metadata
   * @param criteria - Filter criteria from CLI options
   * @returns ReportMetadata[] Filtered reports
   */
  filterReports(reports: ReportMetadata[], criteria: MessageHandlerOptions): ReportMetadata[] {
    let filtered = [...reports];

    // Filter by type
    if (criteria.type && criteria.type !== 'all') {
      filtered = filtered.filter(report => 
        report.type === criteria.type || 
        report.filename.includes(criteria.type!)
      );
    }

    // Filter for latest only
    if (criteria.latest) {
      filtered = filtered.slice(0, 1);
    }

    return filtered;
  }

  /**
   * Format reports for terminal output
   * @param reports - Array of report metadata
   * @param options - Display options
   */
  async formatForTerminal(reports: ReportMetadata[], options: MessageHandlerOptions): Promise<void> {
    console.log();
    console.log(chalk.cyan('📊 Report Summary:'));
    console.log(chalk.gray('-'.repeat(50)));

    for (const [index, report] of reports.entries()) {
      const typeIcon = this.getTypeIcon(report.type);
      const sizeFormatted = this.formatFileSize(report.size);
      const timeFormatted = report.timestamp.toLocaleString();

      console.log(`${index + 1}. ${typeIcon} ${chalk.bold(report.type.toUpperCase())}`);
      console.log(`   ${chalk.gray('File:')} ${report.filename}`);
      console.log(`   ${chalk.gray('Size:')} ${sizeFormatted}`);
      console.log(`   ${chalk.gray('Date:')} ${timeFormatted}`);

      // Show content preview if verbose
      if (options.verbose) {
        try {
          const content = await fs.readFile(report.filepath, 'utf8');
          const preview = this.extractContentPreview(content);
          console.log(`   ${chalk.gray('Preview:')} ${preview}`);
        } catch (error) {
          console.log(`   ${chalk.red('Preview: Error reading file')}`);
        }
      }

      console.log();
    }
  }

  /**
   * Send reports to webhook URL
   * @param url - Webhook URL
   * @param reports - Array of report metadata  
   * @param options - Send options
   */
  async sendWebhook(url: string, reports: ReportMetadata[], options: MessageHandlerOptions): Promise<void> {
    // Validate URL
    if (!this.isValidWebhookUrl(url)) {
      throw new Error('Invalid webhook URL provided');
    }

    console.log(chalk.blue(`🌐 Sending to webhook: ${this.sanitizeUrl(url)}`));

    for (const report of reports) {
      try {
        // Read report content
        const content = await fs.readFile(report.filepath, 'utf8');

        // Prepare payload
        const payload: WebhookPayload = {
          reportType: report.type,
          timestamp: report.timestamp.toISOString(),
          filename: report.filename,
          content: options.format === 'json' ? this.convertToJson(content) : content,
          metadata: {
            size: report.size,
            originalPath: report.filepath,
          },
        };

        // Send HTTP POST request
        await this.sendHttpPost(url, payload, options);

        console.log(chalk.green(`✅ Sent: ${report.filename}`));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`❌ Failed to send ${report.filename}: ${errorMessage}`));
        
        if (options.verbose) {
          console.error(chalk.gray('Error details:'), error);
        }
      }
    }
  }

  /**
   * Check if filename matches WOARU report pattern
   * @param filename - Filename to check
   * @returns boolean
   */
  private isWOARUReportFile(filename: string): boolean {
    // Check for WOARU report pattern: YYYY-MM-DDTHH-mm-ss-fffZ-woaru-[command]-YYYYMMDD-HHMMSS.md
    // Or the standard FilenameHelper pattern
    return FilenameHelper.isValidReportFilename(filename) || 
           filename.includes('woaru') || 
           /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-woaru-/.test(filename);
  }

  /**
   * Extract timestamp from filename
   * @param filename - Report filename
   * @returns Date | null
   */
  private extractTimestampFromFilename(filename: string): Date | null {
    try {
      // Try FilenameHelper format first
      const timestamp = FilenameHelper.extractTimestampFromFilename(filename);
      if (timestamp) {
        const [datePart, timePart] = timestamp.split('_');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute, second] = timePart.split('-').map(Number);
        return new Date(year, month - 1, day, hour, minute, second);
      }

      // Try legacy format: YYYY-MM-DDTHH-mm-ss-fffZ
      const isoMatch = filename.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
      if (isoMatch) {
        return new Date(isoMatch[1].replace(/-/g, ':').replace(/T(\d{2}):(\d{2}):(\d{2}):(\d{3})Z/, 'T$1:$2:$3.$4Z'));
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract report type from filename
   * @param filename - Report filename
   * @returns string
   */
  private extractReportType(filename: string): string | null {
    // Try FilenameHelper format first
    const type = FilenameHelper.extractCommandType(filename);
    if (type) {
      return type;
    }

    // Try legacy format: ...-woaru-[type]-...
    const match = filename.match(/-woaru-([^-]+)-/);
    return match ? match[1] : null;
  }

  /**
   * Get icon for report type
   * @param type - Report type
   * @returns string
   */
  private getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      analyze: '🔍',
      review: '📝',
      audit: '🔒',
      'llm-review': '🧠',
      git: '📊',
      unknown: '📄',
    };
    return icons[type] || icons.unknown;
  }

  /**
   * Format file size for display
   * @param bytes - File size in bytes
   * @returns string
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Extract content preview from report
   * @param content - Full report content
   * @returns string
   */
  private extractContentPreview(content: string): string {
    const lines = content.split('\n');
    const meaningfulLines = lines
      .filter(line => line.trim() && !line.startsWith('#'))
      .slice(0, 2);
    
    const preview = meaningfulLines.join(' ').substring(0, 100);
    return preview + (preview.length === 100 ? '...' : '');
  }

  /**
   * Validate webhook URL
   * @param url - URL to validate
   * @returns boolean
   */
  private isValidWebhookUrl(url: string): boolean {
    try {
      if (!url || url.length > SECURITY_LIMITS.MAX_URL_LENGTH) {
        return false;
      }

      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
    } catch {
      return false;
    }
  }

  /**
   * Sanitize URL for logging
   * @param url - URL to sanitize
   * @returns string
   */
  private sanitizeUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      return `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;
    } catch {
      return '[invalid URL]';
    }
  }

  /**
   * Convert markdown content to JSON format
   * @param content - Markdown content
   * @returns string
   */
  private convertToJson(content: string): string {
    try {
      return JSON.stringify({
        format: 'markdown',
        content: content,
        lines: content.split('\n').length,
        size: content.length,
        timestamp: new Date().toISOString(),
      }, null, 2);
    } catch {
      return JSON.stringify({ error: 'Failed to convert content', original: content });
    }
  }

  /**
   * Send HTTP POST request to webhook
   * @param url - Webhook URL
   * @param payload - Payload to send
   * @param options - Request options
   */
  private async sendHttpPost(url: string, payload: WebhookPayload, options: MessageHandlerOptions): Promise<void> {
    // Using dynamic import for better compatibility
    const https = await import('https');
    const http = await import('http');
    
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;

      const postData = JSON.stringify(payload);
      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'WOARU-MessageHandler/1.0',
        },
        timeout: SECURITY_LIMITS.TIMEOUT_MS,
      };

      const req = client.request(requestOptions, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            if (options.verbose) {
              console.log(chalk.gray(`   Response: ${res.statusCode} ${responseData.substring(0, 100)}`));
            }
            resolve();
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(postData);
      req.end();
    });
  }
}