#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { WAUEngine } from './core/WAUEngine';
import * as path from 'path';
import * as fs from 'fs-extra';

const program = new Command();
const wauEngine = new WAUEngine();

program
  .name('wau')
  .description('WorkaroundUltra - Project Setup Autopilot')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze current project and get recommendations')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    try {
      const projectPath = path.resolve(options.path);
      
      const result = await wauEngine.analyzeProject(projectPath);
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.blue('📋 Analysis Results:\n'));
        
        if (result.setup_recommendations.length > 0) {
          console.log(chalk.yellow('🔧 Setup Recommendations:'));
          result.setup_recommendations.forEach(rec => console.log(`  • ${rec}`));
          console.log();
        }

        if (result.framework_specific_tools.length > 0) {
          console.log(chalk.cyan('⚡ Framework-Specific Tools:'));
          result.framework_specific_tools.forEach(tool => console.log(`  • ${tool}`));
          console.log();
        }

        if (result.refactor_suggestions.length > 0) {
          console.log(chalk.magenta('🔄 Refactor Suggestions:'));
          result.refactor_suggestions.forEach(suggestion => {
            console.log(`  • ${suggestion.filename}: ${suggestion.suggestion}`);
          });
          console.log();
        }

        if (result.installed_tools_detected.length > 0) {
          console.log(chalk.green('✅ Already Installed:'));
          result.installed_tools_detected.forEach(tool => console.log(`  • ${tool}`));
          console.log();
        }

        if (result.code_insights && result.code_insights.length > 0) {
          console.log(chalk.yellow('🔬 Code Analysis Insights:'));
          result.code_insights.forEach(insight => {
            const severityColor = insight.severity === 'high' ? chalk.red : 
                                 insight.severity === 'medium' ? chalk.yellow : chalk.gray;
            console.log(`  • ${severityColor(insight.tool.toUpperCase())}: ${insight.reason}`);
            if (insight.evidence.length > 0) {
              insight.evidence.slice(0, 3).forEach(evidence => {
                console.log(`    - ${chalk.gray(evidence)}`);
              });
            }
          });
          console.log();
        }

        if (result.claude_automations && result.claude_automations.length > 0) {
          console.log(chalk.blue('🤖 Claude Automation Ideas:'));
          result.claude_automations.forEach(automation => console.log(`  • ${automation}`));
        }
      }
    } catch (error) {
      console.error(chalk.red(`❌ Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Automatically setup recommended tools')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('--dry-run', 'Show what would be done without executing')
  .option('--force', 'Force setup even if tools are already configured')
  .option('--skip-backup', 'Skip creating backups before changes')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (options) => {
    try {
      const projectPath = path.resolve(options.path);
      
      if (!options.yes && !options.dryRun) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'This will modify your project files. Continue?',
            default: false
          }
        ]);

        if (!confirm) {
          console.log(chalk.yellow('Setup cancelled.'));
          return;
        }
      }

      const setupOptions = {
        dryRun: options.dryRun,
        force: options.force,
        skipBackup: options.skipBackup,
        interactive: !options.yes
      };

      const success = await wauEngine.setupProject(projectPath, setupOptions);
      
      if (success) {
        console.log(chalk.green('\n🎉 Project setup completed successfully!'));
        
        if (!options.dryRun) {
          console.log(chalk.blue('\n💡 Next steps:'));
          console.log('  • Run your linter: npm run lint');
          console.log('  • Format your code: npm run format');
          console.log('  • Commit your changes to test the git hooks');
        }
      } else {
        console.log(chalk.red('\n❌ Setup completed with some failures. Check the output above for details.'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`❌ Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

program
  .command('update-db')
  .description('Update the tools database from remote source')
  .action(async () => {
    const success = await wauEngine.updateDatabase();
    process.exit(success ? 0 : 1);
  });

program
  .command('rollback')
  .description('Rollback changes made by a specific tool')
  .argument('<tool>', 'Tool name to rollback (e.g., prettier, eslint, husky)')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async (tool, options) => {
    try {
      const projectPath = path.resolve(options.path);
      
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to rollback ${tool}? This will restore backup files and remove configurations.`,
          default: false
        }
      ]);

      if (!confirm) {
        console.log(chalk.yellow('Rollback cancelled.'));
        return;
      }

      // This would need to be implemented in the ActionManager
      console.log(chalk.yellow(`🔄 Rollback for ${tool} is not yet implemented.`));
      console.log(chalk.gray('You can manually restore backup files ending with .wau-backup-*'));
      
    } catch (error) {
      console.error(chalk.red(`❌ Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red('❌ Invalid command. Use --help to see available commands.'));
  process.exit(1);
});

// Show help if no command provided
if (process.argv.length === 2) {
  program.help();
}

program.parse();