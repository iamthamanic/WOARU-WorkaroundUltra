/**
 * WOARU Init Command - Interactive Project Scaffolding
 * Implements the main init command with full project generation capabilities
 */

import chalk from 'chalk';
import * as path from 'path';
import { spawn } from 'child_process';
import { ProjectConfig, InitOptions, GeneratedProject } from './types';
import { TemplateRegistry } from './TemplateRegistry';
import { ProjectSelector } from './ProjectSelector';
import { TemplateEngine } from './TemplateEngine';

export class InitCommand {
  private registry: TemplateRegistry;
  private selector: ProjectSelector;
  private engine: TemplateEngine;

  constructor() {
    this.registry = new TemplateRegistry();
    this.selector = new ProjectSelector(this.registry);
    this.engine = new TemplateEngine();
  }

  /**
   * Execute the init command
   */
  async execute(options: InitOptions = {}): Promise<void> {
    try {
      console.log(chalk.cyan.bold('🚀 WOARU Project Initializer'));
      console.log(
        chalk.gray('Creating your project with best practices...\\n')
      );

      let config: ProjectConfig;

      if (options.interactive === false) {
        // Non-interactive mode
        config = await this.createConfigFromOptions(options);
      } else {
        // Interactive mode (default)
        config = await this.runInteractiveFlow(options);
      }

      // Dry run mode - show what would be generated
      if (options.dryRun) {
        await this.showDryRun(config);
        return;
      }

      // Generate the project
      const generatedProject = await this.engine.processTemplate(config);

      // Post-generation steps
      await this.runPostGenerationSteps(config, generatedProject);

      // Show success message and next steps
      this.showSuccessMessage(config, generatedProject);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Run interactive project creation flow
   */
  private async runInteractiveFlow(
    options: InitOptions
  ): Promise<ProjectConfig> {
    // Step 1: Select project template
    const template = options.template
      ? this.registry.get(options.template)
      : await this.selector.selectProjectType();

    if (!template) {
      throw new Error(`Template "${options.template}" not found`);
    }

    // Step 2: Select features
    const features = options.features
      ? options.features.split(',').map(f => f.trim())
      : await this.selector.selectFeatures(template);

    // Step 3: Configure project
    const config = await this.selector.configureProject(template, features);

    // Override with command line options
    if (options.directory) {
      config.directory = options.directory;
    }

    if (options.skipInstall) {
      config.installDeps = false;
    }

    // Step 4: Confirm generation
    const confirmed = await this.selector.confirmGeneration(config);
    if (!confirmed) {
      console.log(chalk.yellow('\\n❌ Project generation cancelled.'));
      process.exit(0);
    }

    return config;
  }

  /**
   * Create config from command line options (non-interactive)
   */
  private async createConfigFromOptions(
    options: InitOptions
  ): Promise<ProjectConfig> {
    if (!options.template) {
      throw new Error(
        'Template is required in non-interactive mode. Use --template option.'
      );
    }

    const template = this.registry.get(options.template);
    if (!template) {
      throw new Error(`Template "${options.template}" not found`);
    }

    const features = options.features
      ? options.features.split(',').map(f => f.trim())
      : [];
    const projectName = path.basename(options.directory || 'my-project');

    return {
      name: projectName,
      template,
      features,
      directory: options.directory || `./${projectName}`,
      packageManager: template.packageManager,
      gitInit: true,
      installDeps: !options.skipInstall,
      variables: {
        projectName,
        features: features.reduce((acc, f) => ({ ...acc, [f]: true }), {}),
        packageManager: template.packageManager,
        year: new Date().getFullYear(),
        date: new Date().toISOString().split('T')[0],
      },
    };
  }

  /**
   * Show dry run output
   */
  private async showDryRun(config: ProjectConfig): Promise<void> {
    console.log(chalk.cyan.bold('\\n🔍 Dry Run Mode - Preview'));
    console.log(chalk.gray('═'.repeat(50)));

    console.log(chalk.white(`Project: ${chalk.green(config.name)}`));
    console.log(chalk.white(`Template: ${chalk.green(config.template.name)}`));
    console.log(chalk.white(`Directory: ${chalk.green(config.directory)}`));
    console.log(
      chalk.white(
        `Features: ${chalk.green(config.features.join(', ') || 'None')}`
      )
    );

    console.log(chalk.cyan('\\n📁 Directories to create:'));
    config.template.structure.directories.forEach(dir => {
      console.log(chalk.gray(`   ${dir.path}/`));
    });

    console.log(chalk.cyan('\\n📄 Files to generate:'));
    config.template.structure.files.forEach(file => {
      console.log(chalk.gray(`   ${file.destination}`));
    });

    config.template.structure.templates.forEach(template => {
      console.log(chalk.gray(`   ${template.destination} (from template)`));
    });

    Object.keys(config.template.configuration).forEach(filename => {
      console.log(chalk.gray(`   ${filename} (configuration)`));
    });

    console.log(
      chalk.yellow('\\n💡 Run without --dry-run to generate the project.')
    );
  }

  /**
   * Run post-generation steps
   */
  private async runPostGenerationSteps(
    config: ProjectConfig,
    _project: GeneratedProject
  ): Promise<void> {
    const { directory } = config;

    // Initialize Git repository
    if (config.gitInit) {
      console.log(chalk.blue('\\n📊 Initializing Git repository...'));
      try {
        await this.runCommand('git', ['init'], directory);
        await this.runCommand('git', ['add', '.'], directory);
        await this.runCommand(
          'git',
          ['commit', '-m', 'Initial commit from WOARU'],
          directory
        );
        console.log(chalk.green('   ✓ Git repository initialized'));
      } catch {
        console.log(chalk.yellow('   ⚠️ Failed to initialize Git repository'));
      }
    }

    // Install dependencies
    if (config.installDeps) {
      console.log(chalk.blue('\\n📦 Installing dependencies...'));
      try {
        const installCmd = this.getInstallCommand(config.packageManager);
        await this.runCommand(installCmd.command, installCmd.args, directory);
        console.log(chalk.green('   ✓ Dependencies installed successfully'));
      } catch {
        console.log(chalk.yellow('   ⚠️ Failed to install dependencies'));
        console.log(
          chalk.gray(
            `   Run "${this.getInstallCommand(config.packageManager).command} ${this.getInstallCommand(config.packageManager).args.join(' ')}" manually`
          )
        );
      }
    }
  }

  /**
   * Get install command for package manager
   */
  private getInstallCommand(packageManager: string): {
    command: string;
    args: string[];
  } {
    const commands = {
      npm: { command: 'npm', args: ['install'] },
      yarn: { command: 'yarn', args: ['install'] },
      pnpm: { command: 'pnpm', args: ['install'] },
      pip: { command: 'pip', args: ['install', '-r', 'requirements.txt'] },
      poetry: { command: 'poetry', args: ['install'] },
      pipenv: { command: 'pipenv', args: ['install'] },
    };

    return commands[packageManager as keyof typeof commands] || commands.npm;
  }

  /**
   * Run shell command
   */
  private runCommand(
    command: string,
    args: string[],
    cwd: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        cwd,
        stdio: 'pipe',
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', data => {
        stdout += data.toString();
      });

      process.stderr?.on('data', data => {
        stderr += data.toString();
      });

      process.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(`Command failed with code ${code}: ${stderr || stdout}`)
          );
        }
      });

      process.on('error', error => {
        reject(error);
      });
    });
  }

  /**
   * Show success message and next steps
   */
  private showSuccessMessage(
    config: ProjectConfig,
    project: GeneratedProject
  ): void {
    console.log(chalk.green.bold('\\n🎉 Project created successfully!'));
    console.log(chalk.gray('═'.repeat(50)));

    console.log(chalk.white(`📁 Location: ${chalk.cyan(config.directory)}`));
    console.log(
      chalk.white(`📄 Files: ${chalk.cyan(project.files.length.toString())}`)
    );
    console.log(
      chalk.white(
        `📂 Directories: ${chalk.cyan(project.directories.length.toString())}`
      )
    );

    if (project.summary.features.length > 0) {
      console.log(
        chalk.white(
          `⚙️  Features: ${chalk.cyan(project.summary.features.join(', '))}`
        )
      );
    }

    console.log(chalk.cyan.bold('\\n🚀 Next Steps:'));
    project.summary.nextSteps.forEach((step, index) => {
      console.log(chalk.white(`${index + 1}. ${chalk.gray(step)}`));
    });

    console.log(chalk.cyan('\\n💡 Additional Commands:'));
    console.log(chalk.gray('   woaru analyze    - Analyze your project'));
    console.log(chalk.gray('   woaru audit      - Run security audit'));
    console.log(
      chalk.gray('   woaru setup      - Configure development tools')
    );

    console.log(chalk.green('\\n✨ Happy coding!'));
  }

  /**
   * Handle errors gracefully
   */
  private handleError(
    error: Error | { code?: string; message?: string }
  ): void {
    console.error(chalk.red.bold('\\n❌ Error creating project:'));

    if ('code' in error && error.code === 'ENOENT') {
      console.error(chalk.red('   Directory or file not found'));
    } else if ('code' in error && error.code === 'EACCES') {
      console.error(chalk.red('   Permission denied'));
    } else if (error.message) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   Unknown error occurred'));
    }

    console.error(chalk.gray('\\n💡 Troubleshooting:'));
    console.error(
      chalk.gray('   • Check that the target directory exists and is writable')
    );
    console.error(chalk.gray('   • Ensure you have the necessary permissions'));
    console.error(
      chalk.gray('   • Try running with --dry-run to preview changes')
    );

    process.exit(1);
  }
}
