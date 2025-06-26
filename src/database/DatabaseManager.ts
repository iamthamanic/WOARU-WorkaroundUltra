import axios from 'axios';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ToolsDatabase } from '../types';

export class DatabaseManager {
  private readonly localDbPath: string;
  private readonly remoteDbUrl: string;
  private cachedDb: ToolsDatabase | null = null;

  constructor() {
    this.localDbPath = path.join(__dirname, 'tools-db.json');
    this.remoteDbUrl =
      'https://raw.githubusercontent.com/iamthamanic/WAU-WorkaroundUltra/main/src/database/tools-db.json';
  }

  async getDatabase(): Promise<ToolsDatabase> {
    if (this.cachedDb) {
      return this.cachedDb;
    }

    try {
      const dbContent = await fs.readFile(this.localDbPath, 'utf-8');
      const db = JSON.parse(dbContent);
      this.cachedDb = db;
      return db;
    } catch (error) {
      throw new Error(`Failed to load tools database: ${error}`);
    }
  }

  async updateDatabase(): Promise<boolean> {
    try {
      const response = await axios.get(this.remoteDbUrl, {
        timeout: 10000,
      });

      const remoteDb: ToolsDatabase = response.data;

      // Validate database structure
      if (!this.validateDatabase(remoteDb)) {
        throw new Error('Invalid database structure received from remote');
      }

      // Backup current database
      const backupPath = `${this.localDbPath}.backup`;
      if (await fs.pathExists(this.localDbPath)) {
        await fs.copy(this.localDbPath, backupPath);
      }

      // Save new database
      await fs.writeFile(this.localDbPath, JSON.stringify(remoteDb, null, 2));
      this.cachedDb = remoteDb;

      return true;
    } catch (error) {
      console.error('Failed to update database:', error);
      return false;
    }
  }

  private validateDatabase(db: any): db is ToolsDatabase {
    return (
      typeof db === 'object' &&
      typeof db.version === 'string' &&
      typeof db.lastUpdated === 'string' &&
      typeof db.categories === 'object' &&
      typeof db.frameworks === 'object'
    );
  }

  async getToolsForFramework(framework: string): Promise<string[]> {
    const db = await this.getDatabase();
    const frameworkConfig = db.frameworks[framework];

    if (!frameworkConfig) {
      return [];
    }

    const tools: string[] = [];
    Object.entries(frameworkConfig.recommendedTools).forEach(
      ([category, categoryTools]) => {
        tools.push(...categoryTools);
      }
    );

    return [...new Set(tools)]; // Remove duplicates
  }

  async getToolConfig(toolName: string, framework?: string): Promise<any> {
    const db = await this.getDatabase();

    // Search through all categories for the tool
    for (const [categoryName, categoryTools] of Object.entries(db.categories)) {
      if (categoryTools[toolName]) {
        const toolConfig = categoryTools[toolName];

        // Return framework-specific config if available
        if (framework && toolConfig.configs && toolConfig.configs[framework]) {
          return {
            ...toolConfig,
            packages: [
              ...toolConfig.packages,
              ...toolConfig.configs[framework],
            ],
          };
        }

        return toolConfig;
      }
    }

    return null;
  }
}
