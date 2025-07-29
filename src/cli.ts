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
  program
    .command('docu')
    .description(t('commands.docu.description'))
    .action(() => {
      console.log(chalk.yellow(t('command_not_implemented.docu')));
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

  console.log(
    chalk.cyan(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║     ██╗    ██╗ ██████╗  █████╗ ██████╗ ██╗   ██╗               ║
║     ██║    ██║██╔═══██╗██╔══██╗██╔══██╗██║   ██║               ║
║     ██║ █╗ ██║██║   ██║███████║██████╔╝██║   ██║               ║
║     ██║███╗██║██║   ██║██╔══██║██╔══██╗██║   ██║               ║
║     ╚███╔███╔╝╚██████╔╝██║  ██║██║  ██║╚██████╔╝               ║
║      ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝                ║
║                                                                  ║
║          ${chalk.yellow(mainTitle)}          ║
║                                                                  ║
║                    ${chalk.green(versionDisplay)}                    ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`)
  );

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
