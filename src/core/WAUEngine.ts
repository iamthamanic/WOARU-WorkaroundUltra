import { ProjectAnalyzer } from '../analyzer/ProjectAnalyzer';
import { CodeAnalyzer } from '../analyzer/CodeAnalyzer';
import { DatabaseManager } from '../database/DatabaseManager';
import { PluginManager } from '../plugins/PluginManager';
import { ActionManager } from '../actions/ActionManager';
import { AnalysisResult, SetupOptions, ProjectAnalysis } from '../types';
import chalk from 'chalk';

export class WAUEngine {
  private projectAnalyzer: ProjectAnalyzer;
  private codeAnalyzer: CodeAnalyzer;
  private databaseManager: DatabaseManager;
  private pluginManager: PluginManager;
  private actionManager: ActionManager;

  constructor() {
    this.projectAnalyzer = new ProjectAnalyzer();
    this.codeAnalyzer = new CodeAnalyzer();
    this.databaseManager = new DatabaseManager();
    this.pluginManager = new PluginManager();
    this.actionManager = new ActionManager();
  }

  async analyzeProject(projectPath: string): Promise<AnalysisResult> {
    try {
      console.log(chalk.blue('🔍 Analyzing project...'));
      
      const analysis = await this.projectAnalyzer.analyzeProject(projectPath);
      const metadata = await this.projectAnalyzer.getProjectMetadata(projectPath);
      
      console.log(chalk.gray(`📦 Project: ${metadata.name} (${metadata.version})`));
      console.log(chalk.gray(`🔧 Language: ${analysis.language}`));
      console.log(chalk.gray(`⚡ Frameworks: ${analysis.framework.join(', ') || 'None detected'}`));

      // Analyze code for specific insights
      console.log(chalk.blue('🔬 Analyzing codebase for insights...'));
      const codeInsights = await this.codeAnalyzer.analyzeCodebase(projectPath, analysis.language);

      // Get recommendations from plugins with code insights
      const recommendations = this.pluginManager.getAllRecommendations(analysis);
      
      // Enhance recommendations with code insights
      this.enhanceRecommendationsWithInsights(recommendations, codeInsights);
      
      const refactorSuggestions = this.pluginManager.getAllRefactorSuggestions(analysis);
      const frameworkSpecificPackages = this.pluginManager.getAllSpecificPackages(analysis);

      // Detect already installed tools
      const installedTools = await this.detectInstalledTools(analysis);

      // Generate Claude automation suggestions
      const claudeAutomations = this.generateClaudeAutomations(analysis);

      return {
        setup_recommendations: recommendations.map(r => 
          `Install ${r.tool} for ${r.category}: ${r.reason}`
        ),
        tool_suggestions: recommendations.map(r => r.tool),
        framework_specific_tools: frameworkSpecificPackages,
        refactor_suggestions: refactorSuggestions,
        installed_tools_detected: installedTools,
        claude_automations: claudeAutomations,
        code_insights: Array.from(codeInsights.entries()).map(([tool, insight]) => ({
          tool,
          reason: insight.reason,
          evidence: insight.evidence,
          severity: insight.severity
        }))
      };

    } catch (error) {
      throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async setupProject(projectPath: string, options: SetupOptions = {}): Promise<boolean> {
    try {
      const analysis = await this.projectAnalyzer.analyzeProject(projectPath);
      const recommendations = this.pluginManager.getAllRecommendations(analysis);

      if (recommendations.length === 0) {
        console.log(chalk.green('✅ Project is already well configured!'));
        return true;
      }

      console.log(chalk.blue(`🎯 Found ${recommendations.length} recommendations`));

      if (options.dryRun) {
        console.log(chalk.yellow('🔍 Dry run mode - showing what would be done:'));
        recommendations.forEach(rec => {
          console.log(chalk.gray(`  • ${rec.tool}: ${rec.reason}`));
        });
        return true;
      }

      const result = await this.actionManager.executeRecommendations(
        projectPath, 
        recommendations, 
        options
      );

      return result.success;

    } catch (error) {
      console.error(chalk.red(`❌ Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      return false;
    }
  }

  async updateDatabase(): Promise<boolean> {
    console.log(chalk.blue('📡 Updating tools database...'));
    
    const success = await this.databaseManager.updateDatabase();
    
    if (success) {
      console.log(chalk.green('✅ Database updated successfully'));
    } else {
      console.log(chalk.red('❌ Failed to update database'));
    }
    
    return success;
  }

  private async detectInstalledTools(analysis: ProjectAnalysis): Promise<string[]> {
    const installedTools: string[] = [];
    const allDeps = [...analysis.dependencies, ...analysis.devDependencies];
    const fs = require('fs-extra');
    const path = require('path');

    // Check for both dependencies AND configuration files
    const toolChecks = {
      'eslint': {
        packages: ['eslint'],
        configs: ['.eslintrc.js', '.eslintrc.json', '.eslintrc.yml', '.eslintrc.yaml', '.eslintrc', 'eslint.config.js']
      },
      'prettier': {
        packages: ['prettier'],
        configs: ['.prettierrc', '.prettierrc.json', '.prettierrc.yml', '.prettierrc.yaml', '.prettierrc.js', 'prettier.config.js']
      },
      'husky': {
        packages: ['husky'],
        configs: ['.husky', '.git/hooks']
      },
      'jest': {
        packages: ['jest'],
        configs: ['jest.config.js', 'jest.config.ts', 'jest.config.json']
      },
      'typescript': {
        packages: ['typescript'],
        configs: ['tsconfig.json']
      },
      'tailwindcss': {
        packages: ['tailwindcss'],
        configs: ['tailwind.config.js', 'tailwind.config.ts']
      },
      'postcss': {
        packages: ['postcss'],
        configs: ['postcss.config.js', 'postcss.config.ts']
      },
      'commitlint': {
        packages: ['@commitlint/cli', '@commitlint/config-conventional'],
        configs: ['commitlint.config.js', '.commitlintrc.js', '.commitlintrc.json']
      },
      'webpack': {
        packages: ['webpack'],
        configs: ['webpack.config.js', 'webpack.config.ts']
      },
      'vite': {
        packages: ['vite'],
        configs: ['vite.config.js', 'vite.config.ts']
      },
      'rollup': {
        packages: ['rollup'],
        configs: ['rollup.config.js', 'rollup.config.ts']
      },
      'babel': {
        packages: ['@babel/core', 'babel-core'],
        configs: ['.babelrc', '.babelrc.js', '.babelrc.json', 'babel.config.js']
      }
    };

    for (const [tool, check] of Object.entries(toolChecks)) {
      // Check if tool is installed via package dependencies
      const hasPackage = check.packages.some(pkg => allDeps.includes(pkg));
      
      // Check if tool has configuration files
      let hasConfig = false;
      if (check.configs) {
        for (const configFile of check.configs) {
          const configPath = path.join(analysis.projectPath || process.cwd(), configFile);
          try {
            if (await fs.pathExists(configPath)) {
              hasConfig = true;
              break;
            }
          } catch (error) {
            // Ignore file system errors
          }
        }
      }

      // Tool is considered installed if it has either package dependency OR config file
      if (hasPackage || hasConfig) {
        installedTools.push(tool);
      }
    }

    return installedTools;
  }

  private generateClaudeAutomations(analysis: ProjectAnalysis): string[] {
    const automations: string[] = [];

    // Framework-specific automations
    if (analysis.framework.includes('nextjs')) {
      automations.push('Generate Next.js API routes with proper TypeScript types');
      automations.push('Create reusable Next.js components with proper prop types');
      automations.push('Setup Next.js middleware for authentication');
    }

    if (analysis.framework.includes('react')) {
      automations.push('Refactor class components to functional components with hooks');
      automations.push('Generate custom hooks for common functionality');
      automations.push('Create component documentation with Storybook');
    }

    // Language-specific automations
    if (analysis.language === 'TypeScript') {
      automations.push('Generate TypeScript interfaces from API responses');
      automations.push('Add strict typing to existing JavaScript functions');
      automations.push('Create utility types for better type safety');
    }

    // Testing automations
    if (!analysis.devDependencies.includes('jest') && !analysis.devDependencies.includes('vitest')) {
      automations.push('Setup testing framework with example tests');
      automations.push('Generate unit tests for existing components');
    }

    // Documentation automations
    automations.push('Generate README.md with project setup instructions');
    automations.push('Create CONTRIBUTING.md with development guidelines');
    automations.push('Generate API documentation from code comments');

    return automations;
  }

  private enhanceRecommendationsWithInsights(recommendations: any[], codeInsights: Map<string, any>): void {
    recommendations.forEach(rec => {
      const insight = codeInsights.get(rec.tool);
      if (insight) {
        rec.reason = insight.reason;
        rec.evidence = insight.evidence;
        rec.priority = insight.severity === 'critical' ? 'high' : 
                      insight.severity === 'high' ? 'high' :
                      insight.severity === 'medium' ? 'medium' : 'low';
      }
    });
  }
}