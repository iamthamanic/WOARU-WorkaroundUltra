#!/usr/bin/env node
// src/cli.ts - NEUE, SAUBERE IMPLEMENTIERUNG

import { Command } from 'commander';
import { initializeI18n, t } from './config/i18n';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
// WIR WERDEN HIER NACH UND NACH DIE ANDEREN IMPORTS HINZUFÜGEN

// Diese Funktion wird ALLE Befehle definieren, NACHDEM i18n bereit ist.
function defineCommands(program: Command) {
  // Dynamische Version aus package.json
  const packageJsonPath = path.join(__dirname, '../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  program.version(packageJson.version);

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

  // Commands Command
  program
    .command('commands')
    .description(t('commands.commands.description'))
    .action(() => {
      console.log(chalk.cyan.bold(t('commands.commands.title')));
      console.log();

      // Iterate through all commands and show their descriptions
      program.commands.forEach(cmd => {
        if (cmd.name() && cmd.description()) {
          const purpose = t(`commands.${cmd.name()}.purpose`);
          console.log(chalk.blue(`• ${cmd.name()}`));
          console.log(`  ${cmd.description()}`);
          if (purpose !== `commands.${cmd.name()}.purpose`) {
            console.log(
              chalk.gray(`  ${t('commands.purpose_label')}: ${purpose}`)
            );
          }
          console.log();
        }
      });
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
            const content = fs.readFileSync(filePath, 'utf-8');
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
      console.log(chalk.green('  • woaru docu ai') + chalk.gray('     - ' + t('cli.commands.docu_ai.description')));
      console.log();
      console.log(chalk.yellow('💡 Example usage:'));
      console.log(chalk.gray('  woaru docu nopro src/utils/helpers.js'));
      console.log(chalk.gray('  woaru docu pro --local'));
      console.log(chalk.gray('  woaru docu ai --path-only src/services/'));
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
        
        // Check if AI is configured
        const { ensureAiIsConfigured } = await import('./utils/ai-helpers');
        const isConfigured = ensureAiIsConfigured();
        if (!isConfigured) {
          console.log(chalk.yellow('⚠️ AI provider required for documentation generation.'));
          console.log(chalk.gray('Run: woaru ai setup'));
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
        
        // Check if AI is configured
        const { ensureAiIsConfigured } = await import('./utils/ai-helpers');
        const isConfigured = ensureAiIsConfigured();
        if (!isConfigured) {
          console.log(chalk.yellow('⚠️ AI provider required for documentation generation.'));
          console.log(chalk.gray('Run: woaru ai setup'));
          return;
        }

        await runDocumentationCommand('pro', options);
      } catch (error) {
        console.error(chalk.red('Documentation generation failed:'), error);
      }
    });

  // Docu AI Subcommand - Machine-readable documentation
  docuCommand
    .command('ai')
    .description(t('cli.commands.docu_ai.description'))
    .option('--local', 'Document uncommitted changes only')
    .option('--git <branch>', 'Document changes since specified branch')
    .option('--path-only <path>', 'Document specific files or directories')
    .option('--preview', 'Preview changes without applying them')
    .option('--force', 'Apply documentation without confirmation')
    .action(async (options) => {
      try {
        console.log(chalk.cyan('🔍 Generating AI-optimized documentation...'));
        
        // Check if AI is configured
        const { ensureAiIsConfigured } = await import('./utils/ai-helpers');
        const isConfigured = ensureAiIsConfigured();
        if (!isConfigured) {
          console.log(chalk.yellow('⚠️ AI provider required for documentation generation.'));
          console.log(chalk.gray('Run: woaru ai setup'));
          return;
        }

        await runDocumentationCommand('ai', options);
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
          // AI-powered review
          const { ensureAiIsConfigured } = await import('./utils/ai-helpers');
          const isConfigured = ensureAiIsConfigured();
          if (!isConfigured) {
            console.log(chalk.yellow('AI not configured. Run: woaru ai setup'));
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

  // Analyze Command
  program
    .command('analyze')
    .description(t('commands.analyze.description'))
    .option('-p, --path <path>', 'Path to analyze', process.cwd())
    .action(async options => {
      try {
        console.log(chalk.cyan(t('woaru_engine.analyzing_project')));
        const { WOARUEngine } = await import('./core/WOARUEngine');
        const engine = new WOARUEngine();
        const result = await engine.analyzeProject(options.path);

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

  // Message Command
  program
    .command('message')
    .description(t('commands.message.description'))
    .action(() => {
      console.log(chalk.yellow(t('command_not_implemented.message')));
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
  documentationType: 'nopro' | 'pro' | 'ai',
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

// Helper function to calculate visual width accounting for emojis
function getVisualWidth(text: string): number {
  return Array.from(text).reduce((width, char) => {
    // Simple emoji detection - Unicode ranges for most emojis
    const codePoint = char.codePointAt(0);
    if (codePoint && (
      (codePoint >= 0x1F600 && codePoint <= 0x1F64F) || // Emoticons
      (codePoint >= 0x1F300 && codePoint <= 0x1F5FF) || // Misc Symbols
      (codePoint >= 0x1F680 && codePoint <= 0x1F6FF) || // Transport
      (codePoint >= 0x2600 && codePoint <= 0x26FF) ||   // Misc symbols
      (codePoint >= 0x2700 && codePoint <= 0x27BF)      // Dingbats
    )) {
      return width + 2; // Emojis are roughly 2 characters wide
    }
    return width + 1;
  }, 0);
}

// Helper function to center text in the ASCII box and ensure exact length
function centerText(text: string, availableWidth: number): string {
  const visualWidth = getVisualWidth(text);
  const padding = Math.max(0, Math.floor((availableWidth - visualWidth) / 2));
  const rightPadding = availableWidth - visualWidth - padding;
  
  const result = ' '.repeat(padding) + text + ' '.repeat(Math.max(0, rightPadding));
  
  // Ensure exact length by trimming or padding as needed
  if (result.length > availableWidth) {
    return result.substring(0, availableWidth);
  } else if (result.length < availableWidth) {
    return result + ' '.repeat(availableWidth - result.length);
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
  console.log(chalk.cyan('║     ██╗    ██╗ ██████╗  █████╗ ██████╗ ██╗   ██╗               ║'));
  console.log(chalk.cyan('║     ██║    ██║██╔═══██╗██╔══██╗██╔══██╗██║   ██║               ║'));
  console.log(chalk.cyan('║     ██║ █╗ ██║██║   ██║███████║██████╔╝██║   ██║               ║'));
  console.log(chalk.cyan('║     ██║███╗██║██║   ██║██╔══██║██╔══██╗██║   ██║               ║'));
  console.log(chalk.cyan('║     ╚███╔███╔╝╚██████╔╝██║  ██║██║  ██║╚██████╔╝               ║'));
  console.log(chalk.cyan('║      ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝                ║'));
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
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  return packageJson.version;
}

// Starte die Anwendung
main();
