#!/usr/bin/env node

/**
 * WOARU Tools Database Updater
 * 
 * This script enriches the tools.json database with latest ecosystem data:
 * - NPM download statistics
 * - GitHub stars and activity
 * - Deprecation status
 * - Successor information
 * 
 * Usage: node scripts/update-tools-data.js
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');

class ToolsDataUpdater {
  constructor() {
    this.toolsFilePath = path.join(__dirname, '..', 'tools.json');
    this.npmRegistry = 'https://registry.npmjs.org';
    this.githubApi = 'https://api.github.com';
    
    // Rate limiting
    this.requestDelay = 100; // ms between requests
    this.retryDelay = 5000; // ms before retry
    this.maxRetries = 3;
  }

  /**
   * Main update process
   */
  async updateToolsDatabase() {
    try {
      console.log('🔄 Starting WOARU tools database update...');
      
      // Load current tools.json
      const toolsData = await this.loadToolsData();
      console.log(`📋 Loaded ${this.countTools(toolsData)} tools from database`);
      
      // Update each category
      let totalUpdated = 0;
      for (const [categoryName, category] of Object.entries(toolsData.categories)) {
        console.log(`\n📂 Processing category: ${categoryName}`);
        
        for (const [toolKey, tool] of Object.entries(category.tools)) {
          try {
            console.log(`   🔍 Updating ${tool.name}...`);
            
            const enrichedTool = await this.enrichToolData(tool, toolKey);
            toolsData.categories[categoryName].tools[toolKey] = enrichedTool;
            totalUpdated++;
            
            // Rate limiting
            await this.delay(this.requestDelay);
            
          } catch (error) {
            console.warn(`   ⚠️  Failed to update ${tool.name}: ${error.message}`);
          }
        }
      }
      
      // Update metadata
      toolsData.version = this.incrementVersion(toolsData.version);
      toolsData.lastUpdated = new Date().toISOString();
      
      // Save updated data
      await this.saveToolsData(toolsData);
      
      console.log(`\n✅ Update completed!`);
      console.log(`📊 Updated ${totalUpdated} tools`);
      console.log(`🆕 New version: ${toolsData.version}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ Update failed:', error);
      return false;
    }
  }

  /**
   * Enriches a single tool with latest ecosystem data
   */
  async enrichToolData(tool, toolKey) {
    const enrichedTool = { ...tool };
    
    // Extract package names for API calls
    const packageNames = this.extractPackageNames(tool);
    
    if (packageNames.length > 0) {
      // Get NPM data for the primary package
      const primaryPackage = packageNames[0];
      const npmData = await this.getNpmData(primaryPackage);
      
      if (npmData) {
        enrichedTool.downloads = npmData.downloads;
        enrichedTool.lastRelease = npmData.lastRelease;
        enrichedTool.isDeprecated = npmData.isDeprecated;
        
        if (npmData.isDeprecated && npmData.successor) {
          enrichedTool.successor = npmData.successor;
        }
      }
      
      // Get GitHub data if repository URL available
      const githubData = await this.getGithubData(tool.homepage || npmData?.repository);
      
      if (githubData) {
        enrichedTool.stars = githubData.stars;
        enrichedTool.lastCommit = githubData.lastCommit;
        enrichedTool.openIssues = githubData.openIssues;
        enrichedTool.contributors = githubData.contributors;
      }
    }
    
    // Update popularity score based on new data
    enrichedTool.popularity = this.calculatePopularityScore(enrichedTool);
    
    // Add ecosystem metadata
    enrichedTool.lastDataUpdate = new Date().toISOString();
    
    return enrichedTool;
  }

  /**
   * Extracts package names from tool configuration
   */
  extractPackageNames(tool) {
    const packages = [];
    
    // From keywords
    tool.keywords?.forEach(keyword => {
      if (keyword.includes('/') || keyword.match(/^[a-z0-9-]+$/)) {
        packages.push(keyword);
      }
    });
    
    // From frameworks object
    if (typeof tool.frameworks === 'object' && !Array.isArray(tool.frameworks)) {
      Object.values(tool.frameworks).forEach(pkg => {
        if (typeof pkg === 'string') {
          packages.push(pkg);
        }
      });
    }
    
    return [...new Set(packages)]; // Remove duplicates
  }

  /**
   * Fetches NPM registry data for a package
   */
  async getNpmData(packageName) {
    try {
      const url = `${this.npmRegistry}/${encodeURIComponent(packageName)}`;
      const data = await this.httpGet(url);
      
      if (!data) return null;
      
      const latest = data['dist-tags']?.latest;
      const latestVersion = data.versions?.[latest];
      
      // Get download statistics
      const downloadsData = await this.getNpmDownloads(packageName);
      
      return {
        downloads: downloadsData,
        lastRelease: latestVersion?.time?.[latest] || data.time?.modified,
        isDeprecated: latestVersion?.deprecated ? true : false,
        successor: this.extractSuccessor(latestVersion?.deprecated),
        repository: data.repository?.url
      };
      
    } catch (error) {
      console.warn(`Failed to get NPM data for ${packageName}:`, error.message);
      return null;
    }
  }

  /**
   * Fetches NPM download statistics
   */
  async getNpmDownloads(packageName) {
    try {
      const url = `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(packageName)}`;
      const data = await this.httpGet(url);
      
      return {
        weekly: data?.downloads || 0,
        lastWeek: data?.end || new Date().toISOString().split('T')[0]
      };
    } catch (error) {
      return { weekly: 0, lastWeek: null };
    }
  }

  /**
   * Fetches GitHub repository data
   */
  async getGithubData(repoUrl) {
    try {
      if (!repoUrl) return null;
      
      // Extract owner/repo from URL
      const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) return null;
      
      const [, owner, repo] = match;
      const cleanRepo = repo.replace(/\.git$/, '');
      
      const url = `${this.githubApi}/repos/${owner}/${cleanRepo}`;
      const data = await this.httpGet(url);
      
      if (!data) return null;
      
      return {
        stars: data.stargazers_count || 0,
        lastCommit: data.pushed_at,
        openIssues: data.open_issues_count || 0,
        contributors: await this.getGithubContributors(owner, cleanRepo)
      };
      
    } catch (error) {
      console.warn(`Failed to get GitHub data:`, error.message);
      return null;
    }
  }

  /**
   * Gets contributor count from GitHub
   */
  async getGithubContributors(owner, repo) {
    try {
      const url = `${this.githubApi}/repos/${owner}/${repo}/contributors?per_page=1`;
      const response = await this.httpGetWithHeaders(url);
      
      // Parse Link header for total count
      const linkHeader = response.headers?.link;
      if (linkHeader) {
        const match = linkHeader.match(/page=(\d+)>; rel="last"/);
        if (match) {
          return parseInt(match[1]);
        }
      }
      
      return response.data?.length || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculates popularity score based on multiple metrics
   */
  calculatePopularityScore(tool) {
    let score = tool.popularity || 50; // Base score
    
    // Factor in downloads (weekly)
    if (tool.downloads?.weekly) {
      const weeklyDownloads = tool.downloads.weekly;
      if (weeklyDownloads > 1000000) score += 20;
      else if (weeklyDownloads > 100000) score += 15;
      else if (weeklyDownloads > 10000) score += 10;
      else if (weeklyDownloads > 1000) score += 5;
    }
    
    // Factor in GitHub stars
    if (tool.stars) {
      if (tool.stars > 50000) score += 15;
      else if (tool.stars > 10000) score += 10;
      else if (tool.stars > 1000) score += 5;
    }
    
    // Penalty for deprecation
    if (tool.isDeprecated) {
      score -= 30;
    }
    
    // Bonus for recent activity
    if (tool.lastCommit) {
      const daysSinceCommit = (Date.now() - new Date(tool.lastCommit)) / (1000 * 60 * 60 * 24);
      if (daysSinceCommit < 30) score += 10;
      else if (daysSinceCommit < 90) score += 5;
      else if (daysSinceCommit > 365) score -= 10;
    }
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Extracts successor package from deprecation message
   */
  extractSuccessor(deprecationMessage) {
    if (!deprecationMessage) return null;
    
    // Common patterns in deprecation messages
    const patterns = [
      /use\s+([a-z0-9@\/-]+)\s+instead/i,
      /replaced\s+by\s+([a-z0-9@\/-]+)/i,
      /migrate\s+to\s+([a-z0-9@\/-]+)/i,
      /superseded\s+by\s+([a-z0-9@\/-]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = deprecationMessage.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * HTTP GET request helper
   */
  async httpGet(url) {
    return new Promise((resolve, reject) => {
      const request = https.get(url, {
        headers: {
          'User-Agent': 'WOARU-Tools-Updater/1.0.0',
          'Accept': 'application/json'
        }
      }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error(`Invalid JSON: ${error.message}`));
          }
        });
      });

      request.on('error', reject);
      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * HTTP GET with headers (for GitHub API)
   */
  async httpGetWithHeaders(url) {
    return new Promise((resolve, reject) => {
      const request = https.get(url, {
        headers: {
          'User-Agent': 'WOARU-Tools-Updater/1.0.0',
          'Accept': 'application/vnd.github.v3+json'
        }
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            resolve({
              data: response.statusCode === 200 ? JSON.parse(data) : null,
              headers: response.headers
            });
          } catch (error) {
            resolve({ data: null, headers: response.headers });
          }
        });
      });

      request.on('error', reject);
      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Utility functions
   */
  async loadToolsData() {
    const data = await fs.readFile(this.toolsFilePath, 'utf8');
    return JSON.parse(data);
  }

  async saveToolsData(data) {
    await fs.writeFile(this.toolsFilePath, JSON.stringify(data, null, 2), 'utf8');
  }

  countTools(toolsData) {
    let count = 0;
    Object.values(toolsData.categories).forEach(category => {
      count += Object.keys(category.tools).length;
    });
    return count;
  }

  incrementVersion(version) {
    const parts = version.split('.');
    parts[2] = (parseInt(parts[2]) + 1).toString();
    return parts.join('.');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
if (require.main === module) {
  const updater = new ToolsDataUpdater();
  updater.updateToolsDatabase()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = ToolsDataUpdater;