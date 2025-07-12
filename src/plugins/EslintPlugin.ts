import { HybridBasePlugin } from './HybridBasePlugin';
import { ToolsDatabaseManager } from '../database/ToolsDatabaseManager';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * EslintPlugin - Data-driven ESLint integration with hybrid architecture
 * 
 * Core Logic: Secure plugin implementation
 * Configuration: Dynamically loaded from tools.json
 */
export class EslintPlugin extends HybridBasePlugin {
  private databaseManager: ToolsDatabaseManager;
  
  constructor() {
    super();
    this.databaseManager = new ToolsDatabaseManager();
  }

  getName(): string {
    return 'EslintPlugin';
  }

  getSupportedExtensions(): string[] {
    // Core hardcoded support for security
    return ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
  }

  async canHandleFile(filePath: string): Promise<boolean> {
    const ext = path.extname(filePath);
    return this.getSupportedExtensions().includes(ext);
  }

  /**
   * Runs ESLint with dynamically loaded configuration from tools.json
   */
  async runLinter(filePath: string, options: { fix?: boolean } = {}): Promise<{
    success: boolean;
    output: string;
    hasErrors: boolean;
    hasWarnings: boolean;
  }> {
    try {
      // Get dynamic configuration from hybrid database
      const eslintConfig = await this.databaseManager.getCoreToolConfig('eslint');
      
      if (!eslintConfig) {
        console.warn('⚠️ ESLint configuration not found in database, using defaults');
        return this.runEslintDefault(filePath, options);
      }

      // Build command with recommended flags from database
      const args = this.buildEslintCommand(filePath, eslintConfig.recommended_flags, options);
      
      // Execute ESLint with secure core logic
      const result = await this.executeESLint(args);
      
      return {
        success: result.exitCode === 0,
        output: result.stdout + result.stderr,
        hasErrors: result.exitCode === 1,
        hasWarnings: result.exitCode === 0 && result.stdout.includes('warning')
      };
      
    } catch (error) {
      console.error('ESLint execution failed:', error);
      return {
        success: false,
        output: `ESLint error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        hasErrors: true,
        hasWarnings: false
      };
    }
  }

  /**
   * Gets framework-specific ESLint configuration from database
   */
  async getFrameworkSpecificConfig(framework: string): Promise<{
    extends: string[];
    plugins: string[];
    rules: Record<string, any>;
  } | null> {
    try {
      const frameworkRecs = await this.databaseManager.getFrameworkRecommendations(framework);
      
      if (!frameworkRecs || !frameworkRecs.core_tools.includes('eslint')) {
        return null;
      }

      // Get framework-specific config from database
      const hybridDb = await this.databaseManager.getHybridDatabase();
      const frameworkConfig = hybridDb.framework_recommendations[framework];
      
      if (frameworkConfig && frameworkConfig.eslint_config) {
        return {
          extends: Array.isArray(frameworkConfig.eslint_config) 
            ? frameworkConfig.eslint_config 
            : [frameworkConfig.eslint_config],
          plugins: this.getFrameworkPlugins(framework),
          rules: this.getFrameworkRules(framework)
        };
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to get framework-specific ESLint config:', error);
      return null;
    }
  }

  /**
   * Checks if ESLint has deprecated configuration
   */
  async checkDeprecationWarnings(): Promise<{
    isDeprecated: boolean;
    warning?: string;
    successor?: string;
    migrationGuide?: string;
  }> {
    try {
      // Check for deprecated ESLint configurations
      const deprecationInfo = await this.databaseManager.getDeprecationInfo('eslint');
      
      if (deprecationInfo) {
        return {
          isDeprecated: true,
          warning: deprecationInfo.reason,
          successor: deprecationInfo.successor,
          migrationGuide: deprecationInfo.migration_guide
        };
      }

      // Check for deprecated related tools (like TSLint)
      const tslintDeprecation = await this.databaseManager.getDeprecationInfo('tslint');
      if (tslintDeprecation) {
        return {
          isDeprecated: false,
          warning: `Detected deprecated TSLint. ${tslintDeprecation.reason}`,
          successor: 'eslint',
          migrationGuide: tslintDeprecation.migration_guide
        };
      }

      return { isDeprecated: false };
    } catch (error) {
      return { isDeprecated: false };
    }
  }

  /**
   * Gets recommended ESLint packages for installation
   */
  async getRecommendedPackages(projectContext: {
    hasTypeScript: boolean;
    hasReact: boolean;
    hasNext: boolean;
    framework?: string;
  }): Promise<string[]> {
    try {
      const eslintConfig = await this.databaseManager.getCoreToolConfig('eslint');
      
      if (!eslintConfig) {
        return this.getDefaultPackages(projectContext);
      }

      const packages = [eslintConfig.metadata.npm_package || 'eslint'];
      
      // Add framework-specific packages based on database recommendations
      if (projectContext.framework) {
        const frameworkRecs = await this.databaseManager.getFrameworkRecommendations(projectContext.framework);
        if (frameworkRecs && frameworkRecs.core_tools.includes('eslint')) {
          // Add framework-specific ESLint packages
          packages.push(...this.getFrameworkSpecificPackages(projectContext));
        }
      }

      return packages;
    } catch (error) {
      console.warn('Failed to get recommended ESLint packages from database:', error);
      return this.getDefaultPackages(projectContext);
    }
  }

  // ========== PRIVATE CORE METHODS (SECURE) ==========

  /**
   * Builds ESLint command with dynamic flags from database
   */
  private buildEslintCommand(filePath: string, recommendedFlags: string[], options: { fix?: boolean }): string[] {
    const args = ['eslint'];
    
    // Add dynamic flags from database
    if (recommendedFlags && recommendedFlags.length > 0) {
      args.push(...recommendedFlags);
    } else {
      // Fallback to safe defaults
      args.push('--format=stylish');
    }
    
    // Add fix flag if requested
    if (options.fix) {
      args.push('--fix');
    }
    
    // Add file path (always last)
    args.push(filePath);
    
    return args;
  }

  /**
   * Executes ESLint command securely
   */
  private executeESLint(args: string[]): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }> {
    return new Promise((resolve) => {
      const child = spawn('npx', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false // Security: Prevent shell injection
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (exitCode) => {
        resolve({
          exitCode: exitCode || 0,
          stdout,
          stderr
        });
      });

      child.on('error', (error) => {
        resolve({
          exitCode: 1,
          stdout: '',
          stderr: error.message
        });
      });

      // Security timeout
      setTimeout(() => {
        child.kill('SIGTERM');
        resolve({
          exitCode: 1,
          stdout: '',
          stderr: 'ESLint execution timeout'
        });
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Default ESLint execution (fallback when database unavailable)
   */
  private async runEslintDefault(filePath: string, options: { fix?: boolean }): Promise<{
    success: boolean;
    output: string;
    hasErrors: boolean;
    hasWarnings: boolean;
  }> {
    const args = ['eslint', '--format=stylish'];
    
    if (options.fix) {
      args.push('--fix');
    }
    
    args.push(filePath);
    
    const result = await this.executeESLint(args);
    
    return {
      success: result.exitCode === 0,
      output: result.stdout + result.stderr,
      hasErrors: result.exitCode === 1,
      hasWarnings: result.exitCode === 0 && result.stdout.includes('warning')
    };
  }

  /**
   * Gets default packages when database is unavailable
   */
  private getDefaultPackages(projectContext: {
    hasTypeScript: boolean;
    hasReact: boolean;
    hasNext: boolean;
  }): string[] {
    const packages = ['eslint'];
    
    if (projectContext.hasNext) {
      packages.push('eslint-config-next');
    } else if (projectContext.hasReact) {
      packages.push('@eslint/js', 'eslint-plugin-react', 'eslint-plugin-react-hooks');
    }
    
    if (projectContext.hasTypeScript) {
      packages.push('@typescript-eslint/eslint-plugin', '@typescript-eslint/parser');
    }
    
    return packages;
  }

  /**
   * Gets framework-specific ESLint packages
   */
  private getFrameworkSpecificPackages(projectContext: {
    hasTypeScript: boolean;
    hasReact: boolean;
    hasNext: boolean;
    framework?: string;
  }): string[] {
    const packages: string[] = [];
    
    switch (projectContext.framework) {
      case 'react':
        packages.push('eslint-plugin-react', 'eslint-plugin-react-hooks');
        if (projectContext.hasTypeScript) {
          packages.push('@typescript-eslint/eslint-plugin', '@typescript-eslint/parser');
        }
        break;
      case 'next':
        packages.push('eslint-config-next');
        break;
      case 'vue':
        packages.push('eslint-plugin-vue');
        break;
    }
    
    return packages;
  }

  /**
   * Gets framework-specific ESLint plugins
   */
  private getFrameworkPlugins(framework: string): string[] {
    switch (framework) {
      case 'react':
        return ['react', 'react-hooks'];
      case 'vue':
        return ['vue'];
      case 'angular':
        return ['@angular-eslint'];
      default:
        return [];
    }
  }

  /**
   * Gets framework-specific ESLint rules
   */
  private getFrameworkRules(framework: string): Record<string, any> {
    const baseRules = {
      'no-unused-vars': 'warn',
      'no-console': 'warn'
    };

    switch (framework) {
      case 'react':
        return {
          ...baseRules,
          'react/react-in-jsx-scope': 'off',
          'react/prop-types': 'warn'
        };
      case 'vue':
        return {
          ...baseRules,
          'vue/multi-word-component-names': 'off'
        };
      default:
        return baseRules;
    }
  }
}