import fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import { ProjectAnalysis } from '../types';
import { LanguageDetector } from './LanguageDetector';

/**
 * ProjectAnalyzer - Comprehensive project analysis for code structure, dependencies, and frameworks
 *
 * The ProjectAnalyzer class provides deep insights into project structure, language detection,
 * dependency analysis, and framework identification across multiple programming languages.
 * It serves as the foundation for WOARU's intelligent project understanding and tool recommendations.
 *
 * @example
 * ```typescript
 * const analyzer = new ProjectAnalyzer();
 * const analysis = await analyzer.analyzeProject('./my-project');
 * console.log(`Primary language: ${analysis.language}`);
 * console.log(`Frameworks: ${analysis.framework.join(', ')}`);
 * console.log(`Dependencies: ${analysis.dependencies.length}`);
 * ```
 *
 * @since 1.0.0
 */
export class ProjectAnalyzer {
  /** Language detection engine for multi-language project support */
  private languageDetector: LanguageDetector;

  /**
   * Creates a new ProjectAnalyzer instance with language detection capabilities
   *
   * @example
   * ```typescript
   * const analyzer = new ProjectAnalyzer();
   * ```
   */
  constructor() {
    this.languageDetector = new LanguageDetector();
  }
  /**
   * Performs comprehensive analysis of a project directory
   *
   * Analyzes the project structure, detects programming languages and frameworks,
   * extracts dependencies and development dependencies, identifies package managers,
   * and catalogs configuration files for intelligent tool recommendations.
   *
   * @param projectPath - Absolute path to the project directory to analyze
   * @returns Promise resolving to comprehensive project analysis results
   *
   * @throws {Error} When project language cannot be detected or path is invalid
   *
   * @example
   * ```typescript
   * const analyzer = new ProjectAnalyzer();
   *
   * // Analyze a TypeScript project
   * const analysis = await analyzer.analyzeProject('/path/to/typescript-project');
   * console.log(`Language: ${analysis.language}`); // "TypeScript"
   * console.log(`Frameworks: ${analysis.framework}`); // ["react", "nextjs"]
   * console.log(`Package Manager: ${analysis.packageManager}`); // "npm"
   *
   * // Analyze a Python project
   * const pyAnalysis = await analyzer.analyzeProject('/path/to/python-project');
   * console.log(`Dependencies: ${pyAnalysis.dependencies.length}`);
   * ```
   */
  async analyzeProject(projectPath: string): Promise<ProjectAnalysis> {
    // Detect primary language first
    const primaryLanguage =
      await this.languageDetector.detectPrimaryLanguage(projectPath);
    const allLanguages =
      await this.languageDetector.detectLanguages(projectPath);

    if (primaryLanguage === 'unknown') {
      throw new Error(
        'Could not detect project language. Make sure you are in a valid project directory.'
      );
    }

    // Get language-specific dependencies
    const dependencies = await this.getDependencies(
      projectPath,
      primaryLanguage
    );
    const devDependencies = await this.getDevDependencies(
      projectPath,
      primaryLanguage
    );
    const scripts = await this.getScripts(projectPath, primaryLanguage);

    // Detect frameworks based on language
    const frameworks = await this.languageDetector.detectFrameworks(
      projectPath,
      primaryLanguage
    );

    const analysis: ProjectAnalysis = {
      language:
        primaryLanguage === 'javascript'
          ? await this.detectLanguage(projectPath)
          : this.languageDetector.getLanguageInfo(primaryLanguage)?.name ||
            primaryLanguage,
      framework: frameworks,
      packageManager: await this.detectPackageManager(projectPath),
      dependencies,
      devDependencies,
      scripts,
      configFiles: await this.findConfigFiles(projectPath),
      structure: await this.analyzeStructure(projectPath),
      detectedLanguages: allLanguages,
    };

    return analysis;
  }

  private async readPackageJson(
    packageJsonPath: string
  ): Promise<Record<string, unknown> | null> {
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
      ignore: ['node_modules/**', 'dist/**', 'build/**'],
    });

    return tsFiles.length > 0 ? 'TypeScript' : 'JavaScript';
  }

  private async detectFrameworks(
    projectPath: string,
    packageJson: Record<string, unknown>
  ): Promise<string[]> {
    const frameworks: string[] = [];
    const allDeps = {
      ...((packageJson.dependencies as Record<string, unknown>) || {}),
      ...((packageJson.devDependencies as Record<string, unknown>) || {}),
    };

    // Next.js
    if (
      allDeps.next ||
      (await fs.pathExists(path.join(projectPath, 'next.config.js'))) ||
      (await fs.pathExists(path.join(projectPath, 'next.config.ts')))
    ) {
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
    if (
      allDeps.vite ||
      (await fs.pathExists(path.join(projectPath, 'vite.config.js'))) ||
      (await fs.pathExists(path.join(projectPath, 'vite.config.ts')))
    ) {
      frameworks.push('vite');
    }

    return frameworks;
  }

  private async detectPackageManager(
    projectPath: string
  ): Promise<ProjectAnalysis['packageManager']> {
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
    if (
      (await fs.pathExists(path.join(projectPath, 'Cargo.lock'))) ||
      (await fs.pathExists(path.join(projectPath, 'Cargo.toml')))
    ) {
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
    const csprojFiles = await glob('*.csproj', { cwd: projectPath });
    if (csprojFiles.length > 0) {
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
      '.env*',
    ];

    const configFiles: string[] = [];

    for (const pattern of configPatterns) {
      try {
        const files = await glob(pattern, {
          cwd: projectPath,
          ignore: ['node_modules/**', 'dist/**', 'build/**'],
        });
        configFiles.push(...files);
      } catch {
        // Continue if pattern fails
      }
    }

    return [...new Set(configFiles)].sort();
  }

  private async getDependencies(
    projectPath: string,
    language: string
  ): Promise<string[]> {
    switch (language) {
      case 'javascript': {
        const packageJson = await this.readPackageJson(
          path.join(projectPath, 'package.json')
        );
        return packageJson ? Object.keys(packageJson.dependencies || {}) : [];
      }

      case 'python': {
        return await this.getPythonDependencies(projectPath);
      }

      case 'csharp': {
        return await this.getCSharpDependencies(projectPath);
      }

      default:
        return [];
    }
  }

  private async getDevDependencies(
    projectPath: string,
    language: string
  ): Promise<string[]> {
    switch (language) {
      case 'javascript': {
        const packageJson = await this.readPackageJson(
          path.join(projectPath, 'package.json')
        );
        return packageJson
          ? Object.keys(packageJson.devDependencies || {})
          : [];
      }

      case 'python': {
        // Python doesn't really have dev dependencies in the same way
        // But we can check for test/dev packages
        return await this.getPythonDevDependencies(projectPath);
      }

      default:
        return [];
    }
  }

  private async getScripts(
    projectPath: string,
    language: string
  ): Promise<Record<string, string>> {
    switch (language) {
      case 'javascript': {
        const packageJson = await this.readPackageJson(
          path.join(projectPath, 'package.json')
        );
        return packageJson
          ? (packageJson.scripts as Record<string, string>) || {}
          : {};
      }

      case 'python': {
        return await this.getPythonScripts(projectPath);
      }

      default:
        return {};
    }
  }

  private async getPythonDependencies(projectPath: string): Promise<string[]> {
    const dependencies: string[] = [];

    // Check requirements.txt
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    if (await fs.pathExists(requirementsPath)) {
      const content = await fs.readFile(requirementsPath, 'utf-8');
      const lines = content
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#'));
      dependencies.push(
        ...lines.map(line =>
          line.split('==')[0].split('>=')[0].split('~=')[0].trim()
        )
      );
    }

    // Check pyproject.toml
    const pyprojectPath = path.join(projectPath, 'pyproject.toml');
    if (await fs.pathExists(pyprojectPath)) {
      const content = await fs.readFile(pyprojectPath, 'utf-8');
      // Simple regex to extract dependencies - would need proper TOML parser for production
      const depMatches = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
      if (depMatches) {
        const depLines = depMatches[1].split(',');
        dependencies.push(
          ...depLines
            .map(line =>
              line.replace(/['"]/g, '').split('==')[0].split('>=')[0].trim()
            )
            .filter(dep => dep)
        );
      }
    }

    return [...new Set(dependencies)];
  }

  private async getPythonDevDependencies(
    projectPath: string
  ): Promise<string[]> {
    const devDeps: string[] = [];

    // Check for common dev/test packages
    const allDeps = await this.getPythonDependencies(projectPath);
    const devPackages = [
      'pytest',
      'black',
      'flake8',
      'mypy',
      'ruff',
      'pre-commit',
      'isort',
    ];

    devDeps.push(
      ...allDeps.filter(dep =>
        devPackages.some(devPkg => dep.toLowerCase().includes(devPkg))
      )
    );

    return devDeps;
  }

  private async getPythonScripts(
    projectPath: string
  ): Promise<Record<string, string>> {
    const scripts: Record<string, string> = {};

    // Check pyproject.toml for scripts
    const pyprojectPath = path.join(projectPath, 'pyproject.toml');
    if (await fs.pathExists(pyprojectPath)) {
      const content = await fs.readFile(pyprojectPath, 'utf-8');
      // Look for common script patterns
      if (content.includes('pytest')) scripts.test = 'pytest';
      if (content.includes('black')) scripts.format = 'black .';
      if (content.includes('ruff')) scripts.lint = 'ruff check .';
    }

    // Check for common Python patterns
    if (await fs.pathExists(path.join(projectPath, 'manage.py'))) {
      scripts.runserver = 'python manage.py runserver';
      scripts.migrate = 'python manage.py migrate';
    }

    return scripts;
  }

  private async getCSharpDependencies(projectPath: string): Promise<string[]> {
    const dependencies: string[] = [];

    // Check .csproj files
    const csprojFiles = await glob('**/*.csproj', { cwd: projectPath });

    for (const file of csprojFiles) {
      try {
        const content = await fs.readFile(
          path.join(projectPath, file),
          'utf-8'
        );
        // Simple regex to extract PackageReference - would need proper XML parser
        const packageMatches = content.match(
          /<PackageReference\s+Include="([^"]+)"/g
        );
        if (packageMatches) {
          dependencies.push(
            ...packageMatches
              .map(match => match.match(/Include="([^"]+)"/)?.[1] || '')
              .filter(pkg => pkg)
          );
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return [...new Set(dependencies)];
  }

  private async analyzeStructure(projectPath: string): Promise<string[]> {
    try {
      const files = await glob('**/*.{js,jsx,ts,tsx,vue}', {
        cwd: projectPath,
        ignore: [
          'node_modules/**',
          'dist/**',
          'build/**',
          '.next/**',
          'coverage/**',
        ],
      });

      // Limit to reasonable number of files for analysis
      return files.slice(0, 100).sort();
    } catch {
      return [];
    }
  }

  /**
   * Extracts project metadata from package.json or infers from directory structure
   *
   * Reads and parses package.json to extract project name, version, description,
   * and author information. Falls back to directory-based inference if package.json
   * is not available or cannot be parsed.
   *
   * @param projectPath - Absolute path to the project directory
   * @returns Promise resolving to project metadata object
   *
   * @example
   * ```typescript
   * const analyzer = new ProjectAnalyzer();
   * const metadata = await analyzer.getProjectMetadata('./my-project');
   *
   * console.log(metadata.name);        // "my-awesome-app"
   * console.log(metadata.version);     // "1.2.3"
   * console.log(metadata.description); // "An awesome application"
   * console.log(metadata.author);      // "John Doe <john@example.com>"
   *
   * // For projects without package.json
   * const metadata2 = await analyzer.getProjectMetadata('./python-project');
   * console.log(metadata2.name);    // "python-project" (directory name)
   * console.log(metadata2.version); // "0.0.0" (default)
   * ```
   */
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
        version: '0.0.0',
      };
    }

    return {
      name: (packageJson.name as string) || path.basename(projectPath),
      version: (packageJson.version as string) || '0.0.0',
      description: packageJson.description as string | undefined,
      author: packageJson.author as string | undefined,
    };
  }
}
