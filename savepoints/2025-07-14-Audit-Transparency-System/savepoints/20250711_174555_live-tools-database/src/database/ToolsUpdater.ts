import axios from 'axios';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ToolsDatabase } from '../types';
// import * as semver from 'semver'; // Currently unused

interface PackageStats {
  name: string;
  downloads: number;
  stars: number;
  lastUpdate: string;
  deprecated?: boolean;
  successor?: string;
}

interface ToolConfig {
  description?: string;
  metadata?: {
    popularity: number;
    lastChecked: string;
    deprecated?: boolean;
    successor?: string;
  };
  [key: string]: unknown;
}

export class ToolsUpdater {
  private readonly npmRegistry = 'https://registry.npmjs.org';
  private readonly githubApi = 'https://api.github.com';
  private readonly updateInterval = 7 * 24 * 60 * 60 * 1000; // 7 days

  async checkForUpdates(currentDb: ToolsDatabase): Promise<boolean> {
    const lastUpdate = new Date(currentDb.lastUpdated);
    const now = new Date();

    // Check if update is needed
    if (now.getTime() - lastUpdate.getTime() < this.updateInterval) {
      console.log('Database is up to date');
      return false;
    }

    return true;
  }

  async updateToolStats(
    toolName: string,
    packageManager: string
  ): Promise<PackageStats | null> {
    try {
      switch (packageManager) {
        case 'npm':
          return await this.getNpmStats(toolName);
        case 'pypi':
          return await this.getPyPiStats(toolName);
        case 'nuget':
          return await this.getNuGetStats(toolName);
        default:
          return null;
      }
    } catch (error) {
      console.error(`Failed to get stats for ${toolName}:`, error);
      return null;
    }
  }

  private async getNpmStats(packageName: string): Promise<PackageStats> {
    // Get package info
    const packageInfo = await axios.get(`${this.npmRegistry}/${packageName}`);
    const latest = packageInfo.data['dist-tags'].latest;
    const packageData = packageInfo.data.versions[latest];

    // Get download stats
    const downloads = await axios.get(
      `https://api.npmjs.org/downloads/point/last-month/${packageName}`
    );

    // Get GitHub stars if repository is listed
    let stars = 0;
    if (packageData.repository?.url) {
      const repoUrl = packageData.repository.url;
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (match) {
        try {
          const ghResponse = await axios.get(
            `${this.githubApi}/repos/${match[1]}/${match[2]}`,
            { headers: { Accept: 'application/vnd.github.v3+json' } }
          );
          stars = ghResponse.data.stargazers_count;
        } catch {
          // GitHub API might be rate limited
        }
      }
    }

    return {
      name: packageName,
      downloads: downloads.data.downloads || 0,
      stars,
      lastUpdate: packageData.time || new Date().toISOString(),
      deprecated: packageData.deprecated || false,
    };
  }

  private async getPyPiStats(packageName: string): Promise<PackageStats> {
    const response = await axios.get(
      `https://pypi.org/pypi/${packageName}/json`
    );
    const info = response.data.info;

    // PyPI doesn't provide download stats in the API anymore
    // We'd need to use BigQuery for accurate stats

    return {
      name: packageName,
      downloads: 0, // Would need BigQuery
      stars: 0, // Would need to parse home_page for GitHub
      lastUpdate:
        response.data.releases[info.version]?.[0]?.upload_time ||
        new Date().toISOString(),
    };
  }

  private async getNuGetStats(packageName: string): Promise<PackageStats> {
    await axios.get(
      `https://api.nuget.org/v3-flatcontainer/${packageName.toLowerCase()}/index.json`
    );

    return {
      name: packageName,
      downloads: 0, // Would need additional API call
      stars: 0,
      lastUpdate: new Date().toISOString(),
    };
  }

  async findBetterAlternatives(
    toolName: string,
    _category: string
  ): Promise<string[]> {
    // This would query various sources to find alternatives
    const alternatives: string[] = [];

    // Known replacements
    const knownReplacements: Record<string, string[]> = {
      tslint: ['eslint', '@typescript-eslint/eslint-plugin'],
      request: ['axios', 'node-fetch', 'got'],
      moment: ['date-fns', 'dayjs'],
      gulp: ['vite', 'webpack', 'rollup'],
      bower: ['npm', 'yarn'],
      coffeescript: ['typescript'],
      'node-sass': ['sass', 'dart-sass'],
    };

    if (knownReplacements[toolName.toLowerCase()]) {
      alternatives.push(...knownReplacements[toolName.toLowerCase()]);
    }

    return alternatives;
  }

  async generateUpdatedDatabase(
    currentDb: ToolsDatabase
  ): Promise<ToolsDatabase> {
    const updatedDb = JSON.parse(JSON.stringify(currentDb));
    updatedDb.lastUpdated = new Date().toISOString().split('T')[0];

    // Update tool stats for each category
    for (const [categoryName, categoryTools] of Object.entries(
      updatedDb.categories
    )) {
      for (const [toolName, toolConfig] of Object.entries(
        categoryTools as Record<string, ToolConfig>
      )) {
        // Get latest stats
        const stats = await this.updateToolStats(toolName, 'npm');

        if (stats) {
          (toolConfig as any).metadata = {
            popularity: stats.downloads,
            lastChecked: new Date().toISOString(),
            githubStars: stats.stars,
            deprecated: stats.deprecated,
            alternatives: await this.findBetterAlternatives(
              toolName,
              categoryName
            ),
          };

          // Mark deprecated tools
          if (stats.deprecated) {
            toolConfig.description = `[DEPRECATED] ${toolConfig.description || ''}`;
          }
        }
      }
    }

    // Add new trending tools
    await this.addTrendingTools(updatedDb);

    return updatedDb;
  }

  private async addTrendingTools(db: ToolsDatabase): Promise<void> {
    // This would query trending tools from various sources
    // For now, let's add some known modern tools

    // Add Biome (successor to Rome, alternative to ESLint+Prettier)
    if (!('biome' in db.categories.linting)) {
      (db.categories.linting as Record<string, ToolConfig>).biome = {
        description:
          'Fast formatter and linter for JavaScript, TypeScript, JSON, and more',
        packages: ['@biomejs/biome'],
        configs: {
          default: ['@biomejs/biome'],
        },
        configFiles: ['biome.json'],
        metadata: {
          popularity: 50000,
          lastChecked: new Date().toISOString(),
          githubStars: 5000,
          alternatives: [],
        } as any,
      };
    }

    // Add Bun as alternative to Node.js
    if (!('runtime' in db.categories)) {
      (db.categories as Record<string, Record<string, ToolConfig>>).runtime =
        {};
    }
    if (!('bun' in db.categories.runtime)) {
      (db.categories.runtime as Record<string, ToolConfig>).bun = {
        description: 'Fast all-in-one JavaScript runtime',
        packages: [],
        configs: {},
        configFiles: ['bunfig.toml'],
        metadata: {
          popularity: 100000,
          lastChecked: new Date().toISOString(),
          githubStars: 60000,
          alternatives: ['node', 'deno'],
        } as any,
      };
    }
  }

  async createUpdateScript(): Promise<void> {
    // Create a GitHub Action workflow for automatic updates
    const workflow = `name: Update Tools Database

on:
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sunday
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Update tools database
        run: npm run update-tools-db
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          
      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v5
        with:
          commit-message: 'chore: update tools database'
          title: 'Update Tools Database'
          body: |
            Automated update of tools database with latest versions and statistics.
            
            - Updated download statistics
            - Checked for deprecated packages
            - Added new trending tools
            - Updated alternative recommendations
          branch: update-tools-db
          delete-branch: true
`;

    const workflowPath = path.join(
      process.cwd(),
      '.github',
      'workflows',
      'update-tools.yml'
    );
    await fs.ensureDir(path.dirname(workflowPath));
    await fs.writeFile(workflowPath, workflow);
  }
}
