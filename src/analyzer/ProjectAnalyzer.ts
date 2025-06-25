import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import { ProjectAnalysis } from '../types';
import { LanguageDetector } from './LanguageDetector';

export class ProjectAnalyzer {
  private languageDetector: LanguageDetector;

  constructor() {
    this.languageDetector = new LanguageDetector();
  }
  async analyzeProject(projectPath: string): Promise<ProjectAnalysis> {
    // Detect primary language first
    const primaryLanguage = await this.languageDetector.detectPrimaryLanguage(projectPath);
    const allLanguages = await this.languageDetector.detectLanguages(projectPath);
    
    // For Node.js projects
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = await this.readPackageJson(packageJsonPath);
    
    // Detect frameworks based on language
    const frameworks = await this.languageDetector.detectFrameworks(projectPath, primaryLanguage);
    
    const analysis: ProjectAnalysis = {
      language: primaryLanguage === 'javascript' ? await this.detectLanguage(projectPath) : 
                this.languageDetector.getLanguageInfo(primaryLanguage)?.name || primaryLanguage,
      framework: frameworks,
      packageManager: await this.detectPackageManager(projectPath),
      dependencies: packageJson ? Object.keys(packageJson.dependencies || {}) : [],
      devDependencies: packageJson ? Object.keys(packageJson.devDependencies || {}) : [],
      scripts: packageJson ? packageJson.scripts || {} : {},
      configFiles: await this.findConfigFiles(projectPath),
      structure: await this.analyzeStructure(projectPath),
      detectedLanguages: allLanguages
    };

    return analysis;
  }

  private async readPackageJson(packageJsonPath: string): Promise<any> {
    try {
      return await fs.readJson(packageJsonPath);
    } catch {
      return null;
    }
  }

  private async detectLanguage(projectPath: string): Promise<string> {
    const tsconfigPath = path.join(projectPath, 'tsconfig.json');
    const hasTypeScript = await fs.pathExists(tsconfigPath);
    
    if (hasTypeScript) {
      return 'TypeScript';
    }

    // Check for TypeScript files in the project
    const tsFiles = await glob('**/*.{ts,tsx}', { 
      cwd: projectPath,
      ignore: ['node_modules/**', 'dist/**', 'build/**']
    });

    return tsFiles.length > 0 ? 'TypeScript' : 'JavaScript';
  }

  private async detectFrameworks(projectPath: string, packageJson: any): Promise<string[]> {
    const frameworks: string[] = [];
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Next.js
    if (allDeps.next || await fs.pathExists(path.join(projectPath, 'next.config.js')) || 
        await fs.pathExists(path.join(projectPath, 'next.config.ts'))) {
      frameworks.push('nextjs');
    }

    // React
    if (allDeps.react) {
      frameworks.push('react');
    }

    // Vue
    if (allDeps.vue) {
      frameworks.push('vue');
    }

    // Express
    if (allDeps.express) {
      frameworks.push('express');
    }

    // Nuxt
    if (allDeps.nuxt) {
      frameworks.push('nuxt');
    }

    // Vite
    if (allDeps.vite || await fs.pathExists(path.join(projectPath, 'vite.config.js')) ||
        await fs.pathExists(path.join(projectPath, 'vite.config.ts'))) {
      frameworks.push('vite');
    }

    return frameworks;
  }

  private async detectPackageManager(projectPath: string): Promise<ProjectAnalysis['packageManager']> {
    // Node.js package managers
    if (await fs.pathExists(path.join(projectPath, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }
    if (await fs.pathExists(path.join(projectPath, 'yarn.lock'))) {
      return 'yarn';
    }
    if (await fs.pathExists(path.join(projectPath, 'package-lock.json'))) {
      return 'npm';
    }
    
    // Python package managers
    if (await fs.pathExists(path.join(projectPath, 'poetry.lock'))) {
      return 'poetry';
    }
    if (await fs.pathExists(path.join(projectPath, 'Pipfile.lock'))) {
      return 'pip';
    }
    if (await fs.pathExists(path.join(projectPath, 'requirements.txt'))) {
      return 'pip';
    }
    
    // Rust
    if (await fs.pathExists(path.join(projectPath, 'Cargo.lock'))) {
      return 'cargo';
    }
    
    // Java
    if (await fs.pathExists(path.join(projectPath, 'pom.xml'))) {
      return 'maven';
    }
    if (await fs.pathExists(path.join(projectPath, 'build.gradle'))) {
      return 'gradle';
    }
    
    // C#/.NET
    if (await fs.pathExists(path.join(projectPath, '*.csproj'))) {
      return 'dotnet';
    }
    
    // Go
    if (await fs.pathExists(path.join(projectPath, 'go.mod'))) {
      return 'go';
    }
    
    // PHP
    if (await fs.pathExists(path.join(projectPath, 'composer.lock'))) {
      return 'composer';
    }
    
    // Ruby
    if (await fs.pathExists(path.join(projectPath, 'Gemfile.lock'))) {
      return 'gem';
    }
    
    return 'npm'; // default
  }

  private async findConfigFiles(projectPath: string): Promise<string[]> {
    const configPatterns = [
      '*.config.{js,ts,json}',
      '.*rc',
      '.*rc.{js,ts,json}',
      'tsconfig.json',
      'babel.config.{js,json}',
      '.babelrc',
      'webpack.config.{js,ts}',
      'rollup.config.{js,ts}',
      'jest.config.{js,ts,json}',
      'tailwind.config.{js,ts}',
      'postcss.config.{js,ts}',
      '.env*'
    ];

    const configFiles: string[] = [];

    for (const pattern of configPatterns) {
      try {
        const files = await glob(pattern, { 
          cwd: projectPath,
          ignore: ['node_modules/**', 'dist/**', 'build/**']
        });
        configFiles.push(...files);
      } catch (error) {
        // Continue if pattern fails
      }
    }

    return [...new Set(configFiles)].sort();
  }

  private async analyzeStructure(projectPath: string): Promise<string[]> {
    try {
      const files = await glob('**/*.{js,jsx,ts,tsx,vue}', {
        cwd: projectPath,
        ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**', 'coverage/**']
      });

      // Limit to reasonable number of files for analysis
      return files.slice(0, 100).sort();
    } catch (error) {
      return [];
    }
  }

  async getProjectMetadata(projectPath: string): Promise<{
    name: string;
    version: string;
    description?: string;
    author?: string;
  }> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = await this.readPackageJson(packageJsonPath);
    
    if (!packageJson) {
      return {
        name: path.basename(projectPath),
        version: '0.0.0'
      };
    }

    return {
      name: packageJson.name || path.basename(projectPath),
      version: packageJson.version || '0.0.0',
      description: packageJson.description,
      author: packageJson.author
    };
  }
}