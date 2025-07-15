import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

export interface LLMUsageData {
  totalRequests: number;
  totalTokensUsed: number;
  totalCost: number;
  lastUsed: string;
  firstUsed: string;
  errorCount: number;
}

export interface UsageStats {
  [llmId: string]: LLMUsageData;
}

export class UsageTracker {
  private static instance: UsageTracker;
  private usageFile: string;
  private stats: UsageStats = {};

  private constructor() {
    // Store usage data in ~/.woaru/usage.json
    const woaruDir = path.join(os.homedir(), '.woaru');
    this.usageFile = path.join(woaruDir, 'usage.json');
    // Load stats asynchronously when first accessed
    this.loadStats().catch(() => {
      // Ignore errors during initialization
      this.stats = {};
    });
  }

  static getInstance(): UsageTracker {
    if (!UsageTracker.instance) {
      try {
        UsageTracker.instance = new UsageTracker();
      } catch (error) {
        console.warn(
          '⚠️ Failed to initialize UsageTracker, creating fallback instance'
        );
        // Create a fallback instance with basic functionality
        UsageTracker.instance = Object.create(UsageTracker.prototype);
        UsageTracker.instance.stats = {};
        UsageTracker.instance.usageFile = path.join(
          os.homedir(),
          '.woaru',
          'usage.json'
        );
      }
    }
    return UsageTracker.instance;
  }

  /**
   * Load usage statistics from disk
   */
  private async loadStats(): Promise<void> {
    try {
      if (await fs.pathExists(this.usageFile)) {
        // Check if file is empty first
        const fileStats = await fs.stat(this.usageFile);
        if (fileStats.size === 0) {
          console.warn(
            '⚠️ Usage statistics file is empty, initializing with empty stats'
          );
          this.stats = {};
          return;
        }

        // Try to read the file content manually first
        const fileContent = await fs.readFile(this.usageFile, 'utf-8');
        if (!fileContent.trim()) {
          console.warn(
            '⚠️ Usage statistics file is empty, initializing with empty stats'
          );
          this.stats = {};
          return;
        }

        // Now try to parse as JSON
        const data = JSON.parse(fileContent);

        // Validate that the data is a valid object
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          this.stats = data;
        } else {
          console.warn(
            '⚠️ Invalid usage statistics format, initializing with empty stats'
          );
          this.stats = {};
        }
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.warn(
          '⚠️ Usage statistics file contains invalid JSON, recreating with empty stats'
        );
      } else {
        console.warn(
          '⚠️ Failed to load usage statistics (file may be corrupted):',
          error instanceof Error ? error.message : error
        );
      }

      // Reset stats and recreate file
      this.stats = {};

      // Try to recreate the file with valid empty JSON
      try {
        await fs.ensureDir(path.dirname(this.usageFile));
        await fs.writeJson(this.usageFile, {}, { spaces: 2 });
      } catch (writeError) {
        console.warn(
          '⚠️ Could not recreate usage statistics file:',
          writeError instanceof Error ? writeError.message : writeError
        );
      }
    }
  }

  /**
   * Save usage statistics to disk
   */
  private async saveStats(): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.usageFile));
      await fs.writeJson(this.usageFile, this.stats, { spaces: 2 });
    } catch (error) {
      console.warn('⚠️ Failed to save usage statistics:', error);
    }
  }

  /**
   * Track a successful LLM API request
   */
  async trackRequest(
    llmId: string,
    tokensUsed: number = 0,
    estimatedCost: number = 0
  ): Promise<void> {
    if (!this.stats[llmId]) {
      this.stats[llmId] = {
        totalRequests: 0,
        totalTokensUsed: 0,
        totalCost: 0,
        lastUsed: new Date().toISOString(),
        firstUsed: new Date().toISOString(),
        errorCount: 0,
      };
    }

    const now = new Date().toISOString();
    this.stats[llmId].totalRequests += 1;
    this.stats[llmId].totalTokensUsed += tokensUsed;
    this.stats[llmId].totalCost += estimatedCost;
    this.stats[llmId].lastUsed = now;

    await this.saveStats();
  }

  /**
   * Track a failed LLM API request
   */
  async trackError(llmId: string): Promise<void> {
    if (!this.stats[llmId]) {
      this.stats[llmId] = {
        totalRequests: 0,
        totalTokensUsed: 0,
        totalCost: 0,
        lastUsed: new Date().toISOString(),
        firstUsed: new Date().toISOString(),
        errorCount: 0,
      };
    }

    this.stats[llmId].errorCount += 1;
    this.stats[llmId].lastUsed = new Date().toISOString();

    await this.saveStats();
  }

  /**
   * Ensure stats are loaded before accessing
   */
  private async ensureLoaded(): Promise<void> {
    try {
      await this.loadStats();
    } catch (error) {
      console.warn('⚠️ Failed to ensure stats are loaded, using empty stats');
      this.stats = {};
    }
  }

  /**
   * Get usage statistics for a specific LLM
   */
  async getUsageStats(llmId: string): Promise<LLMUsageData | null> {
    await this.ensureLoaded();
    return this.stats[llmId] || null;
  }

  /**
   * Get all usage statistics
   */
  async getAllUsageStats(): Promise<UsageStats> {
    await this.ensureLoaded();
    return { ...this.stats };
  }

  /**
   * Get total usage across all LLMs
   */
  async getTotalUsage(): Promise<{
    totalRequests: number;
    totalTokensUsed: number;
    totalCost: number;
    totalErrors: number;
    activeProviders: number;
  }> {
    await this.ensureLoaded();
    const allStats = Object.values(this.stats);

    return {
      totalRequests: allStats.reduce(
        (sum, stat) => sum + stat.totalRequests,
        0
      ),
      totalTokensUsed: allStats.reduce(
        (sum, stat) => sum + stat.totalTokensUsed,
        0
      ),
      totalCost: allStats.reduce((sum, stat) => sum + stat.totalCost, 0),
      totalErrors: allStats.reduce((sum, stat) => sum + stat.errorCount, 0),
      activeProviders: allStats.filter(stat => stat.totalRequests > 0).length,
    };
  }

  /**
   * Reset all usage statistics
   */
  async resetStats(): Promise<void> {
    this.stats = {};
    await this.saveStats();
  }

  /**
   * Get formatted usage summary for display
   */
  async getFormattedSummary(): Promise<string[]> {
    const total = await this.getTotalUsage();
    const lines: string[] = [];

    lines.push(`Total Requests: ${total.totalRequests}`);
    lines.push(`Total Tokens: ${total.totalTokensUsed.toLocaleString()}`);
    lines.push(`Total Cost: $${total.totalCost.toFixed(4)}`);
    lines.push(`Total Errors: ${total.totalErrors}`);
    lines.push(`Active Providers: ${total.activeProviders}`);

    return lines;
  }

  /**
   * Export usage data for backup or analysis
   */
  async exportUsageData(outputFile: string): Promise<void> {
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalUsage: this.getTotalUsage(),
      providerStats: this.stats,
    };

    await fs.writeJson(outputFile, exportData, { spaces: 2 });
  }
}
