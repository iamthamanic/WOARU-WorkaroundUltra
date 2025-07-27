#!/usr/bin/env node
// src/cli.ts - NEUE, SAUBERE IMPLEMENTIERUNG

import { Command } from 'commander';
import { initializeI18n, t, isInitialized } from './config/i18n';
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
      console.log(chalk.cyan(t('version.display', { version: packageJson.version })));
    });

  versionCommand
    .command('check')
    .description(t('commands.version.check.description'))
    .action(async () => {
      console.log(chalk.yellow(t('version.checking_updates')));
      // TODO: Implement update check logic
      console.log(chalk.green(t('version.up_to_date', { version: packageJson.version })));
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
            console.log(chalk.gray(`  ${t('commands.purpose_label')}: ${purpose}`));
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
        const currentLang = getCurrentLanguage();
        const wikiPath = path.join(__dirname, '../docs/wiki', currentLang);
        
        if (fs.existsSync(wikiPath)) {
          const files = fs.readdirSync(wikiPath).filter(f => f.endsWith('.md'));
          
          for (const file of files) {
            const filePath = path.join(wikiPath, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const title = file.replace('.md', '');
            
            console.log(chalk.yellow(`## ${title.toUpperCase()}`));
            console.log(content.substring(0, 500) + (content.length > 500 ? '...' : ''));
            console.log();
          }
        } else {
          console.log(chalk.yellow(t('commands.wiki.no_docs_found', { lang: currentLang })));
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
    .action(() => {
      console.log(chalk.yellow(t('command_not_implemented.setup')));
    });

  // AI Command
  program
    .command('ai')
    .description(t('commands.ai.description'))
    .action(() => {
      console.log(chalk.yellow(t('command_not_implemented.ai')));
    });

  // Update Database Command
  program
    .command('update-db')
    .description(t('commands.update_db.description'))
    .action(() => {
      console.log(chalk.yellow(t('command_not_implemented.update_db')));
    });

  // Watch Command  
  program
    .command('watch')
    .description(t('commands.watch.description'))
    .action(() => {
      console.log(chalk.yellow(t('command_not_implemented.watch')));
    });

  // Status Command
  program
    .command('status')
    .description(t('commands.status.description'))
    .action(() => {
      console.log(chalk.yellow(t('command_not_implemented.status')));
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
    .action((tool) => {
      console.log(chalk.yellow(`Ignore command not implemented yet. Would ignore: ${tool}`));
    });

  // Review Command
  program
    .command('review')
    .description(t('commands.review.description'))
    .action(() => {
      console.log(chalk.yellow(t('command_not_implemented.review')));
    });

  // Analyze Command
  program
    .command('analyze')
    .description(t('commands.analyze.description'))
    .action(() => {
      console.log(chalk.yellow(t('command_not_implemented.analyze')));
    });

  // Rollback Command
  program
    .command('rollback')
    .description(t('commands.rollback.description'))
    .argument('<tool>', 'Tool to rollback')
    .action((tool) => {
      console.log(chalk.yellow(`Rollback command not implemented yet. Would rollback: ${tool}`));
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
      const { showLanguageStatus, promptLanguageSelection } = await import('./config/languageSetup');
      
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
          
          console.log(chalk.green(t('language_command.language_changed', { 
            language: t(`language_selection.${newLanguage === 'en' ? 'english' : 'german'}`)
          })));
          console.log(chalk.gray(t('language_command.next_usage_note')));
        } catch (error) {
          console.error(chalk.red(t('language_command.error_changing')), error);
        }
      } else {
        console.log(chalk.blue(t('language_command.language_unchanged', { 
          language: t(`language_selection.${getCurrentLanguage() === 'en' ? 'english' : 'german'}`)
        })));
      }
    });

  // Setze die Hauptbeschreibung am Ende, wenn i18n garantiert vollständig geladen ist
  program.description(t('commands.main.description'));
}

// Helper function to get current language
function getCurrentLanguage(): string {
  const { getCurrentLanguage: getI18nLanguage } = require('./config/i18n');
  return getI18nLanguage();
}

// Dies ist der EINZIGE Startpunkt der Anwendung.
async function main() {
  try {
    // SCHRITT 1: WARTE, bis die Übersetzungen garantiert geladen sind.
    await initializeI18n();

    // SCHRITT 2: Warte bis i18n-Ressourcen vollständig geladen sind
    await new Promise(resolve => setTimeout(resolve, 200));

    // SCHRITT 3: Prüfe ob keine Argumente übergeben wurden (für Splash Screen)
    if (process.argv.length === 2) {
      // Zeige Splash Screen
      displaySplashScreen();
      return;
    }

    // SCHRITT 4: ERST DANACH, erstelle das Programm und definiere die Befehle.
    const program = new Command();
    defineCommands(program);

    // SCHRITT 5: Führe das Programm aus.
    await program.parseAsync(process.argv);

  } catch (error) {
    console.error("A critical error occurred:", error);
    process.exit(1);
  }
}

// Splash Screen Funktion
function displaySplashScreen() {
  
  // Alle Übersetzungen VOR dem Template-String auflösen
  const mainTitle = t('splash_screen.main_title');
  const versionDisplay = t('splash_screen.version_display', { version: getVersion() });
  const mainCommands = t('splash_screen.main_commands');
  const commandsDesc = t('splash_screen.commands_desc');
  const analyzeDesc = t('splash_screen.analyze_desc');
  const watchDesc = t('splash_screen.watch_desc');
  const aiDesc = t('splash_screen.ai_desc');
  const languageDesc = t('splash_screen.language_desc');
  const setupDesc = t('splash_screen.setup_desc');
  const usageHint = t('splash_screen.usage_hint');
  
  console.log(chalk.cyan(`
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
`));

  // Verfügbare Hauptbefehle anzeigen
  console.log(chalk.cyan(mainCommands));
  console.log();
  console.log(chalk.blue('  • woaru commands') + chalk.gray('   - ' + commandsDesc));
  console.log(chalk.blue('  • woaru analyze') + chalk.gray('    - ' + analyzeDesc));
  console.log(chalk.blue('  • woaru watch') + chalk.gray('      - ' + watchDesc));
  console.log(chalk.blue('  • woaru ai') + chalk.gray('         - ' + aiDesc));
  console.log(chalk.blue('  • woaru language') + chalk.gray('   - ' + languageDesc));
  console.log(chalk.blue('  • woaru setup') + chalk.gray('      - ' + setupDesc));
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