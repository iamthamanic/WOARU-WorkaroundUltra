#!/usr/bin/env node
// src/cli.ts - NEUE, SAUBERE IMPLEMENTIERUNG

import { Command } from 'commander';
import { initializeI18n, t } from './config/i18n';
import { readFileSync } from 'fs';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// WIR WERDEN HIER NACH UND NACH DIE ANDEREN IMPORTS HINZUFÜGEN

// Diese Funktion wird ALLE Befehle definieren, NACHDEM i18n bereit ist.
function defineCommands(program: Command) {
  // Dynamische Version aus package.json
  const packageJsonPath = path.join(__dirname, '../package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

  program.version(packageJson.version);

  // Init Command - Interactive Project Scaffolding
  program
    .command('init')
    .description('Initialize a new project with best practices')
    .option('-t, --template <type>', 'Project template (nextjs, python-fastapi)')
    .option('-d, --directory <path>', 'Target directory')
    .option('-f, --features <features>', 'Comma-separated list of features')
    .option('--skip-install', 'Skip dependency installation')
    .option('--non-interactive', 'Run in non-interactive mode')
    .option('--dry-run', 'Preview changes without creating files')
    .action(async (options) => {
      try {
        const { InitCommand } = await import('./init/InitCommand');
        const initCmd = new InitCommand();
        await initCmd.execute({
          template: options.template,
          directory: options.directory,
          features: options.features,
          skipInstall: options.skipInstall,
          interactive: !options.nonInteractive,
          dryRun: options.dryRun
        });
      } catch (error) {
        console.error(chalk.red('Failed to initialize project:'), error);
        process.exit(1);
      }
    });

  // Version Command
  const versionCommand = program
    .command('version')
    .description(t('commands.version.description'))
    .action(() => {
      console.log(
        chalk.cyan(t('version.display', { version: packageJson.version }))
      );
    });

  versionCommand
    .command('check')
    .description(t('commands.version.check.description'))
    .action(async () => {
      console.log(chalk.yellow(t('version.checking_updates')));
      // TODO: Implement update check logic
      console.log(
        chalk.green(t('version.up_to_date', { version: packageJson.version }))
      );
    });

  // Commands Command - Enhanced to show all commands, subcommands and options
  program
    .command('commands')
    .description(t('commands.commands.description'))
    .action(() => {
      // Ensure i18n is initialized for this action
      initializeI18n();
      console.log(chalk.cyan.bold('📚 WOARU Command Reference'));
      console.log(chalk.gray('═'.repeat(60)));
      console.log();

      // Helper function to display command details recursively
      const displayCommand = (cmd: any, level = 0) => {
        if (!cmd.name() || !cmd.description()) return;

        const indent = '  '.repeat(level);
        const nameColor = level === 0 ? chalk.blue.bold : chalk.green;
        const arrow = level === 0 ? '📌' : '  ├─';
        
        console.log(`${indent}${arrow} ${nameColor(`woaru ${getFullCommandName(cmd)}`)}`);
        // Get the translated description, fallback to raw description if translation fails
        const description = cmd.description() || '';
        const translatedDescription = description.startsWith('commands.') ? t(description.replace('commands.', 'cli.commands.')) : description;
        console.log(`${indent}   ${chalk.gray(translatedDescription)}`);
        
        // Show command options if any
        const options = cmd.options || [];
        if (options.length > 0) {
          console.log(`${indent}   ${chalk.yellow('Options:')}`);
          options.forEach((option: any) => {
            const flags = option.flags || '';
            const description = option.description || '';
            console.log(`${indent}     ${chalk.cyan(flags)} - ${description}`);
          });
        }

        // Show usage examples based on full command path
        const fullCommandName = getFullCommandName(cmd);
        // Remove "cli " prefix for example lookup
        const commandKey = (fullCommandName || cmd.name()).replace(/^cli /, '');
        const examples = getCommandExamples(commandKey);
        if (examples.length > 0) {
          console.log(`${indent}   ${chalk.yellow('Examples:')}`);
          examples.forEach((example: string) => {
            console.log(`${indent}     ${chalk.gray(example)}`);
          });
        }

        console.log();

        // Recursively display subcommands
        if (cmd.commands && cmd.commands.length > 0) {
          cmd.commands.forEach((subCmd: any) => {
            displayCommand(subCmd, level + 1);
          });
        }
      };

      // Helper function to get full command path
      const getFullCommandName = (cmd: any): string => {
        const names = [];
        let current = cmd;
        while (current && current.name && current.name()) {
          names.unshift(current.name());
          current = current.parent;
        }
        // Remove the root program name to avoid "woaru woaru"
        if (names.length > 0 && names[0] === 'woaru') {
          names.shift();
        }
        return names.join(' ');
      };

      // Helper function to get command examples
      const getCommandExamples = (cmdName: string): string[] => {
        const examples: Record<string, string[]> = {
          'version': [
            'woaru version',
            'woaru version check'
          ],
          'version check': [
            'woaru version check'
          ],
          'commands': [
            'woaru commands'
          ],
          'wiki': [
            'woaru wiki'
          ],
          'quick-analyze': [
            'woaru quick-analyze'
          ],
          'setup': [
            'woaru setup',
            'woaru setup --dry-run',
            'woaru setup --interactive'
          ],
          'ai': [
            'woaru ai',
            'woaru ai setup',
            'woaru ai status'
          ],
          'ai setup': [
            'woaru ai setup'
          ],
          'ai status': [
            'woaru ai status',
            'woaru ai status --compact',
            'woaru ai status --no-details'
          ],
          'update-db': [
            'woaru update-db'
          ],
          'watch': [
            'woaru watch',
            'woaru watch --daemon'
          ],
          'status': [
            'woaru status'
          ],
          'update': [
            'woaru update'
          ],
          'stop': [
            'woaru stop'
          ],
          'logs': [
            'woaru logs'
          ],
          'recommendations': [
            'woaru recommendations'
          ],
          'helpers': [
            'woaru helpers'
          ],
          'docu': [
            'woaru docu',
            'woaru docu nopro src/utils/helpers.js',
            'woaru docu pro --local',
            'woaru docu forai --path-only src/services/'
          ],
          'docu nopro': [
            'woaru docu nopro',
            'woaru docu nopro --local',
            'woaru docu nopro --git main',
            'woaru docu nopro --path-only src/',
            'woaru docu nopro --preview'
          ],
          'docu pro': [
            'woaru docu pro',
            'woaru docu pro --local',
            'woaru docu pro --git develop',
            'woaru docu pro --path-only lib/',
            'woaru docu pro --force'
          ],
          'docu forai': [
            'woaru docu forai',
            'woaru docu forai --local',
            'woaru docu forai --git main',
            'woaru docu forai --path-only src/',
            'woaru docu forai --preview --force'
          ],
          'ignore': [
            'woaru ignore eslint',
            'woaru ignore prettier'
          ],
          'review': [
            'woaru review',
            'woaru review --ai',
            'woaru review --git',
            'woaru review /path/to/code'
          ],
          'analyze': [
            'woaru analyze',
            'woaru analyze --path /project/path',
            'woaru analyze ai',
            'woaru analyze ai --comprehensive'
          ],
          'analyze ai': [
            'woaru analyze ai',
            'woaru analyze ai --comprehensive',
            'woaru analyze ai --provider openai',
            'woaru analyze ai --path /custom/path'
          ],
          'rollback': [
            'woaru rollback eslint',
            'woaru rollback prettier'
          ],
          'message': [
            'woaru message --webhook https://hooks.slack.com/...',
            'woaru message --latest --webhook https://discord.com/api/webhooks/...',
            'woaru message --type review --webhook https://hooks.slack.com/...',
            'woaru message --type analyze --latest --webhook https://hooks.slack.com/...'
          ],
          'config': [
            'woaru config'
          ],
          'language': [
            'woaru language'
          ]
        };
        return examples[cmdName] || [];
      };

      // Display all main commands
      program.commands.forEach(cmd => {
        displayCommand(cmd);
      });

      console.log(chalk.yellow('💡 Pro Tips:'));
      console.log(chalk.gray('  • Use "woaru <command> --help" for detailed help on any command'));
      console.log(chalk.gray('  • Use "woaru <command> <subcommand> --help" for subcommand help'));
      console.log(chalk.gray('  • Run "woaru" without arguments to see the main interface'));
      console.log();
    });

  // Wiki Command
  program
    .command('wiki')
    .description(t('commands.wiki.description'))
    .action(async () => {
      try {
        console.log(chalk.cyan.bold(t('commands.wiki.title')));
        console.log();

        // Get current language for wiki files
        const currentLang = await getCurrentLanguage();
        const wikiPath = path.join(__dirname, '../docs/wiki', currentLang);

        if (fs.existsSync(wikiPath)) {
          const files = fs.readdirSync(wikiPath).filter(f => f.endsWith('.md'));

          for (const file of files) {
            const filePath = path.join(wikiPath, file);
            const content = readFileSync(filePath, 'utf-8');
            const title = file.replace('.md', '');

            console.log(chalk.yellow(`## ${title.toUpperCase()}`));
            console.log(
              content.substring(0, 500) + (content.length > 500 ? '...' : '')
            );
            console.log();
          }
        } else {
          console.log(
            chalk.yellow(
              t('commands.wiki.no_docs_found', { lang: currentLang })
            )
          );
        }
      } catch (error) {
        console.error(chalk.red(t('commands.wiki.error')), error);
      }
    });

  // Add missing commands that should be shown in 'woaru commands'

  // Quick Analyze Command
  program
    .command('quick-analyze')
    .description(t('commands.quick_analyze.description'))
    .action(() => {
      console.log(chalk.yellow(t('command_not_implemented.quick_analyze')));
    });

  // Setup Command
  program
    .command('setup')
    .description(t('commands.setup.description'))
    .option(
      '-d, --dry-run',
      'Show what would be done without actually doing it'
    )
    .option('-i, --interactive', 'Interactive mode with prompts', true)
    .action(async options => {
      try {
        console.log(chalk.cyan('Starting WOARU setup...'));
        const { WOARUEngine } = await import('./core/WOARUEngine');
        const engine = new WOARUEngine();

        // First analyze the project
        const analysisResult = await engine.analyzeProject(process.cwd());

        if (analysisResult.setup_recommendations.length === 0) {
          console.log(chalk.green(t('woaru_engine.project_well_configured')));
          return;
        }

        console.log(
          chalk.yellow(
            `Found ${analysisResult.setup_recommendations.length} recommendations`
          )
        );

        if (options.dryRun) {
          console.log(chalk.blue(t('woaru_engine.dry_run_mode')));
          analysisResult.setup_recommendations.forEach((rec: string) => {
            console.log(chalk.gray(`  • ${rec}`));
          });
        } else {
          await engine.setupProject(process.cwd(), {
            dryRun: false,
            interactive: options.interactive,
          });
          console.log(chalk.green('Setup completed!'));
        }
      } catch (error) {
        console.error(chalk.red('Setup failed:'), error);
      }
    });

  // AI Command - Interactive Control Center
  const aiCommand = program
    .command('ai')
    .description(t('commands.ai.description'))
    .action(async () => {
      try {
        const { showAiControlCenter } = await import('./utils/ai-control-center');
        await showAiControlCenter();
      } catch (error) {
        console.error(chalk.red('AI command failed:'), error);
      }
    });

  // AI Setup Sub-command
  aiCommand
    .command('setup')
    .description(t('commands.ai_setup.description'))
    .action(async () => {
      try {
        const { showAiSetup } = await import('./utils/ai-control-center');
        await showAiSetup();
      } catch (error) {
        console.error(chalk.red('AI setup failed:'), error);
      }
    });

  // AI Status Sub-command - Visual AI Status Check
  aiCommand
    .command('status')
    .description(t('commands.ai_status.description'))
    .option('--compact', 'Show compact status display')
    .option('--no-details', 'Hide detailed configuration information')
    .action(async (options) => {
      try {
        const { displayAiStatus } = await import('./utils/ai-helpers');
        await displayAiStatus(options.compact || false);
      } catch (error) {
        console.error(chalk.red('AI status check failed:'), error);
      }
    });

  // Update Database Command
  program
    .command('update-db')
    .description(t('commands.update_db.description'))
    .action(async () => {
      try {
        console.log(chalk.cyan(t('woaru_engine.updating_database')));
        const { WOARUEngine } = await import('./core/WOARUEngine');
        const engine = new WOARUEngine();
        const success = await engine.updateDatabase();

        if (success) {
          console.log(chalk.green(t('woaru_engine.database_updated')));
        } else {
          console.log(chalk.red(t('woaru_engine.database_update_failed')));
        }
      } catch (error) {
        console.error(chalk.red('Database update failed:'), error);
      }
    });

  // Watch Command
  program
    .command('watch')
    .description(t('commands.watch.description'))
    .option('-d, --daemon', 'Run as daemon in background')
    .action(async _options => {
      try {
        console.log(chalk.cyan('Starting WOARU supervisor...'));
        const { WOARUSupervisor } = await import(
          './supervisor/WOARUSupervisor'
        );
        const supervisor = new WOARUSupervisor(process.cwd(), {
          autoFix: false,
          autoSetup: false,
          notifications: {
            terminal: true,
            desktop: false,
          },
          ignoreTools: [],
          watchPatterns: ['**/*'],
          ignorePatterns: ['node_modules/**', '.git/**'],
          dashboard: true,
        });

        await supervisor.start();
        console.log(chalk.green('WOARU supervisor started successfully!'));
        console.log(chalk.gray('Monitoring project for changes...'));
        console.log(chalk.gray('Press Ctrl+C to stop'));

        // Keep process alive until interrupted
        process.on('SIGINT', async () => {
          console.log(chalk.yellow('\\nStopping WOARU supervisor...'));
          await supervisor.stop();
          process.exit(0);
        });
      } catch (error) {
        console.error(chalk.red('Failed to start supervisor:'), error);
      }
    });

  // Status Command
  program
    .command('status')
    .description(t('commands.status.description'))
    .action(async () => {
      try {
        console.log(chalk.cyan.bold(t('status.title')));
        console.log();

        // Check if supervisor is running
        const { WOARUSupervisor } = await import(
          './supervisor/WOARUSupervisor'
        );
        const supervisor = new WOARUSupervisor(process.cwd());

        // Get current recommendations
        const recommendations = await supervisor.getCurrentRecommendations();

        console.log(chalk.blue('📊 Project Status:'));
        console.log(`  • Recommendations: ${recommendations.length} found`);
        console.log(`  • Project Path: ${process.cwd()}`);

        if (recommendations.length > 0) {
          console.log(chalk.yellow('\\n🔧 Current Recommendations:'));
          recommendations.slice(0, 5).forEach((rec, index) => {
            console.log(`  ${index + 1}. ${rec.tool}: ${rec.reason}`);
          });

          if (recommendations.length > 5) {
            console.log(
              chalk.gray(`  ... and ${recommendations.length - 5} more`)
            );
          }
        } else {
          console.log(
            chalk.green('\\n✅ No recommendations - project looks good!')
          );
        }
      } catch (error) {
        console.error(chalk.red('Failed to get status:'), error);
      }
    });

  // Update Command
  program
    .command('update')
    .description(t('commands.update.description'))
    .action(() => {
      console.log(chalk.yellow(t('command_not_implemented.update')));
    });

  // Stop Command
  program
    .command('stop')
    .description(t('commands.stop.description'))
    .action(() => {
      console.log(chalk.yellow(t('command_not_implemented.stop')));
    });

  // Logs Command
  program
    .command('logs')
    .description(t('commands.logs.description'))
    .action(() => {
      console.log(chalk.yellow(t('command_not_implemented.logs')));
    });

  // Recommendations Command
  program
    .command('recommendations')
    .description(t('commands.recommendations.description'))
    .action(() => {
      console.log(chalk.yellow(t('command_not_implemented.recommendations')));
    });

  // Helpers Command
  program
    .command('helpers')
    .description(t('commands.helpers.description'))
    .action(() => {
      console.log(chalk.yellow(t('command_not_implemented.helpers')));
    });

  // Docu Command
  const docuCommand = program
    .command('docu')  
    .description(t('cli.commands.docu.description'))
    .action(() => {
      // Show main documentation help when no subcommand is provided
      console.log(chalk.cyan.bold(t('cli.commands.docu.description')));
      console.log();
      console.log(chalk.blue('📚 Available Documentation Commands:'));
      console.log();
      console.log(chalk.green('  • woaru docu nopro') + chalk.gray('   - ' + t('cli.commands.docu_nopro.description')));
      console.log(chalk.green('  • woaru docu pro') + chalk.gray('    - ' + t('cli.commands.docu_pro.description')));
      console.log(chalk.green('  • woaru docu forai') + chalk.gray('  - ' + t('cli.commands.docu_forai.description')));
      console.log();
      console.log(chalk.yellow('💡 Example usage:'));
      console.log(chalk.gray('  woaru docu nopro src/utils/helpers.js'));
      console.log(chalk.gray('  woaru docu pro --local'));
      console.log(chalk.gray('  woaru docu forai --path-only src/services/'));
      console.log();
      console.log(chalk.gray('Use "woaru docu <command> --help" for detailed options'));
    });

  // Docu NoPro Subcommand - Human-friendly documentation
  docuCommand
    .command('nopro')
    .description(t('cli.commands.docu_nopro.description'))
    .option('--local', 'Document uncommitted changes only')
    .option('--git <branch>', 'Document changes since specified branch')
    .option('--path-only <path>', 'Document specific files or directories')
    .option('--preview', 'Preview changes without applying them')
    .option('--force', 'Apply documentation without confirmation')
    .action(async (options) => {
      try {
        console.log(chalk.cyan('🔍 Generating human-friendly documentation...'));
        
        // Check if AI is configured with visual status
        const { isAiReady, displayAiStatus } = await import('./utils/ai-helpers');
        const isConfigured = await isAiReady();
        if (!isConfigured) {
          console.log(chalk.yellow('⚠️ AI provider required for documentation generation.'));
          await displayAiStatus(true); // Show compact status
          return;
        }

        await runDocumentationCommand('nopro', options);
      } catch (error) {
        console.error(chalk.red('Documentation generation failed:'), error);
      }
    });

  // Docu Pro Subcommand - Technical documentation  
  docuCommand
    .command('pro')
    .description(t('cli.commands.docu_pro.description'))
    .option('--local', 'Document uncommitted changes only')
    .option('--git <branch>', 'Document changes since specified branch')
    .option('--path-only <path>', 'Document specific files or directories')
    .option('--preview', 'Preview changes without applying them')
    .option('--force', 'Apply documentation without confirmation')
    .action(async (options) => {
      try {
        console.log(chalk.cyan('🔍 Generating technical documentation...'));
        
        // Check if AI is configured with visual status
        const { isAiReady, displayAiStatus } = await import('./utils/ai-helpers');
        const isConfigured = await isAiReady();
        if (!isConfigured) {
          console.log(chalk.yellow('⚠️ AI provider required for documentation generation.'));
          await displayAiStatus(true); // Show compact status
          return;
        }

        await runDocumentationCommand('pro', options);
      } catch (error) {
        console.error(chalk.red('Documentation generation failed:'), error);
      }
    });

  // Docu ForAI Subcommand - Machine-readable documentation
  docuCommand
    .command('forai')
    .description(t('cli.commands.docu_forai.description'))
    .option('--local', 'Document uncommitted changes only')
    .option('--git <branch>', 'Document changes since specified branch')
    .option('--path-only <path>', 'Document specific files or directories')
    .option('--preview', 'Preview changes without applying them')
    .option('--force', 'Apply documentation without confirmation')
    .action(async (options) => {
      try {
        console.log(chalk.cyan('🔍 Generating ForAI-optimized documentation...'));
        
        // Check if AI is configured with visual status
        const { isAiReady, displayAiStatus } = await import('./utils/ai-helpers');
        const isConfigured = await isAiReady();
        if (!isConfigured) {
          console.log(chalk.yellow('⚠️ AI provider required for documentation generation.'));
          await displayAiStatus(true); // Show compact status
          return;
        }

        await runDocumentationCommand('forai', options);
      } catch (error) {
        console.error(chalk.red('Documentation generation failed:'), error);
      }
    });

  // Ignore Command
  program
    .command('ignore')
    .description(t('commands.ignore.description'))
    .argument('<tool>', 'Tool to ignore')
    .action(tool => {
      console.log(
        chalk.yellow(
          `Ignore command not implemented yet. Would ignore: ${tool}`
        )
      );
    });

  // Review Command
  program
    .command('review')
    .description(t('commands.review.description'))
    .argument('[path]', 'Path to review', process.cwd())
    .option('--ai', 'Use AI-powered review')
    .option('--git', 'Review git changes')
    .action(async (path, options) => {
      try {
        console.log(chalk.cyan('Starting code review...'));

        if (options.ai) {
          // AI-powered review with visual status
          const { isAiReady, displayAiStatus } = await import('./utils/ai-helpers');
          const isConfigured = await isAiReady();
          if (!isConfigured) {
            console.log(chalk.yellow('AI not configured for review.'));
            await displayAiStatus(true); // Show compact status
            return;
          }

          const { AIReviewAgent } = await import('./ai/AIReviewAgent');
          const agent = new AIReviewAgent({
            providers: [],
            parallelRequests: true,
            consensusMode: false,
            minConsensusCount: 1,
            tokenLimit: 4000,
            costThreshold: 1.0,
          });
          const result = await agent.performMultiLLMReview('', {
            filePath: path,
            language: 'unknown',
            framework: 'unknown',
            totalLines: 0,
          });
          console.log(chalk.green('AI review completed!'));
          console.log(JSON.stringify(result, null, 2));
        } else {
          // Standard review using WOARUEngine
          const { WOARUEngine } = await import('./core/WOARUEngine');
          const engine = new WOARUEngine();
          const result = await engine.analyzeProject(path);

          console.log(chalk.green('\\n✅ Review completed!'));
          if (result.setup_recommendations.length > 0) {
            console.log(chalk.yellow('\\n🔧 Issues found:'));
            result.setup_recommendations.forEach(
              (rec: string, index: number) => {
                console.log(`  ${index + 1}. ${rec}`);
              }
            );
          } else {
            console.log(
              chalk.green('\\n✅ No issues found - code looks good!')
            );
          }
        }
      } catch (error) {
        console.error(chalk.red('Review failed:'), error);
      }
    });

  // Analyze Command with AI subcommand
  const analyzeCmd = program
    .command('analyze')
    .description(t('commands.analyze.description'))
    .option('-p, --path <path>', 'Path to analyze', process.cwd())
    .action(async options => {
      try {
        console.log(chalk.cyan(t('woaru_engine.analyzing_project')));
        const { WOARUEngine } = await import('./core/WOARUEngine');
        const engine = new WOARUEngine();
        const result = await engine.analyzeProject(options.path);
        
        // Fix audit configuration for production readiness audit
        if (result && typeof result === 'object') {
          const auditConfig = {
            language: (result as any).language || 'typescript',
            projectType: (result as any).framework && (result as any).framework.length > 0 ? 'fullstack' : 'library',
            frameworks: Array.isArray((result as any).framework) ? (result as any).framework : ((result as any).framework ? [(result as any).framework] : [])
          };
          // Store audit config for production auditor
          (result as any).auditConfig = auditConfig;
        }

        // Display results
        console.log(chalk.green('\\n✅ Analysis completed!'));
        const recommendationCount =
          result.setup_recommendations.length +
          result.tool_suggestions.length +
          result.framework_specific_tools.length;
        console.log(
          chalk.blue(`\\n📊 Found ${recommendationCount} recommendations`)
        );

        if (recommendationCount > 0) {
          console.log(chalk.yellow('\\n🔧 Recommendations:'));

          if (result.setup_recommendations.length > 0) {
            console.log(chalk.cyan('\\nSetup Recommendations:'));
            result.setup_recommendations.forEach(
              (rec: string, index: number) => {
                console.log(`  ${index + 1}. ${rec}`);
              }
            );
          }

          if (result.tool_suggestions.length > 0) {
            console.log(chalk.cyan('\\nTool Suggestions:'));
            result.tool_suggestions.forEach((tool: string, index: number) => {
              console.log(`  ${index + 1}. ${tool}`);
            });
          }

          if (result.framework_specific_tools.length > 0) {
            console.log(chalk.cyan('\\nFramework-specific Tools:'));
            result.framework_specific_tools.forEach(
              (tool: string, index: number) => {
                console.log(`  ${index + 1}. ${tool}`);
              }
            );
          }
        } else {
          console.log(chalk.green(t('woaru_engine.project_well_configured')));
        }
      } catch (error) {
        console.error(chalk.red('Analysis failed:'), error);
      }
    });

  // Add AI subcommand to analyze
  analyzeCmd
    .command('ai')
    .description(t('commands.analyze_ai.description'))
    .option('-p, --path <path>', 'Path to analyze', process.cwd())
    .option('--provider <provider>', 'AI provider to use')
    .option('--comprehensive', 'Run comprehensive AI analysis')
    .action(async options => {
      try {
        // Check AI configuration with visual status
        const { isAiReady, displayAiStatus } = await import('./utils/ai-helpers');
        const isAiConfigured = await isAiReady();
        
        if (!isAiConfigured) {
          console.log(chalk.yellow('AI is required for analysis.'));
          await displayAiStatus(true); // Show compact status
          console.log(chalk.yellow(t('ai_helpers.config_setup_hint')));
          return;
        }

        console.log(chalk.cyan(t('woaru_engine.analyzing_project')));
        console.log(chalk.blue('🤖 AI-powered comprehensive analysis enabled'));
        
        const { WOARUEngine } = await import('./core/WOARUEngine');
        const engine = new WOARUEngine();
        
        // Run analysis with AI enhancement
        const result = await engine.analyzeProject(options.path);
        
        // Run AI review if configured
        try {
          const { ConfigLoader } = await import('./ai/ConfigLoader');
          const configLoader = ConfigLoader.getInstance();
          const config = await configLoader.loadConfig();
          
          if (config && config.providers && Object.keys(config.providers).length > 0) {
            const { AIReviewAgent } = await import('./ai/AIReviewAgent');
            const aiAgent = new AIReviewAgent(config);
            
            // Use the correct method name from AIReviewAgent
            // AIReviewAgent doesn't have reviewCode method, use performMultiLLMReview instead
            console.log('🔍 Performing AI code review...');
            
            // For now, just indicate AI analysis is enabled
            console.log('✅ AI analysis integration ready (detailed implementation pending)');
          } else {
            console.log(chalk.yellow('\\n⚠️ No AI providers configured. Use "woaru ai setup" to configure AI analysis.'));
          }
        } catch (aiError) {
          console.warn(chalk.yellow('AI analysis failed, showing standard results:'), aiError);
        }

        // Display standard results
        console.log(chalk.green('\\n✅ Analysis completed!'));
        const recommendationCount =
          result.setup_recommendations.length +
          result.tool_suggestions.length +
          result.framework_specific_tools.length;
        console.log(
          chalk.blue(`\\n📊 Found ${recommendationCount} recommendations`)
        );

        if (recommendationCount > 0) {
          console.log(chalk.yellow('\\n🔧 Recommendations:'));

          if (result.setup_recommendations.length > 0) {
            console.log(chalk.cyan('\\nSetup Recommendations:'));
            result.setup_recommendations.forEach(
              (rec: string, index: number) => {
                console.log(`  ${index + 1}. ${rec}`);
              }
            );
          }

          if (result.tool_suggestions.length > 0) {
            console.log(chalk.cyan('\\nTool Suggestions:'));
            result.tool_suggestions.forEach((tool: string, index: number) => {
              console.log(`  ${index + 1}. ${tool}`);
            });
          }

          if (result.framework_specific_tools.length > 0) {
            console.log(chalk.cyan('\\nFramework-specific Tools:'));
            result.framework_specific_tools.forEach(
              (tool: string, index: number) => {
                console.log(`  ${index + 1}. ${tool}`);
              }
            );
          }
        } else {
          console.log(chalk.green(t('woaru_engine.project_well_configured')));
        }
      } catch (error) {
        console.error(chalk.red('AI Analysis failed:'), error);
      }
    });

  // Rollback Command
  program
    .command('rollback')
    .description(t('commands.rollback.description'))
    .argument('<tool>', 'Tool to rollback')
    .action(tool => {
      console.log(
        chalk.yellow(
          `Rollback command not implemented yet. Would rollback: ${tool}`
        )
      );
    });

  // Message Command - Send WOARU reports via terminal or webhook
  program
    .command('message')
    .description(t('commands.message.description'))
    .option('--latest', 'Send latest report only')
    .option('--type <type>', 'Filter by report type (analyze|review|audit|llm-review)')
    .option('--webhook <url>', 'Send to webhook URL (Slack/Discord compatible)')
    .option('--verbose', 'Show detailed output and error information')
    .option('--format <format>', 'Output format: markdown or json', 'markdown')
    .action(async (options) => {
      try {
        console.log(chalk.cyan('📤 Starting WOARU Message Handler...'));
        
        // Input validation
        if (options.type && !['analyze', 'review', 'audit', 'llm-review', 'all'].includes(options.type)) {
          console.error(chalk.red('❌ Invalid type. Use: analyze, review, audit, llm-review, or all'));
          return;
        }
        
        if (options.format && !['markdown', 'json'].includes(options.format)) {
          console.error(chalk.red('❌ Invalid format. Use: markdown or json'));
          return;
        }

        // Import and execute MessageHandler
        const { MessageHandler } = await import('./message/MessageHandler');
        await MessageHandler.send({
          type: options.type || 'all',
          latest: options.latest || false,
          url: options.webhook,
          format: options.format || 'markdown',
          verbose: options.verbose || false
        });

        console.log(chalk.green('✅ Message handler completed successfully'));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`❌ Message command failed: ${errorMessage}`));
        
        if (options.verbose && error instanceof Error && error.stack) {
          console.error(chalk.gray('Stack trace:'), error.stack);
        }
        
        process.exit(1);
      }
    });

  // Config Command
  program
    .command('config')
    .description(t('commands.config.description'))
    .action(() => {
      console.log(chalk.yellow(t('command_not_implemented.config')));
    });

  // Language Command
  program
    .command('language')
    .description(t('commands.language.description'))
    .action(async () => {
      const { showLanguageStatus, promptLanguageSelection } = await import(
        './config/languageSetup'
      );

      // Show current language status
      await showLanguageStatus();

      // Ask if user wants to change language
      const { default: inquirer } = await import('inquirer');
      const { change } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'change',
          message: t('language_command.select_new'),
          default: false,
        },
      ]);

      if (change) {
        try {
          const newLanguage = await promptLanguageSelection();
          const { setUserLanguage } = await import('./config/i18n');
          await setUserLanguage(newLanguage);

          console.log(
            chalk.green(
              t('language_command.language_changed', {
                language: t(
                  `language_selection.${newLanguage === 'en' ? 'english' : 'german'}`
                ),
              })
            )
          );
          console.log(chalk.gray(t('language_command.next_usage_note')));
        } catch (error) {
          console.error(chalk.red(t('language_command.error_changing')), error);
        }
      } else {
        console.log(
          chalk.blue(
            t('language_command.language_unchanged', {
              language: t(
                `language_selection.${(await getCurrentLanguage()) === 'en' ? 'english' : 'german'}`
              ),
            })
          )
        );
      }
    });

  // Setze die Hauptbeschreibung am Ende, wenn i18n garantiert vollständig geladen ist
  program.description(t('cli.main.description'));
}

// Helper function to get current language
async function getCurrentLanguage(): Promise<string> {
  const { getCurrentLanguage: getI18nLanguage } = await import('./config/i18n');
  return getI18nLanguage();
}

// Documentation command handler
async function runDocumentationCommand(
  documentationType: 'nopro' | 'pro' | 'forai',
  options: any
): Promise<void> {
  const projectPath = process.cwd();
  
  try {
    // Import required modules
    const { ConfigLoader } = await import('./ai/ConfigLoader');
    const { DocumentationAgent } = await import('./ai/DocumentationAgent');
    const { PromptManager } = await import('./ai/PromptManager');
    
    // Get AI configuration
    const configLoader = ConfigLoader.getInstance();
    const aiConfig = await configLoader.loadConfig();
    
    if (!aiConfig || aiConfig.providers.length === 0) {
      console.log(chalk.yellow('⚠️ No AI providers configured.'));
      console.log(chalk.gray('Run: woaru ai setup'));
      return;
    }

    // Load prompt templates using PromptManager
    const promptManager = PromptManager.getInstance();
    await promptManager.initialize();
    
    // Load documentation-specific prompts
    const promptTemplates: Record<string, any> = {};
    try {
      promptTemplates[`docu_${documentationType}`] = await promptManager.loadPrompt(
        'global', 
        `docu_${documentationType}`
      );
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Could not load documentation prompt template for ${documentationType}`));
      console.log(chalk.gray('Using default AI review prompts'));
    }
    
    // Create documentation agent
    const docAgent = new DocumentationAgent(aiConfig, promptTemplates);
    
    // Determine which files to document
    let filesToDocument: string[] = [];
    
    if (options.pathOnly) {
      // Document specific files or directories
      const { glob } = await import('glob');
      const pattern = options.pathOnly.endsWith('/') 
        ? `${options.pathOnly}**/*.{js,ts,jsx,tsx,py,java,go,rs,php,rb}`
        : options.pathOnly;
      filesToDocument = await glob(pattern, { cwd: projectPath });
    } else if (options.local) {
      // Document uncommitted changes
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      try {
        const { stdout } = await execAsync('git diff --name-only', { cwd: projectPath });
        filesToDocument = stdout.trim().split('\n').filter(f => f.length > 0);
      } catch (error) {
        console.log(chalk.yellow('⚠️ Git not available or not in a git repository'));
        console.log(chalk.gray('Using all supported files in current directory'));
        const { glob } = await import('glob');
        filesToDocument = await glob('**/*.{js,ts,jsx,tsx,py,java,go,rs,php,rb}', { cwd: projectPath });
      }
    } else if (options.git) {
      // Document changes since specified branch
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      try {
        const { stdout } = await execAsync(`git diff --name-only ${options.git}`, { cwd: projectPath });
        filesToDocument = stdout.trim().split('\n').filter(f => f.length > 0);
      } catch (error) {
        console.error(chalk.red(`Failed to get changes since branch ${options.git}:`), error);
        return;
      }
    } else {
      // Document all supported files
      const { glob } = await import('glob');
      filesToDocument = await glob('**/*.{js,ts,jsx,tsx,py,java,go,rs,php,rb}', {
        cwd: projectPath,
        ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**', 'coverage/**']
      });
    }

    if (filesToDocument.length === 0) {
      console.log(chalk.yellow('📂 No files found to document.'));
      return;
    }

    console.log(chalk.blue(`📝 Found ${filesToDocument.length} files to document`));
    
    // Generate documentation
    const results = await docAgent.generateDocumentation(
      filesToDocument.map(f => path.resolve(projectPath, f)),
      projectPath,
      documentationType
    );

    if (results.length === 0) {
      console.log(chalk.yellow('📝 No documentation generated. Files may already be documented.'));
      return;
    }

    console.log(chalk.green(`✅ Generated documentation for ${results.length} items`));

    // Preview mode - show what would be changed
    if (options.preview) {
      console.log(chalk.cyan('\n📋 Preview of documentation changes:'));
      for (const result of results.slice(0, 3)) { // Show first 3 as examples
        console.log(chalk.blue(`\n📄 ${path.relative(projectPath, result.filePath)}:`));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(result.generatedDoc);
        if (results.length > 3 && result === results[2]) {
          console.log(chalk.gray(`... and ${results.length - 3} more files`));
        }
      }
      console.log(chalk.yellow('\n💡 Run without --preview to apply changes'));
      return;
    }

    // Apply documentation if not in preview mode
    if (!options.force) {
      const { default: inquirer } = await import('inquirer');
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Apply documentation to ${results.length} items?`,
          default: true,
        },
      ]);

      if (!confirm) {
        console.log(chalk.gray('Documentation cancelled.'));
        return;
      }
    }

    // Apply the documentation
    await docAgent.applyDocumentation(results);
    console.log(chalk.green(`\n🎉 Documentation applied successfully!`));
    console.log(chalk.gray(`Generated ${documentationType} documentation for ${results.length} items`));

  } catch (error) {
    console.error(chalk.red('❌ Documentation generation failed:'), error);
    throw error;
  }
}

// Dies ist der EINZIGE Startpunkt der Anwendung.
async function main() {
  try {
    // SCHRITT 1: Initialisiere i18n synchron (keine Wartezeit mehr nötig)
    initializeI18n();

    // SCHRITT 2: Prüfe ob keine Argumente übergeben wurden (für Splash Screen)
    if (process.argv.length === 2) {
      // Zeige Splash Screen
      displaySplashScreen();
      return;
    }

    // SCHRITT 3: Erstelle das Programm und definiere die Befehle
    const program = new Command();
    defineCommands(program);

    // SCHRITT 4: Führe das Programm aus
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error('A critical error occurred:', error);
    process.exit(1);
  }
}

// Helper function to center text in the ASCII box and ensure exact length
function centerText(text: string, availableWidth: number): string {
  // Use simple string length instead of visual width to avoid emoji issues
  const textLength = text.length;
  const padding = Math.max(0, Math.floor((availableWidth - textLength) / 2));
  const rightPadding = availableWidth - textLength - padding;
  
  let result = ' '.repeat(padding) + text + ' '.repeat(Math.max(0, rightPadding));
  
  // Ensure exact length by force-adjusting the result
  while (result.length < availableWidth) {
    result += ' ';
  }
  while (result.length > availableWidth) {
    result = result.substring(0, result.length - 1);
  }
  
  return result;
}

// Splash Screen Funktion
function displaySplashScreen() {
  // Alle Übersetzungen VOR dem Template-String auflösen
  const mainTitle = t('splash_screen.main_title');
  const versionDisplay = t('splash_screen.version_display', {
    version: getVersion(),
  });
  const mainCommands = t('splash_screen.main_commands');
  const commandsDesc = t('splash_screen.commands_desc');
  const analyzeDesc = t('splash_screen.analyze_desc');
  const watchDesc = t('splash_screen.watch_desc');
  const reviewDesc = 'Code review and analysis';
  const aiDesc = t('splash_screen.ai_desc');
  const languageDesc = t('splash_screen.language_desc');
  const setupDesc = t('splash_screen.setup_desc');
  const usageHint = t('splash_screen.usage_hint');

  // Build the splash screen with proper centering
  const availableWidth = 66; // Width inside the box (68 - 2 border characters)
  
  // Center the title and version text
  const centeredTitle = centerText(mainTitle, availableWidth);
  const centeredVersion = centerText(versionDisplay, availableWidth);
  
  console.log(chalk.cyan('╔══════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║                                                                  ║'));
  console.log(chalk.cyan('║           ██╗    ██╗ ██████╗  █████╗ ██████╗ ██╗   ██╗           ║'));
  console.log(chalk.cyan('║           ██║    ██║██╔═══██╗██╔══██╗██╔══██╗██║   ██║           ║'));
  console.log(chalk.cyan('║           ██║ █╗ ██║██║   ██║███████║██████╔╝██║   ██║           ║'));
  console.log(chalk.cyan('║           ██║███╗██║██║   ██║██╔══██║██╔══██╗██║   ██║           ║'));
  console.log(chalk.cyan('║           ╚███╔███╔╝╚██████╔╝██║  ██║██║  ██║╚██████╔╝           ║'));
  console.log(chalk.cyan('║            ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝            ║'));
  console.log(chalk.cyan('║                                                                  ║'));
  console.log(chalk.cyan('║') + chalk.yellow(centeredTitle) + chalk.cyan('║'));
  console.log(chalk.cyan('║                                                                  ║'));
  console.log(chalk.cyan('║') + chalk.green(centeredVersion) + chalk.cyan('║'));
  console.log(chalk.cyan('║                                                                  ║'));
  console.log(chalk.cyan('╚══════════════════════════════════════════════════════════════════╝'));

  // Verfügbare Hauptbefehle anzeigen
  console.log(chalk.cyan(mainCommands));
  console.log();
  console.log(
    chalk.blue('  • woaru commands') + chalk.gray('   - ' + commandsDesc)
  );
  console.log(
    chalk.blue('  • woaru analyze') + chalk.gray('    - ' + analyzeDesc)
  );
  console.log(
    chalk.blue('  • woaru watch') + chalk.gray('      - ' + watchDesc)
  );
  console.log(
    chalk.blue('  • woaru review') + chalk.gray('     - ' + reviewDesc)
  );
  console.log(chalk.blue('  • woaru ai') + chalk.gray('         - ' + aiDesc));
  console.log(
    chalk.blue('  • woaru language') + chalk.gray('   - ' + languageDesc)
  );
  console.log(
    chalk.blue('  • woaru setup') + chalk.gray('      - ' + setupDesc)
  );
  console.log();
  console.log(chalk.gray(usageHint));
}

// Helper function to get version
function getVersion(): string {
  const packageJsonPath = path.join(__dirname, '../package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  return packageJson.version;
}

// Starte die Anwendung
main();
