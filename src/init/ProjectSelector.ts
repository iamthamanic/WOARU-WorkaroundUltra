/**
 * Interactive Project Type Selector
 * Handles user interaction for project type and feature selection
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { ProjectTemplate, ProjectConfig, InteractivePrompts, TemplateVariables } from './types';
import { TemplateRegistry } from './TemplateRegistry';
import { t } from '../config/i18n';

export class ProjectSelector implements InteractivePrompts {
  constructor(private registry: TemplateRegistry) {}

  /**
   * Interactive project type selection
   */
  async selectProjectType(): Promise<ProjectTemplate> {
    console.log(chalk.cyan.bold('\n🚀 WOARU Project Initializer'));
    console.log(chalk.gray('═'.repeat(50)));
    console.log(chalk.white('Let\'s set up your new project with best practices!\n'));

    const templates = this.registry.list();
    
    if (templates.length === 0) {
      throw new Error('No project templates available');
    }

    // Group templates by category for better organization
    const categories = this.groupTemplatesByCategory(templates);
    
    // If only one category, skip category selection
    if (categories.length === 1) {
      return this.selectFromTemplates(categories[0].templates);
    }

    // Select category first
    const categoryChoices = categories.map(cat => ({
      name: `${this.getCategoryIcon(cat.name)} ${cat.name} (${cat.templates.length} templates)`,
      value: cat.name,
      short: cat.name
    }));

    const { selectedCategory } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedCategory',
        message: 'What type of project are you building?',
        choices: categoryChoices,
        pageSize: 10
      }
    ]);

    const categoryTemplates = categories.find(cat => cat.name === selectedCategory)?.templates || [];
    return this.selectFromTemplates(categoryTemplates);
  }

  /**
   * Select specific template from a list
   */
  private async selectFromTemplates(templates: ProjectTemplate[]): Promise<ProjectTemplate> {
    const templateChoices = templates.map(template => ({
      name: `${template.name}\n  ${chalk.gray(template.description)}\n  ${chalk.yellow(`Language: ${template.language}`)} ${chalk.blue(`Frameworks: ${template.frameworks.join(', ')}`)}`,
      value: template.id,
      short: template.name
    }));

    const { selectedTemplate } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedTemplate',
        message: 'Choose your project template:',
        choices: templateChoices,
        pageSize: 8
      }
    ]);

    const template = this.registry.get(selectedTemplate);
    if (!template) {
      throw new Error(`Template "${selectedTemplate}" not found`);
    }

    return template;
  }

  /**
   * Interactive feature selection
   */
  async selectFeatures(template: ProjectTemplate): Promise<string[]> {
    if (!template.features || template.features.length === 0) {
      console.log(chalk.yellow('\n📦 No optional features available for this template.'));
      return [];
    }

    console.log(chalk.cyan.bold('\n⚙️  Optional Features'));
    console.log(chalk.gray('Select additional features for your project:\n'));

    // Group features by category
    const featuresByCategory = this.groupFeaturesByCategory(template.features);
    const selectedFeatures: string[] = [];

    // Add default features
    template.features
      .filter(feature => feature.default)
      .forEach(feature => selectedFeatures.push(feature.id));

    // Interactive selection for each category
    for (const [category, features] of featuresByCategory.entries()) {
      if (features.length === 0) continue;

      console.log(chalk.blue.bold(`\n${category.charAt(0).toUpperCase() + category.slice(1)} Features:`));
      
      const choices = features.map(feature => ({
        name: `${feature.name} - ${chalk.gray(feature.description)}`,
        value: feature.id,
        checked: feature.default || false
      }));

      const { categoryFeatures } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'categoryFeatures',
          message: `Select ${category} features:`,
          choices,
          pageSize: 15
        }
      ]);

      // Add selected features (avoiding duplicates)
      categoryFeatures.forEach((featureId: string) => {
        if (!selectedFeatures.includes(featureId)) {
          selectedFeatures.push(featureId);
        }
      });
    }

    // Validate feature dependencies and conflicts
    const validatedFeatures = this.validateFeatureDependencies(template, selectedFeatures);
    
    if (validatedFeatures.length !== selectedFeatures.length) {
      console.log(chalk.yellow('\n⚠️  Some features were adjusted due to dependencies/conflicts.'));
    }

    return validatedFeatures;
  }

  /**
   * Configure project details
   */
  async configureProject(template: ProjectTemplate, features: string[]): Promise<ProjectConfig> {
    console.log(chalk.cyan.bold('\n📋 Project Configuration'));
    console.log(chalk.gray('Configure your project details:\n'));

    const questions = [
      {
        type: 'input',
        name: 'name',
        message: 'Project name:',
        default: 'my-project',
        validate: (input: string) => {
          if (!input.trim()) return 'Project name is required';
          if (!/^[a-zA-Z0-9-_]+$/.test(input)) return 'Project name can only contain letters, numbers, hyphens, and underscores';
          return true;
        }
      },
      {
        type: 'input',
        name: 'description',
        message: 'Project description (optional):',
        default: ''
      },
      {
        type: 'input',
        name: 'author',
        message: 'Author name (optional):',
        default: ''
      }
    ];

    // Add package manager selection if template supports multiple
    if (this.supportsMultiplePackageManagers(template)) {
      const packageManagers = this.getAvailablePackageManagers(template);
      questions.push({
        type: 'list',
        name: 'packageManager',
        message: 'Package manager:',
        choices: packageManagers.map(pm => ({
          name: `${pm} ${this.getPackageManagerDescription(pm)}`,
          value: pm
        })),
        default: template.packageManager
      } as any);
    }

    // Additional configuration questions
    questions.push(
      {
        type: 'input',
        name: 'directory',
        message: 'Target directory:',
        default: (answers: any) => `./${answers.name}`,
        validate: (input: string) => {
          if (!input.trim()) return 'Directory is required';
          return true;
        }
      } as any,
      {
        type: 'confirm',
        name: 'gitInit',
        message: 'Initialize Git repository?',
        default: true
      } as any,
      {
        type: 'confirm',
        name: 'installDeps',
        message: 'Install dependencies after generation?',
        default: true
      } as any
    );

    const answers = await inquirer.prompt(questions);

    // Build template variables
    const variables: TemplateVariables = {
      projectName: answers.name,
      projectDescription: answers.description,
      author: answers.author,
      features: features.reduce((acc, featureId) => {
        acc[featureId] = true;
        return acc;
      }, {} as Record<string, boolean>),
      packageManager: answers.packageManager || template.packageManager,
      year: new Date().getFullYear(),
      date: new Date().toISOString().split('T')[0]
    };

    return {
      name: answers.name,
      description: answers.description,
      author: answers.author,
      template,
      features,
      directory: answers.directory,
      packageManager: answers.packageManager || template.packageManager,
      gitInit: answers.gitInit,
      installDeps: answers.installDeps,
      variables
    };
  }

  /**
   * Confirm generation with summary
   */
  async confirmGeneration(config: ProjectConfig): Promise<boolean> {
    console.log(chalk.cyan.bold('\n📊 Project Summary'));
    console.log(chalk.gray('═'.repeat(50)));
    console.log(chalk.white(`Project Name: ${chalk.green(config.name)}`));
    console.log(chalk.white(`Template: ${chalk.green(config.template.name)}`));
    console.log(chalk.white(`Language: ${chalk.green(config.template.language)}`));
    console.log(chalk.white(`Package Manager: ${chalk.green(config.packageManager)}`));
    console.log(chalk.white(`Directory: ${chalk.green(config.directory)}`));
    
    if (config.features.length > 0) {
      console.log(chalk.white(`Features: ${chalk.green(config.features.join(', '))}`));
    }

    console.log(chalk.white(`Git Init: ${config.gitInit ? chalk.green('Yes') : chalk.red('No')}`));
    console.log(chalk.white(`Install Dependencies: ${config.installDeps ? chalk.green('Yes') : chalk.red('No')}`));

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Generate project with these settings?',
        default: true
      }
    ]);

    return confirm;
  }

  /**
   * Group templates by category
   */
  private groupTemplatesByCategory(templates: ProjectTemplate[]): Array<{name: string, templates: ProjectTemplate[]}> {
    const categories = new Map<string, ProjectTemplate[]>();
    
    templates.forEach(template => {
      const category = template.category;
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(template);
    });

    return Array.from(categories.entries()).map(([name, templates]) => ({ name, templates }));
  }

  /**
   * Group features by category
   */
  private groupFeaturesByCategory(features: any[]): Map<string, any[]> {
    const categories = new Map<string, any[]>();
    
    features.forEach(feature => {
      const category = feature.category || 'general';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(feature);
    });

    return categories;
  }

  /**
   * Validate feature dependencies and resolve conflicts
   */
  private validateFeatureDependencies(template: ProjectTemplate, selectedFeatures: string[]): string[] {
    const validFeatures = new Set<string>(selectedFeatures);
    const featureMap = new Map(template.features.map(f => [f.id, f]));

    // Add required dependencies
    const toAdd = new Set<string>();
    for (const featureId of validFeatures) {
      const feature = featureMap.get(featureId);
      if (feature?.dependencies) {
        feature.dependencies.forEach(dep => {
          if (!validFeatures.has(dep)) {
            toAdd.add(dep);
          }
        });
      }
    }

    toAdd.forEach(featureId => validFeatures.add(featureId));

    // Remove conflicting features
    for (const featureId of Array.from(validFeatures)) {
      const feature = featureMap.get(featureId);
      if (feature?.conflicts) {
        feature.conflicts.forEach(conflict => {
          if (validFeatures.has(conflict)) {
            // Remove the conflicting feature (keep the one that was selected first)
            validFeatures.delete(conflict);
          }
        });
      }
    }

    return Array.from(validFeatures);
  }

  /**
   * Get category icon
   */
  private getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      frontend: '🌐',
      backend: '⚙️',
      fullstack: '🚀',
      mobile: '📱',
      desktop: '🖥️'
    };
    return icons[category] || '📦';
  }

  /**
   * Check if template supports multiple package managers
   */
  private supportsMultiplePackageManagers(template: ProjectTemplate): boolean {
    // For now, only frontend projects support multiple package managers
    return template.category === 'frontend' && template.language === 'TypeScript';
  }

  /**
   * Get available package managers for template
   */
  private getAvailablePackageManagers(template: ProjectTemplate): string[] {
    if (template.language === 'Python') {
      return ['pip', 'poetry', 'pipenv'];
    }
    
    if (template.category === 'frontend') {
      return ['npm', 'yarn', 'pnpm'];
    }

    return [template.packageManager];
  }

  /**
   * Get package manager description
   */
  private getPackageManagerDescription(pm: string): string {
    const descriptions: Record<string, string> = {
      npm: '(Node Package Manager)',
      yarn: '(Fast, reliable, secure)',
      pnpm: '(Fast, disk space efficient)',
      pip: '(Python Package Installer)',
      poetry: '(Python dependency management)',
      pipenv: '(Python dev workflow)'
    };
    return descriptions[pm] || '';
  }
}