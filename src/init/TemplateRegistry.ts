/**
 * Template Registry - Manages available project templates
 */

import { ProjectTemplate, TemplateRegistry as ITemplateRegistry, ValidationResult } from './types';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

export class TemplateRegistry implements ITemplateRegistry {
  public templates = new Map<string, ProjectTemplate>();
  public categories = new Map<string, ProjectTemplate[]>();

  constructor(private templatesPath: string = path.join(__dirname, '../templates')) {
    // Always load builtin templates first
    this.loadBuiltinTemplates();
    // Then try to load additional templates from filesystem
    this.loadTemplates();
  }

  /**
   * Register a new template
   */
  register(template: ProjectTemplate): void {
    const validation = this.validate(template);
    if (!validation.valid) {
      throw new Error(`Invalid template "${template.id}": ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.templates.set(template.id, template);
    
    // Update category index
    const category = template.category;
    if (!this.categories.has(category)) {
      this.categories.set(category, []);
    }
    
    const categoryTemplates = this.categories.get(category)!;
    const existingIndex = categoryTemplates.findIndex(t => t.id === template.id);
    
    if (existingIndex >= 0) {
      categoryTemplates[existingIndex] = template;
    } else {
      categoryTemplates.push(template);
    }
  }

  /**
   * Get template by ID
   */
  get(id: string): ProjectTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get templates by category
   */
  getByCategory(category: string): ProjectTemplate[] {
    return this.categories.get(category) || [];
  }

  /**
   * List all templates
   */
  list(): ProjectTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Validate template structure
   */
  validate(template: ProjectTemplate): ValidationResult {
    const errors: Array<{code: string, message: string, context?: any}> = [];
    const warnings: Array<{code: string, message: string, context?: any}> = [];

    // Required fields
    if (!template.id) {
      errors.push({ code: 'MISSING_ID', message: 'Template ID is required' });
    }

    if (!template.name) {
      errors.push({ code: 'MISSING_NAME', message: 'Template name is required' });
    }

    if (!template.description) {
      errors.push({ code: 'MISSING_DESCRIPTION', message: 'Template description is required' });
    }

    if (!template.language) {
      errors.push({ code: 'MISSING_LANGUAGE', message: 'Template language is required' });
    }

    // Validate category
    const validCategories = ['frontend', 'backend', 'fullstack', 'mobile', 'desktop'];
    if (!validCategories.includes(template.category)) {
      errors.push({ 
        code: 'INVALID_CATEGORY', 
        message: `Invalid category "${template.category}". Must be one of: ${validCategories.join(', ')}` 
      });
    }

    // Validate package manager
    const validPackageManagers = ['npm', 'yarn', 'pnpm', 'pip', 'poetry', 'pipenv'];
    if (!validPackageManagers.includes(template.packageManager)) {
      errors.push({ 
        code: 'INVALID_PACKAGE_MANAGER', 
        message: `Invalid package manager "${template.packageManager}". Must be one of: ${validPackageManagers.join(', ')}` 
      });
    }

    // Validate structure
    if (!template.structure || !template.structure.directories || !template.structure.files) {
      errors.push({ code: 'INVALID_STRUCTURE', message: 'Template must have structure with directories and files' });
    }

    // Validate features
    if (template.features) {
      template.features.forEach((feature, index) => {
        if (!feature.id || !feature.name || !feature.description) {
          errors.push({ 
            code: 'INVALID_FEATURE', 
            message: `Feature at index ${index} is missing required fields (id, name, description)` 
          });
        }

        // Check for circular dependencies
        if (feature.dependencies && feature.dependencies.includes(feature.id)) {
          errors.push({ 
            code: 'CIRCULAR_DEPENDENCY', 
            message: `Feature "${feature.id}" cannot depend on itself` 
          });
        }

        // Check for conflicts with dependencies
        if (feature.dependencies && feature.conflicts) {
          const conflictingDeps = feature.dependencies.filter(dep => feature.conflicts!.includes(dep));
          if (conflictingDeps.length > 0) {
            errors.push({ 
              code: 'CONFLICTING_DEPENDENCIES', 
              message: `Feature "${feature.id}" has conflicting dependencies: ${conflictingDeps.join(', ')}` 
            });
          }
        }
      });
    }

    // Warnings for best practices
    if (!template.dependencies.runtime || template.dependencies.runtime.length === 0) {
      warnings.push({ 
        code: 'NO_RUNTIME_DEPS', 
        message: 'Template has no runtime dependencies - this might be intentional' 
      });
    }

    if (!template.features || template.features.length === 0) {
      warnings.push({ 
        code: 'NO_FEATURES', 
        message: 'Template has no optional features - consider adding some for flexibility' 
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Load templates from filesystem
   */
  private async loadTemplates(): Promise<void> {
    try {
      if (!await fs.pathExists(this.templatesPath)) {
        console.warn(chalk.yellow(`⚠️ Templates directory not found: ${this.templatesPath}`));
        this.loadBuiltinTemplates();
        return;
      }

      const templateDirs = await fs.readdir(this.templatesPath);
      
      for (const templateDir of templateDirs) {
        const templatePath = path.join(this.templatesPath, templateDir);
        const templateFilePath = path.join(templatePath, 'template.json');
        
        if (await fs.pathExists(templateFilePath)) {
          try {
            const templateData = await fs.readJson(templateFilePath);
            this.register(templateData);
          } catch (error) {
            console.warn(chalk.yellow(`⚠️ Failed to load template from ${templatePath}:`, error));
          }
        }
      }

      // Additional templates loaded successfully

    } catch (error) {
      // Filesystem loading failed, but builtin templates are already loaded
      console.warn(chalk.yellow('⚠️ Failed to load additional templates from filesystem, using builtin templates only'));
    }
  }

  /**
   * Load builtin templates as fallback
   */
  private loadBuiltinTemplates(): void {
    // React/Next.js Template
    const nextjsTemplate: ProjectTemplate = {
      id: 'nextjs',
      name: 'Next.js Application',
      description: 'Modern React application with Next.js, TypeScript, and Tailwind CSS',
      category: 'frontend',
      language: 'TypeScript',
      frameworks: ['React', 'Next.js'],
      packageManager: 'npm',
      structure: {
        directories: [
          { path: 'src' },
          { path: 'src/pages' },
          { path: 'src/components' },
          { path: 'src/styles' },
          { path: 'src/utils' },
          { path: 'public' },
          { path: 'tests', conditional: { feature: 'testing' } }
        ],
        files: [
          { source: 'base/.gitignore', destination: '.gitignore' },
          { source: 'base/README.md.hbs', destination: 'README.md', template: true }
        ],
        templates: [
          { source: 'nextjs/package.json.hbs', destination: 'package.json', variables: {} },
          { source: 'nextjs/tsconfig.json', destination: 'tsconfig.json', variables: {} },
          { source: 'nextjs/next.config.js.hbs', destination: 'next.config.js', variables: {} }
        ]
      },
      dependencies: {
        runtime: ['next', 'react', 'react-dom'],
        development: ['typescript', '@types/react', '@types/node', 'eslint', 'eslint-config-next']
      },
      configuration: {
        'package.json': { template: 'nextjs/package.json.hbs' },
        'tsconfig.json': { template: 'nextjs/tsconfig.json' },
        '.eslintrc.json': { template: 'nextjs/.eslintrc.json' }
      },
      features: [
        {
          id: 'tailwind',
          name: 'Tailwind CSS',
          description: 'Utility-first CSS framework',
          category: 'styling',
          default: true,
          additionalDeps: {
            runtime: [],
            development: ['tailwindcss', 'postcss', 'autoprefixer']
          },
          configurations: [
            {
              file: 'tailwind.config.js',
              operation: 'replace',
              content: { template: 'nextjs/tailwind.config.js.hbs' }
            }
          ]
        },
        {
          id: 'testing',
          name: 'Testing Setup',
          description: 'Jest and React Testing Library configuration',
          category: 'testing',
          default: false,
          additionalDeps: {
            runtime: [],
            development: ['jest', '@testing-library/react', '@testing-library/jest-dom']
          }
        }
      ]
    };

    // Python FastAPI Template
    const fastapiTemplate: ProjectTemplate = {
      id: 'python-fastapi',
      name: 'Python FastAPI',
      description: 'Modern Python API with FastAPI, SQLAlchemy, and async support',
      category: 'backend',
      language: 'Python',
      frameworks: ['FastAPI'],
      packageManager: 'pip',
      structure: {
        directories: [
          { path: 'src' },
          { path: 'src/api' },
          { path: 'src/models' },
          { path: 'src/services' },
          { path: 'src/utils' },
          { path: 'tests' },
          { path: 'docs' },
          { path: 'scripts' }
        ],
        files: [
          { source: 'base/.gitignore', destination: '.gitignore' },
          { source: 'python/.gitignore', destination: '.gitignore' },
          { source: 'base/README.md.hbs', destination: 'README.md', template: true }
        ],
        templates: [
          { source: 'python-fastapi/main.py.hbs', destination: 'src/main.py', variables: {} },
          { source: 'python-fastapi/requirements.txt.hbs', destination: 'requirements.txt', variables: {} },
          { source: 'python-fastapi/pyproject.toml.hbs', destination: 'pyproject.toml', variables: {} }
        ]
      },
      dependencies: {
        runtime: ['fastapi', 'uvicorn[standard]', 'pydantic', 'sqlalchemy'],
        development: ['pytest', 'black', 'ruff', 'mypy']
      },
      configuration: {
        'pyproject.toml': { template: 'python-fastapi/pyproject.toml.hbs' },
        'requirements.txt': { template: 'python-fastapi/requirements.txt.hbs' },
        '.pre-commit-config.yaml': { template: 'python-fastapi/.pre-commit-config.yaml' }
      },
      features: [
        {
          id: 'database',
          name: 'Database Support',
          description: 'SQLAlchemy ORM with async support',
          category: 'database',
          default: true,
          additionalDeps: {
            runtime: ['asyncpg', 'alembic'],
            development: []
          }
        },
        {
          id: 'auth',
          name: 'Authentication',
          description: 'JWT-based authentication system',
          category: 'security',
          default: false,
          dependencies: ['database'],
          additionalDeps: {
            runtime: ['python-jose[cryptography]', 'passlib[bcrypt]', 'python-multipart'],
            development: []
          }
        }
      ]
    };

    this.register(nextjsTemplate);
    this.register(fastapiTemplate);
  }
}