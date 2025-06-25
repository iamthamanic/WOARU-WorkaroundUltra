import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';

export interface LanguageInfo {
  name: string;
  extensions: string[];
  configFiles: string[];
  packageManagers: string[];
  buildFiles: string[];
  frameworks: string[];
}

export class LanguageDetector {
  private languages: Map<string, LanguageInfo> = new Map([
    ['javascript', {
      name: 'JavaScript/TypeScript',
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
      configFiles: ['package.json', 'tsconfig.json', '.eslintrc.json', '.prettierrc'],
      packageManagers: ['npm', 'yarn', 'pnpm'],
      buildFiles: ['webpack.config.js', 'rollup.config.js', 'vite.config.js'],
      frameworks: ['react', 'vue', 'angular', 'nextjs', 'nuxt', 'express', 'nestjs']
    }],
    ['python', {
      name: 'Python',
      extensions: ['.py', '.pyw', '.pyx'],
      configFiles: ['setup.py', 'pyproject.toml', 'requirements.txt', 'Pipfile', '.flake8', '.pylintrc'],
      packageManagers: ['pip', 'poetry', 'pipenv', 'conda'],
      buildFiles: ['setup.cfg', 'MANIFEST.in'],
      frameworks: ['django', 'flask', 'fastapi', 'pytest', 'pandas', 'numpy']
    }],
    ['csharp', {
      name: 'C#',
      extensions: ['.cs', '.csx'],
      configFiles: ['*.csproj', '*.sln', 'global.json', '.editorconfig'],
      packageManagers: ['nuget', 'dotnet'],
      buildFiles: ['*.csproj', '*.sln'],
      frameworks: ['dotnet', 'aspnet', 'unity', 'xamarin', 'blazor']
    }],
    ['java', {
      name: 'Java',
      extensions: ['.java', '.jar'],
      configFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts', '.classpath'],
      packageManagers: ['maven', 'gradle'],
      buildFiles: ['pom.xml', 'build.gradle', 'settings.gradle'],
      frameworks: ['spring', 'springboot', 'junit', 'hibernate']
    }],
    ['go', {
      name: 'Go',
      extensions: ['.go'],
      configFiles: ['go.mod', 'go.sum'],
      packageManagers: ['go'],
      buildFiles: ['Makefile', 'Dockerfile'],
      frameworks: ['gin', 'echo', 'fiber', 'beego']
    }],
    ['rust', {
      name: 'Rust',
      extensions: ['.rs'],
      configFiles: ['Cargo.toml', 'Cargo.lock'],
      packageManagers: ['cargo'],
      buildFiles: ['Cargo.toml'],
      frameworks: ['actix', 'rocket', 'tokio', 'serde']
    }],
    ['php', {
      name: 'PHP',
      extensions: ['.php', '.phtml'],
      configFiles: ['composer.json', 'composer.lock', '.php-cs-fixer.php'],
      packageManagers: ['composer'],
      buildFiles: ['composer.json'],
      frameworks: ['laravel', 'symfony', 'wordpress', 'drupal']
    }],
    ['ruby', {
      name: 'Ruby',
      extensions: ['.rb', '.erb'],
      configFiles: ['Gemfile', 'Gemfile.lock', '.rubocop.yml'],
      packageManagers: ['gem', 'bundler'],
      buildFiles: ['Rakefile'],
      frameworks: ['rails', 'sinatra', 'rspec']
    }]
  ]);

  async detectLanguages(projectPath: string): Promise<string[]> {
    const detectedLanguages: Set<string> = new Set();
    
    // Check for config files
    for (const [lang, info] of this.languages) {
      for (const configFile of info.configFiles) {
        const files = await glob(configFile, { 
          cwd: projectPath,
          ignore: ['node_modules/**', '**/node_modules/**']
        });
        
        if (files.length > 0) {
          detectedLanguages.add(lang);
          break;
        }
      }
    }

    // Check for file extensions
    const allFiles = await glob('**/*', {
      cwd: projectPath,
      ignore: ['node_modules/**', '**/node_modules/**', '.git/**', 'dist/**', 'build/**'],
      nodir: true
    });

    for (const file of allFiles) {
      const ext = path.extname(file).toLowerCase();
      
      for (const [lang, info] of this.languages) {
        if (info.extensions.includes(ext)) {
          detectedLanguages.add(lang);
        }
      }
    }

    return Array.from(detectedLanguages);
  }

  async detectPrimaryLanguage(projectPath: string): Promise<string> {
    const languages = await this.detectLanguages(projectPath);
    
    if (languages.length === 0) {
      return 'unknown';
    }

    // If only one language, return it
    if (languages.length === 1) {
      return languages[0];
    }

    // For multi-language projects, use file count and config file priority
    const languageScores = new Map<string, number>();
    
    // Count files for each language
    const allFiles = await glob('**/*', {
      cwd: projectPath,
      ignore: ['node_modules/**', '**/node_modules/**', '.git/**', 'dist/**', 'build/**'],
      nodir: true
    });

    for (const [lang, info] of this.languages) {
      let score = 0;
      
      // Score based on file count
      const fileCount = allFiles.filter(file => 
        info.extensions.some(ext => file.toLowerCase().endsWith(ext))
      ).length;
      score += fileCount * 10;
      
      // Score based on config files (higher weight)
      for (const configFile of info.configFiles) {
        const configExists = await glob(configFile, { 
          cwd: projectPath,
          ignore: ['node_modules/**', '**/node_modules/**']
        });
        if (configExists.length > 0) {
          score += 100; // High weight for config files
        }
      }
      
      // Special handling for examples/test directories (lower weight)
      const mainFiles = allFiles.filter(file => 
        info.extensions.some(ext => file.toLowerCase().endsWith(ext)) &&
        !file.includes('example') &&
        !file.includes('test') &&
        !file.includes('demo') &&
        !file.includes('sample')
      ).length;
      score += mainFiles * 20; // Higher weight for main files
      
      languageScores.set(lang, score);
    }

    // Return language with highest score
    let maxScore = 0;
    let primaryLanguage = 'unknown';
    
    for (const [lang, score] of languageScores) {
      if (languages.includes(lang) && score > maxScore) {
        maxScore = score;
        primaryLanguage = lang;
      }
    }

    return primaryLanguage !== 'unknown' ? primaryLanguage : languages[0];
  }

  getLanguageInfo(language: string): LanguageInfo | undefined {
    return this.languages.get(language);
  }

  async detectFrameworks(projectPath: string, language: string): Promise<string[]> {
    const detectedFrameworks: string[] = [];
    const languageInfo = this.getLanguageInfo(language);
    
    if (!languageInfo) return [];

    // Language-specific framework detection
    switch (language) {
      case 'javascript':
        const packageJsonPath = path.join(projectPath, 'package.json');
        if (await fs.pathExists(packageJsonPath)) {
          const packageJson = await fs.readJson(packageJsonPath);
          const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
          
          if (deps.next) detectedFrameworks.push('nextjs');
          if (deps.react) detectedFrameworks.push('react');
          if (deps.vue) detectedFrameworks.push('vue');
          if (deps.express) detectedFrameworks.push('express');
          if (deps['@angular/core']) detectedFrameworks.push('angular');
          if (deps['@nestjs/core']) detectedFrameworks.push('nestjs');
        }
        break;

      case 'python':
        // Check requirements.txt
        const requirementsPath = path.join(projectPath, 'requirements.txt');
        if (await fs.pathExists(requirementsPath)) {
          const requirements = await fs.readFile(requirementsPath, 'utf-8');
          if (requirements.includes('django')) detectedFrameworks.push('django');
          if (requirements.includes('flask')) detectedFrameworks.push('flask');
          if (requirements.includes('fastapi')) detectedFrameworks.push('fastapi');
          if (requirements.includes('pytest')) detectedFrameworks.push('pytest');
        }
        
        // Check pyproject.toml
        const pyprojectPath = path.join(projectPath, 'pyproject.toml');
        if (await fs.pathExists(pyprojectPath)) {
          const content = await fs.readFile(pyprojectPath, 'utf-8');
          if (content.includes('django')) detectedFrameworks.push('django');
          if (content.includes('flask')) detectedFrameworks.push('flask');
          if (content.includes('fastapi')) detectedFrameworks.push('fastapi');
        }
        break;

      case 'csharp':
        const csprojFiles = await glob('**/*.csproj', { cwd: projectPath });
        for (const file of csprojFiles) {
          const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
          if (content.includes('Microsoft.AspNetCore')) detectedFrameworks.push('aspnet');
          if (content.includes('Microsoft.NET.Sdk.Web')) detectedFrameworks.push('dotnet');
          if (content.includes('Unity')) detectedFrameworks.push('unity');
        }
        break;

      case 'java':
        const pomPath = path.join(projectPath, 'pom.xml');
        if (await fs.pathExists(pomPath)) {
          const content = await fs.readFile(pomPath, 'utf-8');
          if (content.includes('spring-boot')) detectedFrameworks.push('springboot');
          if (content.includes('springframework')) detectedFrameworks.push('spring');
          if (content.includes('junit')) detectedFrameworks.push('junit');
        }
        break;
    }

    return detectedFrameworks;
  }
}