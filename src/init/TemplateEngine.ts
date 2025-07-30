/**
 * Template Engine - Processes templates and generates project files
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import chalk from 'chalk';
import { 
  ProjectTemplate, 
  ProjectConfig, 
  GeneratedProject, 
  GeneratedFile, 
  ProjectSummary,
  TemplateVariables,
  ConditionalRule
} from './types';

export class TemplateEngine {
  private handlebars: typeof Handlebars;

  constructor() {
    this.handlebars = Handlebars.create();
    this.registerHelpers();
  }

  /**
   * Process template and generate project
   */
  async processTemplate(config: ProjectConfig): Promise<GeneratedProject> {
    const { template, directory } = config;
    
    console.log(chalk.blue(`🏗️  Generating project: ${config.name}`));
    console.log(chalk.gray(`   Template: ${template.name}`));
    console.log(chalk.gray(`   Directory: ${directory}`));

    // Ensure target directory exists
    await fs.ensureDir(directory);

    // Check if directory is empty
    const existingFiles = await fs.readdir(directory);
    if (existingFiles.length > 0) {
      throw new Error(`Target directory is not empty: ${directory}`);
    }

    const generatedFiles: GeneratedFile[] = [];
    const generatedDirectories: string[] = [];

    // Create directory structure
    console.log(chalk.blue('📁 Creating directory structure...'));
    for (const dirDef of template.structure.directories) {
      if (this.shouldInclude(dirDef.conditional, config)) {
        const dirPath = path.join(directory, dirDef.path);
        await fs.ensureDir(dirPath);
        generatedDirectories.push(dirDef.path);
        console.log(chalk.gray(`   ✓ ${dirDef.path}/`));
      }
    }

    // Copy static files
    console.log(chalk.blue('📄 Copying static files...'));
    for (const fileDef of template.structure.files) {
      if (this.shouldInclude(fileDef.conditional, config)) {
        const content = await this.getStaticFileContent(fileDef.source, template);
        const targetPath = path.join(directory, fileDef.destination);
        
        await fs.writeFile(targetPath, content);
        
        if (fileDef.executable) {
          await fs.chmod(targetPath, '755');
        }

        generatedFiles.push({
          path: fileDef.destination,
          content,
          executable: fileDef.executable
        });
        
        console.log(chalk.gray(`   ✓ ${fileDef.destination}`));
      }
    }

    // Process template files
    console.log(chalk.blue('🎨 Processing templates...'));
    for (const templateRef of template.structure.templates) {
      if (this.shouldInclude(templateRef.conditional, config)) {
        const content = await this.processTemplateFile(
          templateRef.source,
          { ...config.variables, ...templateRef.variables },
          template
        );
        
        const targetPath = path.join(directory, templateRef.destination);
        await fs.writeFile(targetPath, content);

        generatedFiles.push({
          path: templateRef.destination,
          content
        });
        
        console.log(chalk.gray(`   ✓ ${templateRef.destination}`));
      }
    }

    // Generate configuration files
    console.log(chalk.blue('⚙️  Generating configuration files...'));
    for (const [filename, configDef] of Object.entries(template.configuration)) {
      if (this.shouldInclude(configDef.conditional, config)) {
        let content: string;
        
        if (configDef.template) {
          content = await this.processTemplateFile(configDef.template, config.variables, template);
        } else if (configDef.content) {
          content = typeof configDef.content === 'string' 
            ? configDef.content 
            : JSON.stringify(configDef.content, null, 2);
        } else {
          continue;
        }

        const targetPath = path.join(directory, filename);
        await fs.writeFile(targetPath, content);

        generatedFiles.push({
          path: filename,
          content
        });
        
        console.log(chalk.gray(`   ✓ ${filename}`));
      }
    }

    // Process feature-specific configurations
    for (const featureId of config.features) {
      const feature = template.features.find(f => f.id === featureId);
      if (feature?.configurations) {
        console.log(chalk.blue(`🔧 Processing feature: ${feature.name}`));
        
        for (const configPatch of feature.configurations) {
          const targetPath = path.join(directory, configPatch.file);
          
          let content: string;
          if (configPatch.content.template) {
            content = await this.processTemplateFile(configPatch.content.template, config.variables, template);
          } else {
            content = typeof configPatch.content === 'string'
              ? configPatch.content
              : JSON.stringify(configPatch.content, null, 2);
          }

          if (configPatch.operation === 'replace' || !await fs.pathExists(targetPath)) {
            await fs.writeFile(targetPath, content);
          } else if (configPatch.operation === 'append') {
            await fs.appendFile(targetPath, '\n' + content);
          } else if (configPatch.operation === 'merge') {
            // For JSON files, merge the objects
            if (targetPath.endsWith('.json')) {
              const existing = await fs.readJson(targetPath);
              const newContent = JSON.parse(content);
              const merged = { ...existing, ...newContent };
              await fs.writeJson(targetPath, merged, { spaces: 2 });
              content = JSON.stringify(merged, null, 2);
            }
          }

          // Update or add to generated files
          const existingIndex = generatedFiles.findIndex(f => f.path === configPatch.file);
          if (existingIndex >= 0) {
            generatedFiles[existingIndex].content = content;
          } else {
            generatedFiles.push({
              path: configPatch.file,
              content
            });
          }
          
          console.log(chalk.gray(`   ✓ ${configPatch.file} (${configPatch.operation})`));
        }
      }
    }

    // Generate summary
    const summary = this.generateSummary(config, generatedFiles, generatedDirectories);

    console.log(chalk.green(`\n✅ Project generated successfully!`));
    console.log(chalk.gray(`   📁 ${generatedDirectories.length} directories created`));
    console.log(chalk.gray(`   📄 ${generatedFiles.length} files generated`));

    return {
      config,
      files: generatedFiles,
      directories: generatedDirectories,
      summary
    };
  }

  /**
   * Check if a conditional rule should include the item
   */
  private shouldInclude(conditional: ConditionalRule | undefined, config: ProjectConfig): boolean {
    if (!conditional) return true;

    if (conditional.feature) {
      return config.features.includes(conditional.feature);
    }

    if (conditional.features) {
      return conditional.features.some(feature => config.features.includes(feature));
    }

    if (conditional.condition) {
      // Simple condition evaluation - can be extended
      return this.evaluateCondition(conditional.condition, config);
    }

    return true;
  }

  /**
   * Evaluate simple conditions
   */
  private evaluateCondition(condition: string, config: ProjectConfig): boolean {
    // Simple condition parser - can be extended for more complex logic
    const context = {
      packageManager: config.packageManager,
      language: config.template.language,
      category: config.template.category,
      features: config.features
    };

    try {
      // Replace variables in condition
      let evaluableCondition = condition;
      Object.entries(context).forEach(([key, value]) => {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        if (Array.isArray(value)) {
          evaluableCondition = evaluableCondition.replace(regex, JSON.stringify(value));
        } else {
          evaluableCondition = evaluableCondition.replace(regex, `"${value}"`);
        }
      });

      // Basic evaluation - extend as needed
      return eval(evaluableCondition);
    } catch {
      return false;
    }
  }

  /**
   * Get static file content
   */
  private async getStaticFileContent(sourcePath: string, template: ProjectTemplate): Promise<string> {
    // First try to load from template-specific directory
    const templateDir = path.join(__dirname, '../templates', template.id);
    const templateFilePath = path.join(templateDir, sourcePath);
    
    if (await fs.pathExists(templateFilePath)) {
      return fs.readFile(templateFilePath, 'utf8');
    }

    // Fall back to base templates
    const baseFilePath = path.join(__dirname, '../templates/base', sourcePath);
    if (await fs.pathExists(baseFilePath)) {
      return fs.readFile(baseFilePath, 'utf8');
    }

    // Return default content based on file type
    return this.getDefaultFileContent(sourcePath);
  }

  /**
   * Process template file with Handlebars
   */
  private async processTemplateFile(
    sourcePath: string, 
    variables: TemplateVariables, 
    template: ProjectTemplate
  ): Promise<string> {
    const templateContent = await this.getStaticFileContent(sourcePath, template);
    const compiledTemplate = this.handlebars.compile(templateContent);
    return compiledTemplate(variables);
  }

  /**
   * Get default content for common files
   */
  private getDefaultFileContent(sourcePath: string): string {
    const filename = path.basename(sourcePath);
    
    const defaults: Record<string, string> = {
      '.gitignore': `# Dependencies
node_modules/
__pycache__/
*.pyc
.env
.DS_Store
dist/
build/
*.log`,
      
      'README.md': `# {{projectName}}

{{#if projectDescription}}
{{projectDescription}}
{{/if}}

## Getting Started

1. Install dependencies
2. Start development server
3. Open your browser

## Features

{{#each features}}
- {{this}}
{{/each}}`,

      'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "{{projectDescription}}",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "author": "{{author}}",
  "license": "MIT"
}`,

      // Next.js specific templates
      'nextjs/package.json.hbs': `{
  "name": "{{projectName}}",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"{{#if features.tailwind}},
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31"{{/if}}
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "eslint": "^8.0.0",
    "eslint-config-next": "14.0.0"{{#if features.testing}},
    "jest": "^29.0.0",
    "@testing-library/react": "^13.0.0",
    "@testing-library/jest-dom": "^5.0.0"{{/if}}
  }
}`,

      'nextjs/tsconfig.json': `{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`,

      'nextjs/next.config.js.hbs': `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
}

module.exports = nextConfig`,

      'nextjs/.eslintrc.json': `{
  "extends": "next/core-web-vitals"
}`,

      'nextjs/tailwind.config.js.hbs': `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`,

      // Python FastAPI templates
      'python-fastapi/main.py.hbs': `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="{{projectName}}",
    description="{{projectDescription}}",
    version="0.1.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Hello from {{projectName}}!"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)`,

      'python-fastapi/requirements.txt.hbs': `fastapi>=0.104.1
uvicorn[standard]>=0.24.0
pydantic>=2.5.0{{#if features.database}}
sqlalchemy>=2.0.0
asyncpg>=0.29.0
alembic>=1.13.0{{/if}}{{#if features.auth}}
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
python-multipart>=0.0.6{{/if}}
python-dotenv>=1.0.0`,

      'python-fastapi/pyproject.toml.hbs': `[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "{{projectName}}"
dynamic = ["version"]
description = "{{projectDescription}}"
readme = "README.md"
license = "MIT"
authors = [
    { name = "{{author}}", email = "{{email}}" },
]

[tool.black]
line-length = 88
target-version = ['py311']

[tool.ruff]
line-length = 88
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "B"]

[tool.mypy]
python_version = "3.11"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true`,

      'python-fastapi/.pre-commit-config.yaml': `repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files

  - repo: https://github.com/psf/black
    rev: 23.11.0
    hooks:
      - id: black

  - repo: https://github.com/charliermarsh/ruff-pre-commit
    rev: v0.1.6
    hooks:
      - id: ruff
        args: [--fix]

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.7.1
    hooks:
      - id: mypy`
    };

    return defaults[sourcePath] || defaults[filename] || `# ${filename}\n\n# Generated by WOARU`;
  }

  /**
   * Register Handlebars helpers
   */
  private registerHelpers(): void {
    // Conditional helper
    this.handlebars.registerHelper('if_eq', function(this: any, a: any, b: any, options: any) {
      if (a === b) {
        return options.fn(this);
      } else {
        return options.inverse(this);
      }
    });

    // Array includes helper
    this.handlebars.registerHelper('includes', function(this: any, array: any, item: any, options: any) {
      if (Array.isArray(array) && array.includes(item)) {
        return options.fn(this);
      } else {
        return options.inverse(this);
      }
    });

    // JSON stringify helper
    this.handlebars.registerHelper('json', function(context) {
      return JSON.stringify(context, null, 2);
    });

    // Capitalize helper
    this.handlebars.registerHelper('capitalize', function(str) {
      return typeof str === 'string' ? str.charAt(0).toUpperCase() + str.slice(1) : str;
    });

    // Kebab case helper
    this.handlebars.registerHelper('kebab', function(str) {
      return typeof str === 'string' ? str.toLowerCase().replace(/\s+/g, '-') : str;
    });
  }

  /**
   * Generate project summary
   */
  private generateSummary(
    config: ProjectConfig, 
    files: GeneratedFile[], 
    directories: string[]
  ): ProjectSummary {
    const template = config.template;
    
    // Count dependencies
    let runtimeDeps = template.dependencies.runtime.length;
    let devDeps = template.dependencies.development.length;

    // Add feature dependencies
    config.features.forEach(featureId => {
      const feature = template.features.find(f => f.id === featureId);
      if (feature?.additionalDeps) {
        runtimeDeps += feature.additionalDeps.runtime?.length || 0;
        devDeps += feature.additionalDeps.development?.length || 0;
      }
    });

    // Generate next steps
    const nextSteps: string[] = [
      `cd ${config.directory}`,
    ];

    if (config.installDeps) {
      const installCmd = config.packageManager === 'yarn' ? 'yarn install' :
                        config.packageManager === 'pnpm' ? 'pnpm install' :
                        config.packageManager === 'pip' ? 'pip install -r requirements.txt' :
                        config.packageManager === 'poetry' ? 'poetry install' :
                        'npm install';
      nextSteps.push(installCmd);
    }

    // Add framework-specific commands
    if (template.id === 'nextjs') {
      nextSteps.push('npm run dev');
      nextSteps.push('Open http://localhost:3000');
    } else if (template.id === 'python-fastapi') {
      nextSteps.push('uvicorn src.main:app --reload');
      nextSteps.push('Open http://localhost:8000');
    }

    return {
      totalFiles: files.length,
      totalDirectories: directories.length,
      dependencies: {
        runtime: runtimeDeps,
        development: devDeps
      },
      features: config.features,
      nextSteps
    };
  }
}