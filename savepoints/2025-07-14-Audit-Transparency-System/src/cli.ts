#!/usr/bin/env node
// Test hybrid architecture

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { WAUEngine } from './core/WAUEngine';
import { WOARUSupervisor } from './supervisor/WAUSupervisor';
import { ProjectAnalyzer } from './analyzer/ProjectAnalyzer';
import * as path from 'path';
import * as fs from 'fs-extra';

// Global supervisor instance
let supervisor: WOARUSupervisor | null = null;

const program = new Command();
const wauEngine = new WAUEngine();

program
  .name('woaru')
  .description('WorkaroundUltra - Project Setup Autopilot')
  .version('3.0.0');

program
  .command('quick-analyze')
  .description('Quick analysis for project setup recommendations')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-j, --json', 'Output as JSON')
  .action(async options => {
    try {
      const projectPath = path.resolve(options.path);

      const result = await wauEngine.analyzeProject(projectPath);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.blue('📋 Analysis Results:\n'));

        if (result.setup_recommendations.length > 0) {
          console.log(chalk.yellow('🔧 Setup Recommendations:'));
          result.setup_recommendations.forEach(rec =>
            console.log(`  • ${rec}`)
          );
          console.log();
        }

        if (result.framework_specific_tools.length > 0) {
          console.log(chalk.cyan('⚡ Framework-Specific Tools:'));
          result.framework_specific_tools.forEach(tool =>
            console.log(`  • ${tool}`)
          );
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
          result.installed_tools_detected.forEach(tool =>
            console.log(`  • ${tool}`)
          );
          console.log();
        }

        if (result.code_insights && result.code_insights.length > 0) {
          console.log(chalk.yellow('🔬 Code Analysis Insights:'));
          result.code_insights.forEach(insight => {
            const severityColor =
              insight.severity === 'high'
                ? chalk.red
                : insight.severity === 'medium'
                  ? chalk.yellow
                  : chalk.gray;
            console.log(
              `  • ${severityColor(insight.tool.toUpperCase())}: ${insight.reason}`
            );
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
          result.claude_automations.forEach(automation =>
            console.log(`  • ${automation}`)
          );
        }
      }
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });

// Setup command with sub-commands
const setupCommand = program
  .command('setup')
  .description('Setup tools and LLM integrations');

// Setup tools sub-command (original setup functionality)
setupCommand
  .command('tools')
  .description('Automatically setup recommended development tools')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('--dry-run', 'Show what would be done without executing')
  .option('--force', 'Force setup even if tools are already configured')
  .option('--skip-backup', 'Skip creating backups before changes')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async options => {
    try {
      const projectPath = path.resolve(options.path);

      if (!options.yes && !options.dryRun) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'This will modify your project files. Continue?',
            default: false,
          },
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
        interactive: !options.yes,
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
        console.log(
          chalk.red(
            '\n❌ Setup completed with some failures. Check the output above for details.'
          )
        );
        process.exit(1);
      }
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });

// Setup LLM sub-command
setupCommand
  .command('llm')
  .description('Setup and configure LLM providers for AI code analysis')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async options => {
    try {
      const projectPath = path.resolve(options.path);
      
      console.log(chalk.cyan.bold('🤖 WOARU LLM Setup'));
      console.log(chalk.gray('═'.repeat(40)));
      console.log('This will guide you through setting up LLM providers for AI code analysis.\n');

      // Check if configuration already exists
      const configPath = path.join(projectPath, 'woaru.config.js');
      const hasConfig = await fs.pathExists(configPath);
      
      if (hasConfig) {
        console.log(chalk.yellow('⚠️ Configuration file already exists: woaru.config.js'));
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: 'Do you want to reconfigure LLM providers?',
            default: false,
          },
        ]);
        
        if (!overwrite) {
          console.log(chalk.yellow('Setup cancelled.'));
          return;
        }
      }

      // Show current integrated LLMs (if any)
      let currentConfig: any = null;
      if (hasConfig) {
        try {
          const { ConfigLoader } = await import('./ai/ConfigLoader');
          const configLoader = ConfigLoader.getInstance();
          currentConfig = await configLoader.loadConfig(projectPath);
          
          if (currentConfig && currentConfig.providers.length > 0) {
            console.log(chalk.cyan('📋 Currently configured LLMs:'));
            currentConfig.providers.forEach((provider: any) => {
              const status = provider.enabled ? '✅ enabled' : '❌ disabled';
              console.log(`  • ${provider.id} (${provider.model}) - ${status}`);
            });
            console.log();
          }
        } catch (error) {
          console.log(chalk.yellow('⚠️ Could not read existing configuration.'));
        }
      } else {
        console.log(chalk.blue('📋 No LLMs are currently integrated.'));
        console.log();
      }

      // Interactive LLM setup
      const setupChoices = [
        'Add Anthropic Claude',
        'Add OpenAI GPT-4',
        'Add Google Gemini',
        'Add Azure OpenAI',
        'Add Local Ollama',
        'Done'
      ];

      const providers: any[] = currentConfig?.providers || [];
      
      while (true) {
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: setupChoices,
          },
        ]);

        if (action === 'Done') {
          break;
        }

        let newProvider: any = null;

        switch (action) {
          case 'Add Anthropic Claude':
            newProvider = await setupAnthropicProvider();
            break;
          case 'Add OpenAI GPT-4':
            newProvider = await setupOpenAIProvider();
            break;
          case 'Add Google Gemini':
            newProvider = await setupGoogleProvider();
            break;
          case 'Add Azure OpenAI':
            newProvider = await setupAzureProvider();
            break;
          case 'Add Local Ollama':
            newProvider = await setupOllamaProvider();
            break;
        }

        if (newProvider) {
          // Remove existing provider with same ID
          const existingIndex = providers.findIndex(p => p.id === newProvider.id);
          if (existingIndex >= 0) {
            providers[existingIndex] = newProvider;
            console.log(chalk.green(`✅ Updated ${newProvider.id} configuration`));
          } else {
            providers.push(newProvider);
            console.log(chalk.green(`✅ Added ${newProvider.id} configuration`));
          }
          console.log();
        }
      }

      if (providers.length === 0) {
        console.log(chalk.yellow('⚠️ No LLM providers configured. Setup cancelled.'));
        return;
      }

      // Create configuration object
      const config = {
        ai: {
          providers,
          parallelRequests: true,
          consensusMode: false,
          minConsensusCount: 2,
          tokenLimit: 8000,
          costThreshold: 0.50
        }
      };

      // Save configuration
      const configContent = `/**
 * WOARU Multi-LLM AI Code Review Configuration
 * Generated by woaru setup llm
 */

module.exports = ${JSON.stringify(config, null, 2)};
`;

      await fs.writeFile(configPath, configContent, 'utf8');
      
      console.log(chalk.green.bold('\n🎉 LLM Setup Complete!'));
      console.log(chalk.cyan(`📄 Configuration saved to: woaru.config.js`));
      console.log(chalk.cyan(`🤖 Configured ${providers.length} LLM provider(s)`));
      
      // Show next steps
      console.log(chalk.yellow.bold('\n💡 Next Steps:'));
      
      const enabledProviders = providers.filter(p => p.enabled);
      if (enabledProviders.length > 0) {
        console.log('1. Set your API keys in environment variables:');
        enabledProviders.forEach(provider => {
          if (provider.apiKeyEnvVar) {
            console.log(chalk.gray(`   export ${provider.apiKeyEnvVar}="your_api_key_here"`));
          }
        });
        console.log();
        console.log('2. Test your setup:');
        console.log(chalk.gray('   woaru analyze llm'));
        console.log();
        console.log('3. Run AI-powered code reviews:');
        console.log(chalk.gray('   woaru review git llm'));
        console.log(chalk.gray('   woaru review local llm'));
      } else {
        console.log(chalk.yellow('⚠️ No providers are enabled. Edit woaru.config.js to enable providers.'));
      }

    } catch (error) {
      console.error(
        chalk.red(
          `❌ LLM setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
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

// Supervisor Commands
program
  .command('watch')
  .description('Start WOARU supervisor to continuously monitor the project')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('--dashboard', 'Show live dashboard')
  .option('--auto-setup', 'Automatically setup recommended tools')
  .option('--auto-fix', 'Automatically fix issues when possible')
  .option('--webhook <url>', 'Send notifications to webhook URL')
  .option('--no-desktop', 'Disable desktop notifications')
  .option('--detached', 'Run supervisor in background (detached mode)')
  .action(async options => {
    try {
      if (supervisor) {
        console.log(
          chalk.yellow('Supervisor is already running. Use "woaru stop" first.')
        );
        return;
      }

      const projectPath = path.resolve(options.path);

      // Check if project path exists
      if (!(await fs.pathExists(projectPath))) {
        console.error(
          chalk.red(`❌ Project path does not exist: ${projectPath}`)
        );
        process.exit(1);
      }

      const config = {
        autoFix: options.autoFix,
        autoSetup: options.autoSetup,
        dashboard: options.dashboard,
        notifications: {
          terminal: true,
          desktop: false, // Disabled due to node-notifier EBADF crashes on large projects
          webhook: options.webhook,
        },
        ignoreTools: [],
        watchPatterns: ['**/*'],
      };

      supervisor = new WOARUSupervisor(projectPath, config);

      // Listen to supervisor events for activity
      supervisor.on('file-changed', (file: string) => {
        console.log(
          chalk.blue(`\n📝 File changed: ${path.relative(projectPath, file)}`)
        );
      });

      supervisor.on('recommendation', (rec: any) => {
        console.log(
          chalk.yellow(`\n💡 New recommendation: ${rec.tool} - ${rec.reason}`)
        );
      });

      // Handle graceful shutdown
      let heartbeatInterval: NodeJS.Timeout | undefined;

      const cleanup = async () => {
        console.log(chalk.yellow('\n📡 Shutting down supervisor...'));
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        if (supervisor) {
          await supervisor.stop();
          supervisor = null;
        }
        process.exit(0);
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);

      await supervisor.start();

      // Check if running in detached mode (but NOT for Claude Code environment)
      if (options.detached) {
        // Write PID file for detached mode
        const pidFile = path.join(projectPath, '.woaru', 'supervisor.pid');
        await fs.ensureDir(path.dirname(pidFile));
        await fs.writeFile(pidFile, process.pid.toString());

        console.log(chalk.green('✅ WOARU Supervisor started successfully!'));
        console.log(chalk.cyan(`📍 Project: ${projectPath}`));
        console.log(chalk.cyan(`🏃 Running in background mode`));
        console.log(chalk.gray(`   PID: ${process.pid}`));
        console.log(chalk.gray(`   PID file: ${pidFile}`));
        console.log();
        console.log(chalk.yellow('💡 Important commands:'));
        console.log(chalk.gray('   • Check status:  woaru status'));
        console.log(chalk.gray('   • View logs:     woaru logs'));
        console.log(chalk.gray('   • Stop watching: woaru stop'));
        console.log(chalk.gray('   • Get helpers:   woaru helpers'));
        console.log();
        console.log(
          chalk.blue('🔍 The supervisor is now analyzing your project...')
        );

        // In detached mode, run for a limited time to show initial analysis
        setTimeout(async () => {
          if (!supervisor) return;
          const status = supervisor.getStatus();
          console.log();
          console.log(chalk.green('📊 Initial Analysis Complete:'));
          console.log(chalk.gray(`   • Language: ${status.state.language}`));
          console.log(
            chalk.gray(`   • Health Score: ${status.state.healthScore}/100`)
          );
          console.log(chalk.gray(`   • Watched Files: ${status.watchedFiles}`));
          console.log(
            chalk.gray(
              `   • Detected Tools: ${Array.from(status.state.detectedTools).join(', ') || 'None'}`
            )
          );

          if (status.state.missingTools.size > 0) {
            console.log(
              chalk.yellow(
                `   • Missing Tools: ${Array.from(status.state.missingTools).join(', ')}`
              )
            );
          }

          console.log();
          console.log(
            chalk.cyan('✨ Supervisor is running in the background.')
          );
          console.log(
            chalk.cyan('   Use "woaru status" to check progress anytime.')
          );

          // Exit gracefully after showing initial status
          process.exit(0);
        }, 5000); // Wait 5 seconds for initial analysis

        return;
      }

      // Normal watch mode with aggressive heartbeat for Claude Code environment
      console.log(chalk.green('✅ WAU Supervisor started successfully!'));
      console.log(chalk.cyan(`📍 Project: ${projectPath}`));
      console.log(chalk.cyan(`👁️ Starting continuous monitoring...`));

      if (options.dashboard) {
        console.log(chalk.cyan('🎮 Dashboard mode - Press Ctrl+C to stop'));
        // Dashboard would be implemented here
      } else {
        console.log(
          chalk.cyan(
            '👁️  WOARU is watching your project - Press Ctrl+C to stop'
          )
        );
      }

      // AGGRESSIVE Keep-Alive Heartbeat - Every 1 second
      let heartbeatCount = 0;
      heartbeatInterval = setInterval(() => {
        heartbeatCount++;

        // Critical: Force immediate output flush with newline every second
        process.stdout.write(' \n'); // Minimal visible character + newline

        // Every 5 seconds, show heartbeat with timestamp
        if (heartbeatCount % 5 === 0) {
          const timestamp = new Date().toISOString().substr(11, 8); // HH:MM:SS
          process.stdout.write(
            chalk.gray(
              `⏱️  Watching... (${heartbeatCount}s elapsed, ${timestamp})\n`
            )
          );
        }

        // Every 30 seconds, show detailed status
        if (heartbeatCount % 30 === 0 && supervisor) {
          const status = supervisor.getStatus();
          console.log(
            chalk.blue(
              `📊 Status: ${status.watchedFiles} files monitored, Health: ${status.state.healthScore}/100`
            )
          );
          console.log(
            chalk.cyan(
              '👁️  WOARU is watching your project - Press Ctrl+C to stop'
            )
          );
        }

        // Force stdout flush to ensure output is immediately visible
        if ((process.stdout as any).flush) {
          (process.stdout as any).flush();
        }
      }, 1000); // Every 1 second - MUCH more aggressive!

      // Only use interactive features in real TTY environments
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        // Handle keyboard input
        process.stdin.on('data', data => {
          const key = data.toString();

          // Handle Ctrl+C manually in raw mode
          if (key === '\u0003') {
            cleanup();
            return;
          }

          // Handle 'q' for quit
          if (key === 'q' || key === 'Q') {
            cleanup();
            return;
          }
        });
      }

      // Keep process alive (only for real interactive environments)
      await new Promise(resolve => {
        process.on('SIGTERM', () => {
          console.log(chalk.yellow('\n📡 Received SIGTERM, shutting down...'));
          resolve(undefined);
        });

        supervisor?.on('stopped', resolve);
      });
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Failed to start supervisor: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show WOARU supervisor status and project health')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async options => {
    try {
      const projectPath = path.resolve(options.path);

      if (!supervisor) {
        // Check if there's a state file indicating a previous session
        const stateFile = path.join(projectPath, '.woaru', 'state.json');
        if (await fs.pathExists(stateFile)) {
          const state = await fs.readJson(stateFile);
          console.log(
            chalk.yellow(
              '📊 WOARU Status: Not running (previous session found)'
            )
          );
          console.log(
            chalk.gray(
              `   Last analysis: ${new Date(state.lastAnalysis).toLocaleString()}`
            )
          );
          console.log(chalk.gray(`   Language: ${state.language}`));
          console.log(chalk.gray(`   Health Score: ${state.healthScore}/100`));
          console.log(
            chalk.gray(`   Detected Tools: ${state.detectedTools.length}`)
          );
          console.log(chalk.cyan('\n💡 Run "woaru watch" to start monitoring'));
        } else {
          console.log(chalk.red('📊 WOARU Status: Not running'));
          console.log(chalk.cyan('💡 Run "woaru watch" to start monitoring'));
        }

        // Show LLM Information even when not running
        await showLLMStatus(projectPath);
        return;
      }

      const status = supervisor.getStatus();

      console.log(chalk.green('📊 WOARU Status: Running'));
      console.log(
        chalk.gray(`   Project: ${path.basename(status.state.projectPath)}`)
      );
      console.log(chalk.gray(`   Language: ${status.state.language}`));
      console.log(
        chalk.gray(
          `   Frameworks: ${status.state.frameworks.join(', ') || 'None'}`
        )
      );
      console.log(
        chalk.gray(`   Health Score: ${status.state.healthScore}/100`)
      );
      console.log(chalk.gray(`   Watched Files: ${status.watchedFiles}`));
      console.log(
        chalk.gray(
          `   Detected Tools: ${Array.from(status.state.detectedTools).join(', ')}`
        )
      );

      if (status.state.missingTools.size > 0) {
        console.log(
          chalk.yellow(
            `   Missing Tools: ${Array.from(status.state.missingTools).join(', ')}`
          )
        );
      }

      // Show LLM Information
      await showLLMStatus(projectPath);

    } catch (error) {
      console.error(
        chalk.red(
          `❌ Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });

program
  .command('stop')
  .description('Stop the WOARU supervisor')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async options => {
    try {
      const projectPath = path.resolve(options.path);
      const pidFile = path.join(projectPath, '.woaru', 'supervisor.pid');

      // First check if supervisor is running in current process
      if (supervisor) {
        await supervisor.stop();
        supervisor = null;
        console.log(chalk.green('✅ Supervisor stopped'));
        return;
      }

      // Check for PID file (background/detached mode)
      if (await fs.pathExists(pidFile)) {
        const pid = await fs.readFile(pidFile, 'utf8');
        console.log(chalk.yellow(`📊 No supervisor running in this process.`));
        console.log(chalk.gray(`   Found PID file: ${pid}`));
        console.log(
          chalk.gray(`   Note: Background supervisors auto-terminate.`)
        );

        // Clean up PID file
        await fs.remove(pidFile);
        console.log(chalk.green('✅ Cleaned up supervisor state'));
      } else {
        console.log(chalk.yellow('📊 No supervisor is currently running'));
      }
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Failed to stop supervisor: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });

program
  .command('logs')
  .description('Show supervisor logs')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-f, --follow', 'Follow logs in real-time')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action(async options => {
    try {
      const projectPath = path.resolve(options.path);
      const logFile = path.join(projectPath, '.woaru', 'supervisor.log');

      if (!(await fs.pathExists(logFile))) {
        console.log(
          chalk.yellow(
            '📊 No log file found. Start supervisor first with "woaru watch"'
          )
        );
        return;
      }

      console.log(chalk.cyan(`📄 Supervisor logs (${logFile}):`));
      console.log(chalk.gray('─'.repeat(50)));

      // For now, just indicate that logs would be shown
      console.log(
        chalk.gray('Log viewing functionality would be implemented here.')
      );
      console.log(
        chalk.blue('💡 Use "woaru status" to see current supervisor state.')
      );
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Failed to show logs: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });

program
  .command('recommendations')
  .description('Show current tool recommendations')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-j, --json', 'Output as JSON')
  .action(async options => {
    try {
      const projectPath = path.resolve(options.path);

      if (!supervisor) {
        console.log(
          chalk.yellow('📊 Supervisor not running. Starting quick analysis...')
        );
        // Fall back to one-time analysis
        const result = await wauEngine.analyzeProject(projectPath);

        if (options.json) {
          console.log(JSON.stringify(result.setup_recommendations, null, 2));
        } else {
          console.log(chalk.cyan('🔧 Quick Recommendations:'));
          result.setup_recommendations.forEach(rec =>
            console.log(`  • ${rec}`)
          );
        }
        return;
      }

      const recommendations = await supervisor.getCurrentRecommendations();

      if (options.json) {
        console.log(JSON.stringify(recommendations, null, 2));
        return;
      }

      if (recommendations.length === 0) {
        console.log(
          chalk.green('✅ No recommendations - your project looks good!')
        );
        return;
      }

      console.log(chalk.cyan('🔧 Current Recommendations:\n'));

      const byPriority = {
        critical: recommendations.filter(r => r.priority === 'critical'),
        high: recommendations.filter(r => r.priority === 'high'),
        medium: recommendations.filter(r => r.priority === 'medium'),
        low: recommendations.filter(r => r.priority === 'low'),
      };

      if (byPriority.critical.length > 0) {
        console.log(chalk.red('🔴 Critical:'));
        byPriority.critical.forEach(rec => {
          console.log(chalk.red(`   ${rec.tool}: ${rec.reason}`));
          if (rec.setupCommand) {
            console.log(chalk.gray(`     → ${rec.setupCommand}`));
          }
        });
        console.log();
      }

      if (byPriority.high.length > 0) {
        console.log(chalk.yellow('🟡 High Priority:'));
        byPriority.high.forEach(rec => {
          console.log(chalk.yellow(`   ${rec.tool}: ${rec.reason}`));
          if (rec.setupCommand) {
            console.log(chalk.gray(`     → ${rec.setupCommand}`));
          }
        });
        console.log();
      }

      if (byPriority.medium.length > 0) {
        console.log(chalk.blue('🔵 Medium Priority:'));
        byPriority.medium.forEach(rec => {
          console.log(chalk.blue(`   ${rec.tool}: ${rec.reason}`));
        });
        console.log();
      }

      if (byPriority.low.length > 0) {
        console.log(chalk.gray('⚪ Low Priority:'));
        byPriority.low.forEach(rec => {
          console.log(chalk.gray(`   ${rec.tool}: ${rec.reason}`));
        });
        console.log();
      }

      console.log(
        chalk.cyan('💡 Run "woaru setup" to install recommended tools')
      );
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Failed to get recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });

program
  .command('helpers')
  .description('Show all detected/activated development tools and helpers')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-j, --json', 'Output as JSON')
  .option('--missing', 'Show only missing/recommended tools')
  .option('--active', 'Show only active/detected tools')
  .action(async options => {
    try {
      const projectPath = path.resolve(options.path);

      if (!supervisor) {
        // Use quick analysis if supervisor not running
        console.log(
          chalk.yellow(
            '📊 Supervisor not running. Performing quick analysis...'
          )
        );

        // Get both analysis result and project analysis
        const result = await wauEngine.analyzeProject(projectPath);
        const projectAnalyzer = new ProjectAnalyzer();
        const projectAnalysis =
          await projectAnalyzer.analyzeProject(projectPath);

        if (options.json) {
          const output = {
            active_tools: result.installed_tools_detected || [],
            recommended_tools: result.setup_recommendations || [],
            project: {
              language: projectAnalysis.language || 'Unknown',
              frameworks: projectAnalysis.framework || [],
            },
          };
          console.log(JSON.stringify(output, null, 2));
          return;
        }

        console.log(
          chalk.cyan(`🔧 Development Tools for ${path.basename(projectPath)}\n`)
        );

        if (
          result.installed_tools_detected &&
          result.installed_tools_detected.length > 0
        ) {
          console.log(chalk.green('✅ Active Tools:'));
          result.installed_tools_detected.forEach(tool => {
            console.log(chalk.green(`   ✓ ${tool}`));
          });
          console.log();
        }

        if (
          result.setup_recommendations &&
          result.setup_recommendations.length > 0
        ) {
          console.log(chalk.yellow('🔧 Recommended Tools:'));
          result.setup_recommendations.forEach(rec => {
            console.log(chalk.yellow(`   → ${rec}`));
          });
          console.log();
        }

        if (
          (!result.installed_tools_detected ||
            result.installed_tools_detected.length === 0) &&
          (!result.setup_recommendations ||
            result.setup_recommendations.length === 0)
        ) {
          console.log(chalk.gray('No tools detected or recommended.'));
        }

        console.log(
          chalk.cyan(
            '💡 Start supervisor with "woaru watch" for real-time monitoring'
          )
        );
        return;
      }

      // Use supervisor data if available
      const status = supervisor.getStatus();
      const recommendations = await supervisor.getCurrentRecommendations();

      if (options.json) {
        const output = {
          active_tools: Array.from(status.state.detectedTools),
          missing_tools: Array.from(status.state.missingTools),
          recommended_tools: recommendations.map(r => ({
            tool: r.tool,
            priority: r.priority,
            reason: r.reason,
            category: r.category,
          })),
          project: {
            language: status.state.language,
            frameworks: status.state.frameworks,
            health_score: status.state.healthScore,
            watched_files: status.watchedFiles,
          },
          supervisor_running: status.isRunning,
        };
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      // Terminal output
      console.log(
        chalk.cyan(
          `🔧 Development Tools for ${path.basename(status.state.projectPath)}`
        )
      );
      console.log(
        chalk.gray(
          `   Language: ${status.state.language} | Health Score: ${status.state.healthScore}/100\n`
        )
      );

      // Active tools
      if (!options.missing && status.state.detectedTools.size > 0) {
        console.log(chalk.green('✅ Active Tools:'));
        Array.from(status.state.detectedTools)
          .sort()
          .forEach(tool => {
            console.log(chalk.green(`   ✓ ${tool}`));
          });
        console.log();
      }

      // Missing/Recommended tools
      if (!options.active) {
        const missingTools = Array.from(status.state.missingTools);
        const recommendedTools = recommendations.filter(
          r => !status.state.detectedTools.has(r.tool)
        );

        if (missingTools.length > 0 || recommendedTools.length > 0) {
          console.log(chalk.yellow('🔧 Recommended Tools:'));

          // Group by priority
          const byPriority = {
            critical: recommendedTools.filter(r => r.priority === 'critical'),
            high: recommendedTools.filter(r => r.priority === 'high'),
            medium: recommendedTools.filter(r => r.priority === 'medium'),
            low: recommendedTools.filter(r => r.priority === 'low'),
          };

          if (byPriority.critical.length > 0) {
            byPriority.critical.forEach(rec => {
              console.log(
                chalk.red(`   🔴 ${rec.tool} (${rec.category}) - ${rec.reason}`)
              );
            });
          }

          if (byPriority.high.length > 0) {
            byPriority.high.forEach(rec => {
              console.log(
                chalk.yellow(
                  `   🟡 ${rec.tool} (${rec.category}) - ${rec.reason}`
                )
              );
            });
          }

          if (byPriority.medium.length > 0) {
            byPriority.medium.forEach(rec => {
              console.log(chalk.blue(`   🔵 ${rec.tool} (${rec.category})`));
            });
          }

          if (byPriority.low.length > 0) {
            byPriority.low.forEach(rec => {
              console.log(chalk.gray(`   ⚪ ${rec.tool} (${rec.category})`));
            });
          }

          // Show missing tools not in recommendations
          missingTools
            .filter(tool => !recommendedTools.some(r => r.tool === tool))
            .forEach(tool => {
              console.log(chalk.gray(`   → ${tool}`));
            });

          console.log();
        }
      }

      // Tool categories breakdown
      if (!options.missing && !options.active) {
        const allTools = Array.from(status.state.detectedTools);
        const categories = {
          linter: allTools.filter(t =>
            ['eslint', 'ruff', 'clippy', 'golangci-lint'].includes(t)
          ),
          formatter: allTools.filter(t =>
            ['prettier', 'black', 'rustfmt'].includes(t)
          ),
          test: allTools.filter(t => ['jest', 'pytest', 'vitest'].includes(t)),
          'git-hook': allTools.filter(t => ['husky', 'pre-commit'].includes(t)),
          build: allTools.filter(t =>
            ['typescript', 'webpack', 'vite'].includes(t)
          ),
        };

        console.log(chalk.cyan('📊 Tool Categories:'));
        Object.entries(categories).forEach(([category, tools]) => {
          if (tools.length > 0) {
            console.log(chalk.gray(`   ${category}: ${tools.join(', ')}`));
          }
        });
        console.log();
      }

      // Summary
      const totalActive = status.state.detectedTools.size;
      const totalMissing = status.state.missingTools.size;
      const coverage =
        totalActive + totalMissing > 0
          ? Math.round((totalActive / (totalActive + totalMissing)) * 100)
          : 100;

      console.log(
        chalk.cyan(
          `📈 Summary: ${totalActive} active, ${totalMissing} recommended (${coverage}% coverage)`
        )
      );

      if (recommendations.length > 0) {
        console.log(
          chalk.gray(`💡 Run "wau setup" to install recommended tools`)
        );
      }
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Failed to show helpers: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });

program
  .command('ignore')
  .description('Add a tool to the ignore list')
  .argument('<tool>', 'Tool name to ignore')
  .action(tool => {
    try {
      if (!supervisor) {
        console.log(
          chalk.yellow(
            '📊 Supervisor not running. Tool will be ignored when supervisor starts.'
          )
        );
        // Could save to config file
        return;
      }

      supervisor.addIgnoredTool(tool);
      console.log(chalk.green(`✅ Tool "${tool}" added to ignore list`));
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Failed to ignore tool: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });

// Helper function for AI Review with comprehensive reporting
async function runAIReviewAnalysis(
  fileList: string[],
  projectPath: string,
  options: any,
  context: { type: 'git' | 'local' | 'path'; description: string }
) {
  if (fileList.length === 0) {
    console.log(chalk.green('✅ No files found for analysis.'));
    return;
  }

  console.log(chalk.cyan(`📋 Found ${fileList.length} files for LLM analysis:`));
  fileList.forEach(file => {
    console.log(chalk.gray(`   • ${path.relative(projectPath, file)}`));
  });

  // Load AI configuration
  const { ConfigLoader } = await import('./ai/ConfigLoader');
  const { AIReviewAgent } = await import('./ai/AIReviewAgent');
  
  const configLoader = ConfigLoader.getInstance();
  const aiConfig = await configLoader.loadConfig(projectPath);
  
  if (!aiConfig) {
    console.log(chalk.red('❌ No AI configuration found.'));
    console.log(chalk.yellow('💡 Create woaru.config.js to enable AI features.'));
    console.log(chalk.gray('📄 See woaru.config.example.js for template.'));
    process.exit(1);
  }

  const enabledProviders = aiConfig.providers.filter(p => p.enabled);
  if (enabledProviders.length === 0) {
    console.log(chalk.red('❌ No LLM providers enabled.'));
    console.log(chalk.yellow('💡 Enable providers in woaru.config.js.'));
    process.exit(1);
  }

  // Show transparent output about which LLMs will be contacted
  const llmNames = enabledProviders.map(p => `${p.id} (${p.model})`).join(', ');
  console.log(chalk.cyan(`🧠 Kontaktiere ${enabledProviders.length} LLMs für Analyse: ${llmNames}`));

  const aiAgent = new AIReviewAgent(aiConfig);
  const aiReviewResults = await runAIReviewOnFiles(aiAgent, fileList, projectPath);

  // Import report generator
  const { ReviewReportGenerator } = await import('./reports/ReviewReportGenerator');
  const reportGenerator = new ReviewReportGenerator();

  // Generate report with AI results
  const reportData = {
    context,
    gitDiff: {
      changedFiles: fileList,
      baseBranch: options.branch || (context.type === 'git' ? 'main' : ''),
      totalChanges: fileList.length,
    },
    qualityResults: [], // Empty for LLM-only analysis
    securityResults: [], // Empty for LLM-only analysis  
    productionAudits: [], // Empty for LLM-only analysis
    aiReviewResults, // AI review results
    currentBranch: '',
    commits: [],
  };

  if (options.json) {
    const jsonReport = reportGenerator.generateJsonReport(reportData);
    console.log(jsonReport);
  } else {
    const woaruDir = path.join(projectPath, '.woaru');
    await fs.ensureDir(woaruDir);
    const defaultOutput = path.join(woaruDir, 'woaru-llm-review.md');
    const outputPath = options.output ? path.resolve(projectPath, options.output) : defaultOutput;
    await reportGenerator.generateMarkdownReport(reportData, outputPath);

    console.log(
      chalk.green(`\n✅ LLM Review report generated: ${path.basename(outputPath)}`)
    );
    
    // Show summary
    const aiSummary = aiReviewResults.summary;
    console.log(chalk.cyan(`📊 ${aiSummary.filesAnalyzed} files analyzed, ${aiSummary.totalFindings} findings`));
    if (aiSummary.estimatedCost > 0) {
      console.log(chalk.gray(`💰 Total cost: $${aiSummary.estimatedCost.toFixed(4)}`));
    }

    console.log(
      chalk.yellow(
        `\n💡 Open ${path.basename(outputPath)} to see detailed LLM findings`
      )
    );
  }
}

// Helper function for AI Review on multiple files
async function runAIReviewOnFiles(aiAgent: any, fileList: string[], projectPath: string) {
  const allResults: any[] = [];
  
  console.log(chalk.blue(`🧠 Running AI Code Review on ${fileList.length} files...`));
  
  // Process files in batches to avoid token limits
  const batchSize = 3; // Process max 3 files at once to stay within token limits
  const batches = [];
  for (let i = 0; i < fileList.length; i += batchSize) {
    batches.push(fileList.slice(i, i + batchSize));
  }
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(chalk.cyan(`  📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} files)`));
    
    for (const filePath of batch) {
      try {
        // Skip non-code files
        const ext = path.extname(filePath).toLowerCase();
        const codeExtensions = ['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt'];
        
        if (!codeExtensions.includes(ext)) {
          console.log(chalk.gray(`    ⏭️ Skipping non-code file: ${path.relative(projectPath, filePath)}`));
          continue;
        }
        
        // Read file content
        const content = await fs.readFile(filePath, 'utf-8');
        if (!content.trim()) {
          console.log(chalk.gray(`    ⏭️ Skipping empty file: ${path.relative(projectPath, filePath)}`));
          continue;
        }
        
        // Check file size (rough token estimate: 1 token ≈ 4 characters)
        if (content.length > 32000) { // ~8k tokens
          console.log(chalk.yellow(`    ⚠️ Skipping large file (${Math.round(content.length / 1000)}kb): ${path.relative(projectPath, filePath)}`));
          continue;
        }
        
        console.log(chalk.blue(`    🔍 Analyzing: ${path.relative(projectPath, filePath)}`));
        
        // Detect language from extension
        const languageMap: Record<string, string> = {
          '.js': 'javascript',
          '.jsx': 'javascript',
          '.ts': 'typescript',
          '.tsx': 'typescript',
          '.py': 'python',
          '.java': 'java',
          '.cpp': 'cpp',
          '.c': 'c',
          '.cs': 'csharp',
          '.go': 'go',
          '.rs': 'rust',
          '.php': 'php',
          '.rb': 'ruby',
          '.swift': 'swift',
          '.kt': 'kotlin'
        };
        
        const language = languageMap[ext] || 'text';
        const totalLines = content.split('\\n').length;
        
        // Create code context
        const codeContext = {
          filePath: path.relative(projectPath, filePath),
          language,
          totalLines,
          projectContext: {
            name: path.basename(projectPath),
            type: 'application' as const,
            dependencies: [] // Could be enhanced to read from package.json, etc.
          }
        };
        
        // Run AI review
        const result = await aiAgent.performMultiLLMReview(content, codeContext);
        allResults.push(result);
        
        // Show immediate summary
        const totalFindings = result.aggregation.totalFindings;
        if (totalFindings > 0) {
          console.log(chalk.yellow(`      📊 Found ${totalFindings} potential issues`));
          
          // Show critical findings immediately
          const criticalFindings = Object.values(result.results)
            .flat()
            .filter((finding: any) => finding.severity === 'critical')
            .slice(0, 2);
            
          criticalFindings.forEach((finding: any) => {
            console.log(chalk.red(`        🔴 ${finding.message}`));
          });
        } else {
          console.log(chalk.green(`      ✅ No issues found`));
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(chalk.red(`    ❌ Failed to analyze ${path.relative(projectPath, filePath)}: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    }
  }
  
  // Calculate summary
  const totalFiles = allResults.length;
  const totalFindings = allResults.reduce((sum, result) => sum + result.aggregation.totalFindings, 0);
  const totalCost = allResults.reduce((sum, result) => sum + result.meta.totalEstimatedCost, 0);
  
  console.log(chalk.green(`\\n✅ AI Code Review complete!`));
  console.log(chalk.cyan(`  📊 Analyzed: ${totalFiles} files`));
  console.log(chalk.cyan(`  🔍 Found: ${totalFindings} total findings`));
  console.log(chalk.cyan(`  💰 Cost: $${totalCost.toFixed(4)}`));
  
  return {
    results: allResults,
    summary: {
      filesAnalyzed: totalFiles,
      totalFindings,
      estimatedCost: totalCost,
      timestamp: new Date().toISOString()
    }
  };
}

// Helper function for review analysis
async function runReviewAnalysis(
  fileList: string[],
  projectPath: string,
  options: any,
  context: { type: 'git' | 'local' | 'path'; description: string }
) {
  if (fileList.length === 0) {
    console.log(chalk.green('✅ No files found for analysis.'));
    return;
  }

  console.log(chalk.cyan(`📋 Found ${fileList.length} files for analysis:`));
  fileList.forEach(file => {
    console.log(chalk.gray(`   • ${path.relative(projectPath, file)}`));
  });

  // Dynamic imports for review components
  const { GitDiffAnalyzer } = await import('./utils/GitDiffAnalyzer');
  const { QualityRunner } = await import('./quality/QualityRunner');
  const { ProductionReadinessAuditor } = await import(
    './auditor/ProductionReadinessAuditor'
  );
  const { ReviewReportGenerator } = await import(
    './reports/ReviewReportGenerator'
  );
  const { LanguageDetector } = await import('./analyzer/LanguageDetector');
  const { NotificationManager } = await import(
    './supervisor/NotificationManager'
  );


  console.log(chalk.blue('🔍 Running quality checks on files...'));

  // Initialize components
  const gitAnalyzer = new GitDiffAnalyzer(projectPath);
  const notificationManager = new NotificationManager({
    terminal: true,
    desktop: false,
  });
  const qualityRunner = new QualityRunner(notificationManager);
  const productionAuditor = new ProductionReadinessAuditor(projectPath);
  const languageDetector = new LanguageDetector();
  const reportGenerator = new ReviewReportGenerator();

  // Get git info (if applicable)
  let currentBranch = '';
  let commits: any[] = [];
  try {
    currentBranch = await gitAnalyzer.getCurrentBranch();
    if (context.type === 'git') {
      commits = await gitAnalyzer.getCommitsSince(options.branch || 'main');
    }
  } catch (error) {
    // Git operations might fail for non-git contexts
  }

  // Detect language and frameworks
  const language = await languageDetector.detectPrimaryLanguage(projectPath);
  const frameworks = await languageDetector.detectFrameworks(
    projectPath,
    language
  );

  // Run quality checks
  const qualityResults = await qualityRunner.runChecksOnFileList(fileList);

  // Run comprehensive security checks (Snyk + Gitleaks)
  console.log(chalk.blue('🔒 Running comprehensive security analysis...'));
  const securityResults =
    await qualityRunner.runSecurityChecksForReview(fileList);

  // Log critical security issues immediately
  securityResults.forEach(result => {
    if (
      result.summary &&
      (result.summary.critical > 0 || result.summary.high > 0)
    ) {
      console.log(
        chalk.red(
          `\n🚨 SECURITY ALERT (${result.tool.toUpperCase()}): Found ${result.summary.critical} critical and ${result.summary.high} high severity issues!`
        )
      );

      // Show most critical findings immediately
      const criticalFindings = result.findings
        .filter(f => f.severity === 'critical')
        .slice(0, 3);
      criticalFindings.forEach(finding => {
        console.log(chalk.red(`   🔴 ${finding.title}`));
        if (finding.package) {
          console.log(
            chalk.red(`      Package: ${finding.package}@${finding.version}`)
          );
        }
        if (finding.file && finding.line) {
          console.log(
            chalk.red(`      Location: ${finding.file}:${finding.line}`)
          );
        }
      });
    }
  });

  // Run production audit on files
  const auditConfig = {
    language,
    frameworks,
    projectType: 'fullstack' as const,
  };
  const productionAudits = await productionAuditor.auditChangedFiles(
    fileList,
    auditConfig
  );

  // Generate report
  const reportData = {
    context,
    gitDiff: {
      changedFiles: fileList,
      baseBranch: options.branch || (context.type === 'git' ? 'main' : ''),
      totalChanges: fileList.length,
    },
    qualityResults,
    securityResults,
    productionAudits,
    currentBranch,
    commits,
  };

  if (options.json) {
    const jsonReport = reportGenerator.generateJsonReport(reportData);
    console.log(jsonReport);
  } else {
    const woaruDir = path.join(projectPath, '.woaru');
    await fs.ensureDir(woaruDir);
    const defaultOutput = path.join(woaruDir, 'woaru-review.md');
    const outputPath = options.output ? path.resolve(projectPath, options.output) : defaultOutput;
    await reportGenerator.generateMarkdownReport(reportData, outputPath);

    console.log(
      chalk.green(`\n✅ Review report generated: ${path.basename(outputPath)}`)
    );
    console.log(
      chalk.cyan(`📊 ${reportGenerator.getReportSummary(reportData)}`)
    );

    if (qualityResults.length > 0 || productionAudits.length > 0) {
      console.log(
        chalk.yellow(
          `\n💡 Open ${path.basename(outputPath)} to see detailed findings`
        )
      );
    }
  }
}

// Review command with sub-commands
const reviewCommand = program
  .command('review')
  .description('Code review and analysis tools')
  .addHelpText(
    'after',
    `
Examples:
  woaru analyze llm                       # AI analysis of entire project
  woaru review git                        # Analyze changes since main branch
  woaru review git llm                    # AI analysis of git changes
  woaru review local                      # Analyze uncommitted changes
  woaru review local llm                  # AI analysis of uncommitted changes
  woaru review path src/components        # Analyze specific directory
  woaru review path src/components llm    # AI analysis of specific directory
`
  );

// Review git sub-command (original review functionality)  
const gitCommand = reviewCommand
  .command('git')
  .description('Analyze changes since a specific branch (git diff)')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-b, --branch <branch>', 'Base branch to compare against', 'main')
  .option(
    '-o, --output <file>',
    'Output file for review report',
    path.join('.woaru', 'woaru-review.md')
  )
  .option('-j, --json', 'Output as JSON instead of markdown')
  .action(async options => {
    try {
      const projectPath = path.resolve(options.path);

      // Check if we're in a git repository
      if (!(await fs.pathExists(path.join(projectPath, '.git')))) {
        console.error(
          chalk.red('❌ Not a git repository. Git review requires git.')
        );
        process.exit(1);
      }

      console.log(
        chalk.blue(`🔍 Analyzing changes since branch: ${options.branch}`)
      );

      // Get list of changed files using git diff
      const { spawn } = require('child_process');
      const gitProcess = spawn(
        'git',
        ['diff', '--name-only', `${options.branch}...HEAD`],
        {
          cwd: projectPath,
          stdio: 'pipe',
        }
      );

      let changedFiles = '';
      let gitError = '';

      gitProcess.stdout.on('data', (data: Buffer) => {
        changedFiles += data.toString();
      });

      gitProcess.stderr.on('data', (data: Buffer) => {
        gitError += data.toString();
      });

      gitProcess.on('close', async (code: number) => {
        if (code !== 0) {
          console.error(chalk.red(`❌ Git command failed: ${gitError}`));
          process.exit(1);
        }

        const fileList = changedFiles
          .trim()
          .split('\n')
          .filter(file => file.length > 0)
          .map(file => path.join(projectPath, file));

        if (fileList.length === 0) {
          console.log(
            chalk.green('✅ No changes detected since the base branch.')
          );
          return;
        }

        await runReviewAnalysis(fileList, projectPath, options, {
          type: 'git',
          description: `Changes since branch: ${options.branch}`,
        });
      });
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Git review failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });

// Add LLM sub-command to git review
gitCommand
  .command('llm')
  .description('AI-powered analysis of git changes using multiple LLMs')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-b, --branch <branch>', 'Base branch to compare against', 'main')
  .option(
    '-o, --output <file>',
    'Output file for LLM review report',
    path.join('.woaru', 'woaru-llm-review.md')
  )
  .option('-j, --json', 'Output as JSON instead of markdown')
  .action(async options => {
    try {
      const projectPath = path.resolve(options.path);

      // Check if we're in a git repository
      if (!(await fs.pathExists(path.join(projectPath, '.git')))) {
        console.error(
          chalk.red('❌ Not a git repository. Git review requires git.')
        );
        process.exit(1);
      }

      console.log(
        chalk.blue(`🧠 Running LLM analysis on changes since branch: ${options.branch}`)
      );

      // Get list of changed files using git diff
      const { spawn } = require('child_process');
      const gitProcess = spawn(
        'git',
        ['diff', '--name-only', `${options.branch}...HEAD`],
        {
          cwd: projectPath,
          stdio: 'pipe',
        }
      );

      let changedFiles = '';
      let gitError = '';

      gitProcess.stdout.on('data', (data: Buffer) => {
        changedFiles += data.toString();
      });

      gitProcess.stderr.on('data', (data: Buffer) => {
        gitError += data.toString();
      });

      gitProcess.on('close', async (code: number) => {
        if (code !== 0) {
          console.error(chalk.red(`❌ Git command failed: ${gitError}`));
          process.exit(1);
        }

        const fileList = changedFiles
          .trim()
          .split('\n')
          .filter(file => file.length > 0)
          .map(file => path.join(projectPath, file));

        if (fileList.length === 0) {
          console.log(
            chalk.green('✅ No changes detected since the base branch.')
          );
          return;
        }

        await runAIReviewAnalysis(fileList, projectPath, options, {
          type: 'git',
          description: `LLM analysis of changes since branch: ${options.branch}`,
        });
      });
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Git LLM review failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });

// Review local sub-command (uncommitted changes)
const localCommand = reviewCommand
  .command('local')
  .description('Analyze uncommitted changes in working directory')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option(
    '-o, --output <file>',
    'Output file for review report',
    path.join('.woaru', 'woaru-review.md')
  )
  .option('-j, --json', 'Output as JSON instead of markdown')
  .action(async options => {
    try {
      const projectPath = path.resolve(options.path);

      // Check if we're in a git repository
      if (!(await fs.pathExists(path.join(projectPath, '.git')))) {
        console.error(
          chalk.red('❌ Not a git repository. Local review requires git.')
        );
        process.exit(1);
      }

      console.log(chalk.blue('🔍 Analyzing uncommitted changes...'));

      // Get list of uncommitted files using git status
      const { spawn } = require('child_process');
      const gitProcess = spawn('git', ['status', '--porcelain'], {
        cwd: projectPath,
        stdio: 'pipe',
      });

      let statusOutput = '';
      let gitError = '';

      gitProcess.stdout.on('data', (data: Buffer) => {
        statusOutput += data.toString();
      });

      gitProcess.stderr.on('data', (data: Buffer) => {
        gitError += data.toString();
      });

      gitProcess.on('close', async (code: number) => {
        if (code !== 0) {
          console.error(chalk.red(`❌ Git status failed: ${gitError}`));
          process.exit(1);
        }

        // Parse git status --porcelain output
        const fileList = statusOutput
          .trim()
          .split('\n')
          .filter(line => line.length > 0)
          .map(line => {
            // Format: XY filename (where X and Y are status codes)
            const filename = line.substring(3);
            return path.join(projectPath, filename);
          })
          .filter(filePath => {
            // Only include files that exist (not deleted)
            try {
              return fs.existsSync(filePath);
            } catch {
              return false;
            }
          });

        if (fileList.length === 0) {
          console.log(chalk.green('✅ No uncommitted changes found.'));
          return;
        }

        await runReviewAnalysis(fileList, projectPath, options, {
          type: 'local',
          description: 'Uncommitted changes in working directory',
        });
      });
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Local review failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });

// Add LLM sub-command to local review
localCommand
  .command('llm')
  .description('AI-powered analysis of uncommitted changes using multiple LLMs')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option(
    '-o, --output <file>',
    'Output file for LLM review report',
    path.join('.woaru', 'woaru-llm-review.md')
  )
  .option('-j, --json', 'Output as JSON instead of markdown')
  .action(async options => {
    try {
      const projectPath = path.resolve(options.path);

      // Check if we're in a git repository
      if (!(await fs.pathExists(path.join(projectPath, '.git')))) {
        console.error(
          chalk.red('❌ Not a git repository. Local review requires git.')
        );
        process.exit(1);
      }

      console.log(chalk.blue('🧠 Running LLM analysis on uncommitted changes...'));

      // Get list of uncommitted files using git status
      const { spawn } = require('child_process');
      const gitProcess = spawn('git', ['status', '--porcelain'], {
        cwd: projectPath,
        stdio: 'pipe',
      });

      let statusOutput = '';
      let gitError = '';

      gitProcess.stdout.on('data', (data: Buffer) => {
        statusOutput += data.toString();
      });

      gitProcess.stderr.on('data', (data: Buffer) => {
        gitError += data.toString();
      });

      gitProcess.on('close', async (code: number) => {
        if (code !== 0) {
          console.error(chalk.red(`❌ Git status failed: ${gitError}`));
          process.exit(1);
        }

        // Parse git status --porcelain output
        const fileList = statusOutput
          .trim()
          .split('\n')
          .filter(line => line.length > 0)
          .map(line => {
            // Format: XY filename (where X and Y are status codes)
            const filename = line.substring(3);
            return path.join(projectPath, filename);
          })
          .filter(filePath => {
            // Only include files that exist (not deleted)
            try {
              return fs.existsSync(filePath);
            } catch {
              return false;
            }
          });

        if (fileList.length === 0) {
          console.log(chalk.green('✅ No uncommitted changes found.'));
          return;
        }

        await runAIReviewAnalysis(fileList, projectPath, options, {
          type: 'local',
          description: 'LLM analysis of uncommitted changes in working directory',
        });
      });
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Local LLM review failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });

// Review path sub-command (specific files/directories)
const pathCommand = reviewCommand
  .command('path <file_or_directory>')
  .description('Analyze specific files or directories')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option(
    '-o, --output <file>',
    'Output file for review report',
    path.join('.woaru', 'woaru-review.md')
  )
  .option('-j, --json', 'Output as JSON instead of markdown')
  .action(async (targetPath, options) => {
    try {
      const projectPath = path.resolve(options.path);
      const absoluteTargetPath = path.resolve(projectPath, targetPath);

      console.log(chalk.blue(`🔍 Analyzing path: ${targetPath}`));

      // Check if target path exists
      if (!(await fs.pathExists(absoluteTargetPath))) {
        console.error(chalk.red(`❌ Path does not exist: ${targetPath}`));
        process.exit(1);
      }

      let fileList: string[] = [];
      const stat = await fs.stat(absoluteTargetPath);

      if (stat.isFile()) {
        fileList = [absoluteTargetPath];
      } else if (stat.isDirectory()) {
        // Get all files in directory recursively
        const { glob } = await import('glob');
        const globPattern = path.join(absoluteTargetPath, '**/*');
        fileList = await glob(globPattern, {
          ignore: [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/build/**',
          ],
        });
        // Filter to only include files (not directories)
        fileList = fileList.filter(file => {
          try {
            return fs.statSync(file).isFile();
          } catch {
            return false;
          }
        });
      }

      if (fileList.length === 0) {
        console.log(chalk.yellow('⚠️ No files found in the specified path.'));
        return;
      }

      await runReviewAnalysis(fileList, projectPath, options, {
        type: 'path',
        description: `Analysis of path: ${targetPath}`,
      });
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Path review failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });

// Add LLM sub-command to path review
pathCommand
  .command('llm')
  .description('AI-powered analysis of specific files or directories using multiple LLMs')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option(
    '-o, --output <file>',
    'Output file for LLM review report',
    path.join('.woaru', 'woaru-llm-review.md')
  )
  .option('-j, --json', 'Output as JSON instead of markdown')
  .action(async (targetPath: string, options: any) => {
    try {
      const projectPath = path.resolve(options.path);
      const absoluteTargetPath = path.resolve(projectPath, targetPath);

      console.log(chalk.blue(`🧠 Running LLM analysis on path: ${targetPath}`));

      // Check if target path exists
      if (!(await fs.pathExists(absoluteTargetPath))) {
        console.error(chalk.red(`❌ Path does not exist: ${targetPath}`));
        process.exit(1);
      }

      let fileList: string[] = [];
      const stat = await fs.stat(absoluteTargetPath);

      if (stat.isFile()) {
        fileList = [absoluteTargetPath];
      } else if (stat.isDirectory()) {
        // Get all files in directory recursively
        const { glob } = await import('glob');
        const globPattern = path.join(absoluteTargetPath, '**/*');
        fileList = await glob(globPattern, {
          ignore: [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/build/**',
          ],
        });
        // Filter to only include files (not directories)
        fileList = fileList.filter(file => {
          try {
            return fs.statSync(file).isFile();
          } catch {
            return false;
          }
        });
      }

      if (fileList.length === 0) {
        console.log(chalk.yellow('⚠️ No files found in the specified path.'));
        return;
      }

      await runAIReviewAnalysis(fileList, projectPath, options, {
        type: 'path',
        description: `LLM analysis of path: ${targetPath}`,
      });
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Path LLM review failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });

// Analyze command with sub-commands
const analyzeCommand = program
  .command('analyze')
  .description('Comprehensive project analysis including security audit');

// Main analyze command
analyzeCommand
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-j, --json', 'Output as JSON')
  .option('--no-security', 'Skip security analysis')
  .action(async options => {
    try {
      const projectPath = path.resolve(options.path);

      console.log(chalk.blue('🔍 Running comprehensive project analysis...'));

      // Run analysis
      const result = await wauEngine.analyzeProject(projectPath);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Display results
      console.log(
        chalk.cyan(`\n📊 Analysis Results for ${path.basename(projectPath)}\n`)
      );

      // Security Summary (most important - display first)
      if (result.security_summary && !options.noSecurity) {
        const security = result.security_summary;
        const healthColor =
          security.health_score >= 80
            ? chalk.green
            : security.health_score >= 60
              ? chalk.yellow
              : chalk.red;

        console.log(chalk.cyan.bold('🔒 SECURITY ANALYSIS'));
        console.log(chalk.gray('─'.repeat(40)));
        console.log(
          healthColor(`Security Health Score: ${security.health_score}/100`)
        );

        if (security.total_issues > 0) {
          console.log(chalk.red(`🚨 Total Issues: ${security.total_issues}`));
          if (security.critical > 0) {
            console.log(chalk.red(`   ├─ Critical: ${security.critical}`));
          }
          if (security.high > 0) {
            console.log(chalk.yellow(`   ├─ High: ${security.high}`));
          }
          if (security.medium > 0) {
            console.log(chalk.blue(`   ├─ Medium: ${security.medium}`));
          }
          if (security.low > 0) {
            console.log(chalk.gray(`   └─ Low: ${security.low}`));
          }

          // Show detailed security findings with precise locations
          if (
            result.detailed_security &&
            result.detailed_security.dependency_vulnerabilities
          ) {
            console.log(
              chalk.red.bold('\n🔍 DETAILLIERTE SICHERHEITSPROBLEME:')
            );
            console.log(chalk.gray('─'.repeat(50)));

            result.detailed_security.dependency_vulnerabilities.forEach(
              (scanResult: any) => {
                if (scanResult.error) {
                  console.log(
                    chalk.red(`⚠️ ${scanResult.tool}: ${scanResult.error}`)
                  );
                  return;
                }

                if (scanResult.findings && scanResult.findings.length > 0) {
                  console.log(
                    chalk.cyan(`\n📦 ${scanResult.tool.toUpperCase()}-Befunde:`)
                  );

                  // Group findings by severity
                  const critical = scanResult.findings.filter(
                    (f: any) => f.severity === 'critical'
                  );
                  const high = scanResult.findings.filter(
                    (f: any) => f.severity === 'high'
                  );
                  const medium = scanResult.findings.filter(
                    (f: any) => f.severity === 'medium'
                  );

                  [
                    { label: 'KRITISCH', findings: critical, color: chalk.red },
                    { label: 'HOCH', findings: high, color: chalk.yellow },
                    { label: 'MITTEL', findings: medium, color: chalk.blue },
                  ].forEach(({ label, findings, color }) => {
                    if (findings.length > 0) {
                      console.log(color(`\n  ${label} (${findings.length}):`));
                      findings
                        .slice(0, 5)
                        .forEach((finding: any, index: number) => {
                          console.log(
                            color(`  ${index + 1}. ${finding.title}`)
                          );

                          // Show precise location
                          if (finding.package && finding.version) {
                            console.log(
                              chalk.gray(
                                `     📍 Paket: ${finding.package}@${finding.version}`
                              )
                            );
                          }
                          if (finding.file) {
                            const location = finding.line
                              ? `${finding.file}:${finding.line}`
                              : finding.file;
                            console.log(
                              chalk.gray(`     📍 Datei: ${location}`)
                            );
                          }
                          if (finding.cve) {
                            console.log(
                              chalk.gray(`     🆔 CVE: ${finding.cve}`)
                            );
                          }

                          // Show why this is problematic
                          if (finding.description) {
                            console.log(
                              chalk.gray(
                                `     💡 Problem: ${finding.description.slice(0, 100)}${finding.description.length > 100 ? '...' : ''}`
                              )
                            );
                          }

                          // Show fix recommendation
                          if (finding.recommendation) {
                            console.log(
                              chalk.green(
                                `     🔧 Lösung: ${finding.recommendation}`
                              )
                            );
                          }

                          console.log('');
                        });

                      if (findings.length > 5) {
                        console.log(
                          chalk.gray(
                            `     ... und ${findings.length - 5} weitere ${label}-Probleme`
                          )
                        );
                      }
                    }
                  });
                }
              }
            );

            // Show recommendations summary
            if (
              security.recommendations &&
              security.recommendations.length > 0
            ) {
              console.log(chalk.yellow.bold('\n💡 SICHERHEITS-EMPFEHLUNGEN:'));
              console.log(chalk.gray('─'.repeat(50)));
              security.recommendations
                .slice(0, 3)
                .forEach((rec: string, index: number) => {
                  console.log(chalk.yellow(`${index + 1}. ${rec}`));
                });
              if (security.recommendations.length > 3) {
                console.log(
                  chalk.gray(
                    `... und ${security.recommendations.length - 3} weitere Empfehlungen`
                  )
                );
              }
            }
          }
        } else {
          console.log(chalk.green('✅ No security issues found'));
        }
        console.log();
      }

      // Production Audits
      if (result.production_audits && result.production_audits.length > 0) {
        console.log(chalk.cyan.bold('🏗️ PRODUCTION READINESS'));
        console.log(chalk.gray('─'.repeat(40)));

        const auditsByCategory = result.production_audits.reduce(
          (acc: any, audit: any) => {
            if (!acc[audit.category]) acc[audit.category] = [];
            acc[audit.category].push(audit);
            return acc;
          },
          {}
        );

        Object.entries(auditsByCategory).forEach(
          ([category, audits]: [string, any]) => {
            console.log(chalk.yellow(`📋 ${category.toUpperCase()}`));
            audits.forEach((audit: any, index: number) => {
              const priorityColor =
                audit.priority === 'critical'
                  ? chalk.red
                  : audit.priority === 'high'
                    ? chalk.yellow
                    : audit.priority === 'medium'
                      ? chalk.blue
                      : chalk.gray;

              console.log(priorityColor(`   ${index + 1}. ${audit.message}`));

              // Show specific file locations if available
              if (audit.files && audit.files.length > 0) {
                console.log(
                  chalk.gray(
                    `     📍 Betroffen: ${audit.files.slice(0, 3).join(', ')}${audit.files.length > 3 ? ` und ${audit.files.length - 3} weitere` : ''}`
                  )
                );
              }

              // Show affected packages if available
              if (audit.packages && audit.packages.length > 0) {
                console.log(
                  chalk.gray(
                    `     📦 Pakete: ${audit.packages.slice(0, 3).join(', ')}${audit.packages.length > 3 ? ` und ${audit.packages.length - 3} weitere` : ''}`
                  )
                );
              }

              // Show why this is problematic
              if (audit.check) {
                console.log(chalk.gray(`     💡 Prüfung: ${audit.check}`));
              }

              // Show fix recommendation
              if (audit.recommendation) {
                console.log(
                  chalk.green(`     🔧 Lösung: ${audit.recommendation}`)
                );
              }

              console.log('');
            });
          }
        );
        console.log();
      }

      // Tool Recommendations
      if (
        result.setup_recommendations &&
        result.setup_recommendations.length > 0
      ) {
        console.log(chalk.cyan.bold('🛠️ TOOL RECOMMENDATIONS'));
        console.log(chalk.gray('─'.repeat(40)));
        result.setup_recommendations.forEach((rec: string) => {
          console.log(chalk.blue(`   • ${rec}`));
        });
        console.log();
      }

      // Already Installed Tools
      if (
        result.installed_tools_detected &&
        result.installed_tools_detected.length > 0
      ) {
        console.log(chalk.cyan.bold('✅ DETECTED TOOLS'));
        console.log(chalk.gray('─'.repeat(40)));
        result.installed_tools_detected.forEach((tool: string) => {
          console.log(chalk.green(`   ✓ ${tool}`));
        });
        console.log();
      }

      // Code Insights
      if (result.code_insights && result.code_insights.length > 0) {
        console.log(chalk.cyan.bold('💡 CODE INSIGHTS'));
        console.log(chalk.gray('─'.repeat(40)));
        result.code_insights.forEach((insight: any) => {
          const severityColor =
            insight.severity === 'critical'
              ? chalk.red
              : insight.severity === 'high'
                ? chalk.yellow
                : chalk.blue;

          console.log(severityColor(`   ${insight.tool}: ${insight.reason}`));
          if (insight.evidence && insight.evidence.length > 0) {
            console.log(
              chalk.gray(
                `     Evidence: ${insight.evidence.slice(0, 3).join(', ')}${insight.evidence.length > 3 ? '...' : ''}`
              )
            );
          }
        });
        console.log();
      }


      // Summary
      const totalIssues =
        (result.security_summary?.total_issues || 0) +
        (result.production_audits?.length || 0);
      if (totalIssues > 0) {
        console.log(
          chalk.yellow(
            `💡 Found ${totalIssues} total issues. Run "woaru setup" to address tool recommendations.`
          )
        );
        if (
          result.security_summary &&
          result.security_summary.total_issues > 0
        ) {
          console.log(
            chalk.red(
              `🔒 Security issues require immediate attention. Review output above.`
            )
          );
        }
      } else {
        console.log(
          chalk.green('🎉 Project looks great! No critical issues found.')
        );
      }
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });

// Analyze LLM sub-command
analyzeCommand
  .command('llm')
  .description('AI-powered comprehensive code analysis using multiple LLMs')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-j, --json', 'Output as JSON')
  .action(async options => {
    try {
      const projectPath = path.resolve(options.path);

      console.log(chalk.blue('🧠 Running Multi-LLM Code Analysis...'));

      // Load AI configuration
      const { ConfigLoader } = await import('./ai/ConfigLoader');
      const { AIReviewAgent } = await import('./ai/AIReviewAgent');
      
      const configLoader = ConfigLoader.getInstance();
      const aiConfig = await configLoader.loadConfig(projectPath);
      
      if (!aiConfig) {
        console.log(chalk.red('❌ No AI configuration found.'));
        console.log(chalk.yellow('💡 Create woaru.config.js to enable AI features.'));
        console.log(chalk.gray('📄 See woaru.config.example.js for template.'));
        process.exit(1);
      }

      const enabledProviders = aiConfig.providers.filter(p => p.enabled);
      if (enabledProviders.length === 0) {
        console.log(chalk.red('❌ No LLM providers enabled.'));
        console.log(chalk.yellow('💡 Enable providers in woaru.config.js.'));
        process.exit(1);
      }

      // Show transparent output about which LLMs will be contacted
      const llmNames = enabledProviders.map(p => `${p.id} (${p.model})`).join(', ');
      console.log(chalk.cyan(`🧠 Kontaktiere ${enabledProviders.length} LLMs für Analyse: ${llmNames}`));

      // Get relevant code files from the project
      const { glob } = await import('glob');
      const codeFiles = await glob(path.join(projectPath, '**/*'), {
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
          '**/.next/**',
          '**/coverage/**'
        ]
      });
      
      // Filter to code files and limit for analyze command
      const codeExtensions = ['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt'];
      const relevantFiles = codeFiles
        .filter(file => {
          try {
            return fs.statSync(file).isFile() && 
                   codeExtensions.includes(path.extname(file).toLowerCase());
          } catch {
            return false;
          }
        })
        .slice(0, 10); // Limit to 10 files for analyze command to control costs
      
      if (relevantFiles.length === 0) {
        console.log(chalk.yellow('⚠️ No suitable code files found for AI analysis'));
        process.exit(1);
      }

      const aiAgent = new AIReviewAgent(aiConfig);
      const aiAnalysisResults = await runAIReviewOnFiles(aiAgent, relevantFiles, projectPath);

      if (options.json) {
        console.log(JSON.stringify(aiAnalysisResults, null, 2));
        return;
      }

      // Display AI Analysis Results
      const aiSummary = aiAnalysisResults.summary;
      console.log(chalk.cyan.bold('\n📊 Multi-LLM Analysis Results'));
      console.log(chalk.gray('═'.repeat(50)));
      
      console.log(chalk.blue(`📁 Analyzed: ${aiSummary.filesAnalyzed} files`));
      console.log(chalk.yellow(`🔍 Found: ${aiSummary.totalFindings} potential issues`));
      if (aiSummary.estimatedCost > 0) {
        console.log(chalk.gray(`💰 Total Cost: $${aiSummary.estimatedCost.toFixed(4)}`));
      }
      
      if (aiSummary.totalFindings > 0) {
        // Show top findings by severity
        const allFindings = aiAnalysisResults.results.flatMap((r: any) => 
          Object.values(r.results).flat()
        );
        
        const findingsBySeverity = allFindings.reduce((acc: Record<string, number>, finding: any) => {
          acc[finding.severity] = (acc[finding.severity] || 0) + 1;
          return acc;
        }, {});
        
        console.log(chalk.cyan('\n🎯 Findings by Severity:'));
        Object.entries(findingsBySeverity).forEach(([severity, count]: [string, number]) => {
          const icon = severity === 'critical' ? '🔴' : severity === 'high' ? '🟡' : 
                      severity === 'medium' ? '🔵' : '⚪';
          console.log(`  ${icon} ${severity}: ${count}`);
        });

        const criticalFindings = allFindings.filter((f: any) => f.severity === 'critical');
        if (criticalFindings.length > 0) {
          console.log(chalk.red('\n🚨 Critical Issues:'));
          criticalFindings.slice(0, 3).forEach((finding: any) => {
            console.log(chalk.red(`  • ${finding.message}`));
          });
          if (criticalFindings.length > 3) {
            console.log(chalk.gray(`    ... and ${criticalFindings.length - 3} more critical issues`));
          }
        }
      } else {
        console.log(chalk.green('\n✅ No issues found by AI analysis!'));
      }

      console.log(chalk.blue('\n💡 Run "woaru review git llm" or "woaru review local llm" for detailed analysis with reports.'));

    } catch (error) {
      console.error(
        chalk.red(
          `❌ LLM Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });

program
  .command('rollback')
  .description('Rollback changes made by a specific tool')
  .argument('<tool>', 'Tool name to rollback (e.g., prettier, eslint, husky)')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async (tool, options) => {
    try {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to rollback ${tool}? This will restore backup files and remove configurations.`,
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.yellow('Rollback cancelled.'));
        return;
      }

      // This would need to be implemented in the ActionManager
      console.log(
        chalk.yellow(`🔄 Rollback for ${tool} is not yet implemented.`)
      );
      console.log(
        chalk.gray(
          'You can manually restore backup files ending with .woaru-backup-*'
        )
      );
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });

// Command reference documentation
function displayCommandReference() {
  console.log(chalk.cyan.bold('📚 WOARU Command Reference'));
  console.log(chalk.gray('═'.repeat(50)));
  console.log();

  const commands = [
    {
      name: '🔍 woaru analyze [subcommand]',
      description: 'Comprehensive project analysis including security audit',
      usage: 'woaru analyze [llm] [options]',
      purpose:
        'Performs a full analysis of your project including code quality, security vulnerabilities, production readiness, and tool recommendations. Optional AI-powered analysis with multiple LLMs.',
      subcommands: [
        {
          name: 'woaru analyze llm',
          description: 'AI-powered comprehensive code analysis using multiple LLMs',
          usage: 'woaru analyze llm [-p <path>] [-j]',
          purpose:
            'Uses multiple LLM providers to analyze code quality, security, and best practices. Provides AI-powered insights and recommendations for code improvement.',
        },
      ],
    },
    {
      name: '👁️ woaru watch',
      description: 'Start WOARU supervisor to continuously monitor the project',
      usage: 'woaru watch [options]',
      purpose:
        'Continuously monitors your project for changes and provides real-time recommendations. Automatically detects new issues as you code and suggests improvements.',
    },
    {
      name: '⚙️ woaru setup <subcommand>',
      description: 'Setup and configuration tools',
      usage: 'woaru setup <tools|llm> [options]',
      purpose:
        'Configures WOARU and integrates development tools or LLM providers. Choose from tool installation/configuration or AI-powered code review setup.',
      subcommands: [
        {
          name: 'woaru setup tools',
          description: 'Interactive tool setup and configuration',
          usage: 'woaru setup tools [--auto-fix] [--auto-setup]',
          purpose:
            'Automatically installs and configures development tools based on your project analysis. Saves time by setting up linters, formatters, git hooks, and other productivity tools.',
        },
        {
          name: 'woaru setup llm',
          description: 'Setup and configure LLM providers for AI code analysis',
          usage: 'woaru setup llm [-p <path>]',
          purpose:
            'Interactive configuration of multiple LLM providers (Anthropic Claude, OpenAI GPT, Google Gemini, Azure OpenAI, Local Ollama) for AI-powered code review.',
        },
      ],
    },
    {
      name: '📊 woaru status',
      description: 'Show WOARU supervisor status and project health',
      usage: 'woaru status [options]',
      purpose:
        'Displays the current status of the supervisor and provides a quick overview of your project health, detected tools, and any issues that need attention.',
    },
    {
      name: '🔧 woaru helpers',
      description: 'Show all detected/activated development tools and helpers',
      usage: 'woaru helpers [options]',
      purpose:
        'Lists all development tools found in your project, both active and recommended. Helps you understand your current tooling setup and what might be missing.',
    },
    {
      name: '🔄 woaru review <subcommand>',
      description: 'Code review and analysis tools',
      usage: 'woaru review <git|local|path> [llm] [options]',
      purpose:
        'Focused analysis tools for code reviews with optional AI-powered analysis. Choose from git diff analysis, uncommitted changes review, or specific file/directory analysis.',
      subcommands: [
        {
          name: 'woaru review git [llm]',
          description: 'Analyze changes since a specific branch (git diff) with optional AI analysis',
          usage: 'woaru review git [llm] [-b <branch>] [-o <file>] [-j]',
          purpose:
            'Analyzes changes between your current branch and a base branch (default: main). Optional multi-LLM analysis for AI-powered code review insights.',
        },
        {
          name: 'woaru review local [llm]',
          description: 'Analyze uncommitted changes with optional AI analysis',
          usage: 'woaru review local [llm] [-o <file>] [-j]',
          purpose:
            'Reviews your uncommitted changes before you commit them. Optional AI analysis provides intelligent suggestions and catches issues early.',
        },
        {
          name: 'woaru review path <path> [llm]',
          description: 'Analyze specific files or directories with optional AI analysis',
          usage: 'woaru review path <file_or_directory> [llm] [-o <file>] [-j]',
          purpose:
            'Focused analysis of specific files or directories. Optional multi-LLM analysis provides deep insights into code quality and best practices.',
        },
      ],
    },
    {
      name: '🗄️ woaru update-db',
      description: 'Update the tools database from remote source',
      usage: 'woaru update-db',
      purpose:
        'Updates the internal database of development tools and their configurations. Ensures you have the latest tool recommendations and setup procedures.',
    },
    {
      name: '🛑 woaru stop',
      description: 'Stop the WOARU supervisor',
      usage: 'woaru stop [options]',
      purpose:
        'Stops any running supervisor process. Use this when you want to stop continuous monitoring or before starting a new supervisor session.',
    },
    {
      name: '📋 woaru recommendations',
      description: 'Show current tool recommendations',
      usage: 'woaru recommendations [options]',
      purpose:
        'Displays prioritized tool recommendations for your project. Shows what tools would improve your development workflow and code quality.',
    },
    {
      name: '📄 woaru logs',
      description: 'Show supervisor logs',
      usage: 'woaru logs [options]',
      purpose:
        'Shows logs from the supervisor process. Useful for debugging issues or understanding what the supervisor has been doing.',
    },
    {
      name: '🚫 woaru ignore',
      description: 'Add a tool to the ignore list',
      usage: 'woaru ignore <tool>',
      purpose:
        'Tells the supervisor to stop recommending a specific tool. Useful when you have good reasons not to use a particular tool.',
    },
    {
      name: '⏪ woaru rollback',
      description: 'Rollback changes made by a specific tool',
      usage: 'woaru rollback <tool> [options]',
      purpose:
        'Undoes changes made by the setup command for a specific tool. Provides a safety net when tool configurations cause issues.',
    },
    {
      name: '📚 woaru commands',
      description: 'Show this detailed command reference',
      usage: 'woaru commands',
      purpose:
        'Displays comprehensive documentation for all WOARU commands. Your go-to reference for understanding what each command does and when to use it.',
    },
    {
      name: '📖 woaru wiki',
      description: 'Show comprehensive WOARU documentation and concept guide',
      usage: 'woaru wiki',
      purpose:
        'Displays complete WOARU documentation with dynamic content generation. Includes concept explanations, feature details, and live LLM integration status.',
    },
    {
      name: '📨 woaru message <subcommand>',
      description: 'Send reports from history to configured message channels',
      usage: 'woaru message <all|latest> [options]',
      purpose:
        'Manually send reports from the .woaru/reports/ directory to configured message channels. Choose to send all reports or just the latest one.',
      subcommands: [
        {
          name: 'woaru message all',
          description: 'Send all reports from .woaru/reports/ to configured channels',
          usage: 'woaru message all [-p <path>]',
          purpose:
            'Reads all .md files from the reports directory and sends them to all configured message channels (terminal, file backup, etc.).',
        },
        {
          name: 'woaru message latest',
          description: 'Send the latest report from .woaru/reports/ to configured channels',
          usage: 'woaru message latest [-p <path>]',
          purpose:
            'Finds the most recently modified report file and sends it to all configured message channels.',
        },
      ],
    },
  ];

  commands.forEach((cmd, index) => {
    console.log(chalk.yellow.bold(cmd.name));
    console.log(chalk.gray(`  Description: ${cmd.description}`));
    console.log(chalk.gray(`  Usage: ${cmd.usage}`));
    console.log(chalk.blue(`  Purpose: ${cmd.purpose}`));

    if (cmd.subcommands) {
      console.log(chalk.cyan('  Subcommands:'));
      cmd.subcommands.forEach(sub => {
        console.log(chalk.yellow(`    • ${sub.name}`));
        console.log(chalk.gray(`      Description: ${sub.description}`));
        console.log(chalk.gray(`      Usage: ${sub.usage}`));
        console.log(chalk.blue(`      Purpose: ${sub.purpose}`));
      });
    }

    if (index < commands.length - 1) {
      console.log();
    }
  });

  console.log();
  console.log(chalk.gray('═'.repeat(50)));
  console.log(
    chalk.cyan('💡 Tip: Use --help with any command for detailed options')
  );
  console.log(
    chalk.cyan('🔗 For more information: https://github.com/your-repo/woaru')
  );
}

// Wiki Helper Functions
function displayMarkdownContent(content: string): void {
  const lines = content.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('# ')) {
      console.log(chalk.blue.bold(line.replace('# ', '')));
    } else if (line.startsWith('## ')) {
      console.log(chalk.cyan.bold(line.replace('## ', '')));
    } else if (line.startsWith('### ')) {
      console.log(chalk.yellow.bold(line.replace('### ', '')));
    } else if (line.startsWith('- **') && line.includes('**:')) {
      // Handle bold list items
      const match = line.match(/- \*\*(.*?)\*\*:(.*)/);
      if (match) {
        console.log(chalk.green(`  • ${chalk.bold(match[1])}:${match[2]}`));
      } else {
        console.log(chalk.gray(line));
      }
    } else if (line.startsWith('- ')) {
      console.log(chalk.green(`  ${line.replace('- ', '• ')}`));
    } else if (line.startsWith('**') && line.endsWith('**')) {
      console.log(chalk.bold(line.replace(/\*\*/g, '')));
    } else if (line.trim() === '' || line.trim() === '---') {
      console.log();
    } else if (line.startsWith('*') && line.endsWith('*')) {
      console.log(chalk.italic.gray(line.replace(/\*/g, '')));
    } else {
      console.log(chalk.gray(line));
    }
  }
}

function generateDynamicCommandDocumentation(): string {
  const commands = [
    {
      name: '🚀 woaru analyze',
      description: 'Comprehensive project analysis including security audit',
      usage: 'woaru analyze [llm]',
      purpose: 'Performs deep project analysis with optional AI-powered insights',
      subcommands: [
        {
          name: 'woaru analyze llm',
          description: 'AI-powered comprehensive code analysis using multiple LLMs',
          usage: 'woaru analyze llm [-p <path>] [-j]',
          purpose: 'Uses multiple LLM providers to analyze code quality, security, and best practices'
        }
      ]
    },
    {
      name: '👁️ woaru watch',
      description: 'Start intelligent project monitoring',
      usage: 'woaru watch [-p <path>] [--detached] [--dashboard]',
      purpose: 'Continuously monitors project for changes and provides real-time recommendations'
    },
    {
      name: '🔍 woaru review',
      description: 'Code review and analysis tools',
      usage: 'woaru review <type> [llm]',
      purpose: 'Performs various types of code reviews with optional AI analysis',
      subcommands: [
        {
          name: 'woaru review git [llm]',
          description: 'Review git changes with optional AI analysis',
          usage: 'woaru review git [llm] [-b <branch>] [-o <file>] [-j]',
          purpose: 'Analyzes changes between branches using traditional tools and optionally multiple LLMs'
        },
        {
          name: 'woaru review local [llm]',
          description: 'Review uncommitted changes with optional AI analysis',
          usage: 'woaru review local [llm] [-o <file>] [-j]',
          purpose: 'Analyzes uncommitted local changes for quality and security issues'
        },
        {
          name: 'woaru review path <path> [llm]',
          description: 'Review specific files/directories with optional AI analysis',
          usage: 'woaru review path <path> [llm] [-o <file>] [-j]',
          purpose: 'Focused analysis of specific code areas with comprehensive reporting'
        }
      ]
    },
    {
      name: '🔧 woaru setup',
      description: 'Setup and configuration tools',
      usage: 'woaru setup <type>',
      purpose: 'Configures WOARU and integrates development tools',
      subcommands: [
        {
          name: 'woaru setup tools',
          description: 'Interactive tool setup and configuration',
          usage: 'woaru setup tools [-p <path>] [--auto-fix] [--auto-setup]',
          purpose: 'Guides through installation and configuration of development tools'
        },
        {
          name: 'woaru setup llm',
          description: 'Setup and configure LLM providers for AI code analysis',
          usage: 'woaru setup llm [-p <path>]',
          purpose: 'Interactive configuration of multiple LLM providers for AI-powered code review'
        }
      ]
    },
    {
      name: '📊 woaru status',
      description: 'Show WOARU supervisor status and project health',
      usage: 'woaru status [-p <path>]',
      purpose: 'Displays comprehensive status including LLM integration and usage statistics'
    },
    {
      name: '📚 woaru commands',
      description: 'Show detailed command reference documentation',
      usage: 'woaru commands',
      purpose: 'Displays comprehensive documentation for all WOARU commands'
    },
    {
      name: '📖 woaru wiki',
      description: 'Show comprehensive WOARU documentation and concept guide',
      usage: 'woaru wiki',
      purpose: 'Displays complete WOARU documentation with dynamic content generation'
    },
    {
      name: '📨 woaru message',
      description: 'Send reports from history to configured message channels',
      usage: 'woaru message <all|latest> [options]',
      purpose: 'Manually send reports from the .woaru/reports/ directory to configured message channels',
      subcommands: [
        {
          name: 'woaru message all',
          description: 'Send all reports from .woaru/reports/ to configured channels',
          usage: 'woaru message all [-p <path>]',
          purpose: 'Reads all .md files from the reports directory and sends them to all configured message channels'
        },
        {
          name: 'woaru message latest',
          description: 'Send the latest report from .woaru/reports/ to configured channels',
          usage: 'woaru message latest [-p <path>]',
          purpose: 'Finds the most recently modified report file and sends it to all configured message channels'
        }
      ]
    }
  ];

  let output = '';
  
  commands.forEach((cmd, index) => {
    output += chalk.yellow.bold(cmd.name) + '\n';
    output += chalk.gray(`  Description: ${cmd.description}`) + '\n';
    output += chalk.gray(`  Usage: ${cmd.usage}`) + '\n';
    output += chalk.blue(`  Purpose: ${cmd.purpose}`) + '\n';

    if (cmd.subcommands) {
      output += chalk.cyan('  Subcommands:') + '\n';
      cmd.subcommands.forEach(sub => {
        output += chalk.yellow(`    • ${sub.name}`) + '\n';
        output += chalk.gray(`      Description: ${sub.description}`) + '\n';
        output += chalk.gray(`      Usage: ${sub.usage}`) + '\n';
        output += chalk.blue(`      Purpose: ${sub.purpose}`) + '\n';
      });
    }

    if (index < commands.length - 1) {
      output += '\n';
    }
  });

  return output;
}

async function displayCurrentLLMStatus(): Promise<void> {
  try {
    const projectPath = process.cwd();
    const configPath = path.join(projectPath, 'woaru.config.js');
    const hasConfig = await fs.pathExists(configPath);

    if (!hasConfig) {
      console.log(chalk.yellow('⚠️ No LLM configuration found'));
      console.log(chalk.gray('   Run "woaru setup llm" to configure LLM providers'));
      console.log();
      return;
    }

    // Load LLM configuration
    const { ConfigLoader } = await import('./ai/ConfigLoader');
    const configLoader = ConfigLoader.getInstance();
    const config = await configLoader.loadConfig(projectPath);

    if (!config || !config.providers || config.providers.length === 0) {
      console.log(chalk.yellow('⚠️ No LLM providers configured'));
      console.log(chalk.gray('   Run "woaru setup llm" to add LLM providers'));
      return;
    }

    console.log(chalk.cyan('🤖 LLM Integration Summary:'));
    console.log(chalk.gray(`   Total Providers: ${config.providers.length}`));
    console.log(chalk.gray(`   Parallel Processing: ${config.parallelRequests ? 'Enabled' : 'Disabled'}`));
    console.log(chalk.gray(`   Token Limit: ${config.tokenLimit}`));
    console.log(chalk.gray(`   Cost Threshold: $${config.costThreshold}`));
    console.log();

    console.log(chalk.cyan('📋 Configured Providers:'));
    config.providers.forEach(provider => {
      const status = provider.enabled ? chalk.green('✅ enabled') : chalk.red('❌ disabled');
      const hasKey = provider.apiKeyEnvVar && process.env[provider.apiKeyEnvVar] ? 
        chalk.green('🔑 ready') : 
        chalk.red('❌ no key');
      
      console.log(chalk.gray(`   • ${provider.id} (${provider.model}) - ${status} | ${hasKey}`));
    });

    // Show usage statistics
    const { UsageTracker } = await import('./ai/UsageTracker');
    const usageTracker = UsageTracker.getInstance();
    const totalUsage = await usageTracker.getTotalUsage();

    if (totalUsage.totalRequests > 0) {
      console.log();
      console.log(chalk.cyan('📈 Usage Statistics:'));
      console.log(chalk.gray(`   Total API Calls: ${totalUsage.totalRequests}`));
      console.log(chalk.gray(`   Total Tokens: ${totalUsage.totalTokensUsed.toLocaleString()}`));
      console.log(chalk.gray(`   Total Cost: $${totalUsage.totalCost.toFixed(4)}`));
      console.log(chalk.gray(`   Success Rate: ${((totalUsage.totalRequests - totalUsage.totalErrors) / totalUsage.totalRequests * 100).toFixed(1)}%`));
    } else {
      console.log();
      console.log(chalk.gray('   📈 No usage statistics recorded yet'));
    }

  } catch (error) {
    console.log(chalk.red('❌ Failed to load LLM status'));
    console.log(chalk.gray(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }
}

async function displayWikiContent(): Promise<void> {
  try {
    console.log(chalk.cyan.bold('📚 WOARU Wiki - Comprehensive Documentation'));
    console.log(chalk.gray('═'.repeat(80)));
    console.log();

    // Load concept documentation
    const conceptPath = path.join(__dirname, '..', 'docs', 'wiki', 'concept.md');
    const featuresPath = path.join(__dirname, '..', 'docs', 'wiki', 'features.md');

    let conceptContent = '';
    let featuresContent = '';

    // Load concept.md
    if (await fs.pathExists(conceptPath)) {
      conceptContent = await fs.readFile(conceptPath, 'utf-8');
    } else {
      conceptContent = '# WOARU Concept\n\nConcept documentation not found. Please ensure docs/wiki/concept.md exists.';
    }

    // Load features.md
    if (await fs.pathExists(featuresPath)) {
      featuresContent = await fs.readFile(featuresPath, 'utf-8');
    } else {
      featuresContent = '# WOARU Features\n\nFeature documentation not found. Please ensure docs/wiki/features.md exists.';
    }

    // Generate dynamic command documentation
    const commandDocs = generateDynamicCommandDocumentation();

    // Display the complete wiki content
    console.log(chalk.cyan('🎯 TABLE OF CONTENTS'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.yellow('1. 📖 WOARU Concept & Philosophy'));
    console.log(chalk.yellow('2. 🔧 Commands & Usage'));
    console.log(chalk.yellow('3. ⚡ Features & Capabilities'));
    console.log(chalk.yellow('4. 🤖 LLM Integration Status'));
    console.log();

    // Section 1: Concept
    console.log(chalk.cyan.bold('📖 SECTION 1: WOARU CONCEPT & PHILOSOPHY'));
    console.log(chalk.gray('═'.repeat(60)));
    displayMarkdownContent(conceptContent);
    console.log();

    // Section 2: Commands (Dynamic)
    console.log(chalk.cyan.bold('🔧 SECTION 2: COMMANDS & USAGE'));
    console.log(chalk.gray('═'.repeat(60)));
    console.log(commandDocs);
    console.log();

    // Section 3: Features
    console.log(chalk.cyan.bold('⚡ SECTION 3: FEATURES & CAPABILITIES'));
    console.log(chalk.gray('═'.repeat(60)));
    displayMarkdownContent(featuresContent);
    console.log();

    // Section 4: Current LLM Status (Dynamic)
    console.log(chalk.cyan.bold('🤖 SECTION 4: CURRENT LLM INTEGRATION STATUS'));
    console.log(chalk.gray('═'.repeat(60)));
    await displayCurrentLLMStatus();
    console.log();

    // Footer
    console.log(chalk.gray('═'.repeat(80)));
    console.log(chalk.cyan.bold('📝 Documentation Generation Info'));
    console.log(chalk.gray(`Generated: ${new Date().toLocaleString()}`));
    console.log(chalk.gray(`WOARU Version: 1.2.0`));
    console.log(chalk.yellow('💡 This documentation is dynamically generated and auto-updates'));
    console.log(chalk.cyan('🔄 Run "woaru wiki" anytime to get the latest information'));
    console.log();

  } catch (error) {
    console.error(chalk.red('❌ Failed to generate wiki documentation'));
    console.error(chalk.gray(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }
}

program
  .command('commands')
  .description('Show detailed command reference documentation')
  .action(() => {
    displayCommandReference();
  });

program
  .command('wiki')
  .description('Show comprehensive WOARU documentation and concept guide')
  .action(async () => {
    await displayWikiContent();
  });

// Message command
const messageCommand = program
  .command('message')
  .description('Send reports from history to configured message channels');

messageCommand
  .command('all')
  .description('Send all reports from .woaru/reports/ to configured channels')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async (options) => {
    try {
      const projectPath = path.resolve(options.path);
      await sendAllReports(projectPath);
    } catch (error) {
      console.error(chalk.red(`❌ Failed to send all reports: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

messageCommand
  .command('latest')
  .description('Send the latest report from .woaru/reports/ to configured channels')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async (options) => {
    try {
      const projectPath = path.resolve(options.path);
      await sendLatestReport(projectPath);
    } catch (error) {
      console.error(chalk.red(`❌ Failed to send latest report: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Logs command with sub-commands
const logsCommand = program
  .command('logs')
  .description('View and manage WOARU activity logs');

// Main logs command (show recent logs)
logsCommand
  .option('-t, --tail <lines>', 'Number of recent log lines to show', '50')
  .option('-f, --follow', 'Follow log file for new entries (not implemented yet)')
  .option('-p, --project <path>', 'Filter logs by project path')
  .option('-a, --action <action>', 'Filter logs by action type')
  .option('--since <date>', 'Show logs since date (YYYY-MM-DD)')
  .option('--until <date>', 'Show logs until date (YYYY-MM-DD)')
  .option('--export <format>', 'Export logs to file (json, csv, txt)')
  .option('--output <file>', 'Output file for export')
  .action(async (options) => {
    try {
      await showLogs(options);
    } catch (error) {
      console.error(chalk.red(`❌ Failed to show logs: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Clear logs sub-command
logsCommand
  .command('clear')
  .description('Clear all WOARU activity logs')
  .option('--confirm', 'Skip confirmation prompt')
  .action(async (options) => {
    try {
      await clearLogs(options);
    } catch (error) {
      console.error(chalk.red(`❌ Failed to clear logs: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Logs stats sub-command
logsCommand
  .command('stats')
  .description('Show WOARU activity log statistics')
  .action(async () => {
    try {
      await showLogStats();
    } catch (error) {
      console.error(chalk.red(`❌ Failed to show log stats: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error(
    chalk.red('❌ Invalid command. Use --help to see available commands.')
  );
  process.exit(1);
});

// LLM Usage Statistics Display Function
async function showUsageStatistics(providers: any[]): Promise<void> {
  try {
    const { UsageTracker } = await import('./ai/UsageTracker');
    const usageTracker = UsageTracker.getInstance();
    const totalUsage = await usageTracker.getTotalUsage();

    if (totalUsage.totalRequests === 0) {
      console.log(chalk.cyan('\n   📈 Usage Statistics: No usage recorded yet'));
      console.log(chalk.gray('     Run LLM analysis commands to see usage statistics'));
      return;
    }

    console.log(chalk.cyan.bold('\n   📈 Usage Statistics'));
    console.log(chalk.gray('   ─'.repeat(20)));
    
    // Show total usage
    console.log(chalk.gray(`     Total Requests: ${totalUsage.totalRequests}`));
    console.log(chalk.gray(`     Total Tokens: ${totalUsage.totalTokensUsed.toLocaleString()}`));
    console.log(chalk.gray(`     Total Cost: $${totalUsage.totalCost.toFixed(4)}`));
    console.log(chalk.gray(`     Total Errors: ${totalUsage.totalErrors}`));
    console.log();

    // Show per-provider usage
    console.log(chalk.cyan('     🔍 Per-Provider Usage:'));
    
    if (providers.length === 0) {
      // Show all recorded usage from UsageTracker when no providers configured
      const allStats = await usageTracker.getAllUsageStats();
      const providerIds = Object.keys(allStats);
      
      if (providerIds.length === 0) {
        console.log(chalk.gray('       No provider usage recorded'));
      } else {
        for (const providerId of providerIds) {
          const stats = allStats[providerId];
          console.log(chalk.gray(`       • ${providerId}:`));
          console.log(chalk.gray(`         Requests: ${stats.totalRequests} | Tokens: ${stats.totalTokensUsed.toLocaleString()}`));
          console.log(chalk.gray(`         Cost: $${stats.totalCost.toFixed(4)} | Errors: ${stats.errorCount}`));
          console.log(chalk.gray(`         Last used: ${new Date(stats.lastUsed).toLocaleString()}`));
        }
      }
    } else {
      // Show usage for configured providers
      for (const provider of providers) {
        const stats = await usageTracker.getUsageStats(provider.id);
        if (stats && stats.totalRequests > 0) {
          console.log(chalk.gray(`       • ${provider.id}:`));
          console.log(chalk.gray(`         Requests: ${stats.totalRequests} | Tokens: ${stats.totalTokensUsed.toLocaleString()}`));
          console.log(chalk.gray(`         Cost: $${stats.totalCost.toFixed(4)} | Errors: ${stats.errorCount}`));
          console.log(chalk.gray(`         Last used: ${new Date(stats.lastUsed).toLocaleString()}`));
        } else {
          console.log(chalk.gray(`       • ${provider.id}: No usage recorded`));
        }
      }
    }

  } catch (error) {
    console.log(chalk.yellow('   ⚠️ Could not load usage statistics'));
    console.log(chalk.gray(`     Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }
}

// LLM Status Display Function
async function showLLMStatus(projectPath: string): Promise<void> {
  try {
    console.log(chalk.cyan.bold('\n🤖 LLM Integration Status'));
    console.log(chalk.gray('─'.repeat(30)));

    // Check if configuration exists
    const configPath = path.join(projectPath, 'woaru.config.js');
    const hasConfig = await fs.pathExists(configPath);

    if (!hasConfig) {
      console.log(chalk.gray('   Status: Not configured'));
      console.log(chalk.yellow('   📄 No woaru.config.js found'));
      console.log(chalk.cyan('   💡 Run "woaru setup llm" to configure LLM providers'));
      
      // Show usage statistics even without config
      await showUsageStatistics([]);
      return;
    }

    // Load and display LLM configuration
    try {
      const { ConfigLoader } = await import('./ai/ConfigLoader');
      const configLoader = ConfigLoader.getInstance();
      const config = await configLoader.loadConfig(projectPath);

      if (!config || !config.providers || config.providers.length === 0) {
        console.log(chalk.gray('   Status: No LLM providers configured'));
        console.log(chalk.cyan('   💡 Run "woaru setup llm" to add LLM providers'));
        return;
      }

      console.log(chalk.gray(`   Status: ${config.providers.length} provider(s) configured`));
      console.log(chalk.gray(`   Parallel Requests: ${config.parallelRequests ? 'Enabled' : 'Disabled'}`));
      console.log(chalk.gray(`   Token Limit: ${config.tokenLimit || 8000}`));
      console.log(chalk.gray(`   Cost Threshold: $${config.costThreshold || 0.50}`));
      console.log();

      // Display provider details
      console.log(chalk.cyan('   📋 Configured Providers:'));
      for (const provider of config.providers) {
        const status = provider.enabled ? chalk.green('✅ enabled') : chalk.red('❌ disabled');
        const hasKey = provider.apiKeyEnvVar && process.env[provider.apiKeyEnvVar] ? 
          chalk.green('🔑 key found') : 
          chalk.red('❌ no key');
        
        console.log(chalk.gray(`     • ${provider.id} (${provider.model})`));
        console.log(chalk.gray(`       Status: ${status} | API Key: ${hasKey}`));
        
        if (provider.enabled && provider.apiKeyEnvVar && !process.env[provider.apiKeyEnvVar]) {
          console.log(chalk.yellow(`       ⚠️  Set ${provider.apiKeyEnvVar} environment variable`));
        }
      }

      const enabledProviders = config.providers.filter(p => p.enabled);
      const readyProviders = enabledProviders.filter(p => !p.apiKeyEnvVar || process.env[p.apiKeyEnvVar]);
      
      console.log();
      console.log(chalk.gray(`   📊 Summary: ${enabledProviders.length} enabled, ${readyProviders.length} ready`));
      
      if (readyProviders.length > 0) {
        console.log(chalk.green('   🚀 AI Code Review available!'));
        console.log(chalk.cyan('   💡 Use "woaru analyze llm" or "woaru review <type> llm" for AI analysis'));
      } else if (enabledProviders.length > 0) {
        console.log(chalk.yellow('   ⚠️  Set API keys to enable AI Code Review'));
      }

      // Show usage statistics
      await showUsageStatistics(config.providers);

    } catch (error) {
      console.log(chalk.red('   Status: Configuration error'));
      console.log(chalk.gray(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      console.log(chalk.cyan('   💡 Run "woaru setup llm" to reconfigure'));
    }

  } catch (error) {
    console.log(chalk.red('   Status: Error loading LLM configuration'));
    console.log(chalk.gray(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }
}

// Message Sending Functions
async function sendAllReports(projectPath: string): Promise<void> {
  console.log(chalk.cyan.bold('📨 Sending All Reports'));
  console.log(chalk.gray('─'.repeat(30)));

  const reportsDir = path.join(projectPath, '.woaru', 'reports');
  
  // Check if reports directory exists
  if (!(await fs.pathExists(reportsDir))) {
    console.log(chalk.yellow('⚠️ No reports directory found'));
    console.log(chalk.gray(`   Expected: ${reportsDir}`));
    console.log(chalk.cyan('   💡 Run analysis commands to generate reports first'));
    return;
  }

  // Find all .md files in reports directory
  const reportFiles = await fs.readdir(reportsDir);
  const markdownFiles = reportFiles.filter(file => file.endsWith('.md'));

  if (markdownFiles.length === 0) {
    console.log(chalk.yellow('⚠️ No report files found'));
    console.log(chalk.gray(`   Directory: ${reportsDir}`));
    console.log(chalk.cyan('   💡 Run analysis commands to generate reports first'));
    return;
  }

  console.log(chalk.blue(`📋 Found ${markdownFiles.length} report(s) to send:`));
  markdownFiles.forEach(file => {
    console.log(chalk.gray(`   • ${file}`));
  });
  console.log();

  let successCount = 0;
  let errorCount = 0;

  // Send each report
  for (const fileName of markdownFiles) {
    const filePath = path.join(reportsDir, fileName);
    
    try {
      console.log(chalk.cyan(`📤 Sending: ${fileName}`));
      
      // Read report content
      const reportContent = await fs.readFile(filePath, 'utf-8');
      
      // Send to configured channels
      const channels = await sendReportToChannels(reportContent, fileName, projectPath);
      
      console.log(chalk.green(`   ✅ Sent to ${channels.length} channel(s): ${channels.join(', ')}`));
      successCount++;
      
    } catch (error) {
      console.log(chalk.red(`   ❌ Failed to send ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`));
      errorCount++;
    }
  }

  // Summary
  console.log();
  console.log(chalk.cyan.bold('📊 Send Summary:'));
  console.log(chalk.green(`   ✅ Successfully sent: ${successCount} reports`));
  if (errorCount > 0) {
    console.log(chalk.red(`   ❌ Failed to send: ${errorCount} reports`));
  }
}

async function sendLatestReport(projectPath: string): Promise<void> {
  console.log(chalk.cyan.bold('📨 Sending Latest Report'));
  console.log(chalk.gray('─'.repeat(30)));

  const reportsDir = path.join(projectPath, '.woaru', 'reports');
  
  // Check if reports directory exists
  if (!(await fs.pathExists(reportsDir))) {
    console.log(chalk.yellow('⚠️ No reports directory found'));
    console.log(chalk.gray(`   Expected: ${reportsDir}`));
    console.log(chalk.cyan('   💡 Run analysis commands to generate reports first'));
    return;
  }

  // Find all .md files with their stats
  const reportFiles = await fs.readdir(reportsDir);
  const markdownFiles = reportFiles.filter(file => file.endsWith('.md'));

  if (markdownFiles.length === 0) {
    console.log(chalk.yellow('⚠️ No report files found'));
    console.log(chalk.gray(`   Directory: ${reportsDir}`));
    console.log(chalk.cyan('   💡 Run analysis commands to generate reports first'));
    return;
  }

  // Import FilenameHelper for proper timestamp-based sorting
  const { FilenameHelper } = await import('./utils/filenameHelper');
  
  // Use standardized filename sorting for reports
  const sortedFiles = FilenameHelper.sortReportsByTimestamp(markdownFiles);
  const latestFile = sortedFiles[0]; // First file is the newest
  
  if (!latestFile) {
    console.log(chalk.red('❌ Could not determine latest report'));
    return;
  }
  
  const latestFilePath = path.join(reportsDir, latestFile);
  const stats = await fs.stat(latestFilePath);
  const latestTime = stats.mtime.getTime();
  const modifiedTime = new Date(latestTime).toLocaleString();

  console.log(chalk.blue(`📋 Latest report: ${latestFile}`));
  console.log(chalk.gray(`   Modified: ${modifiedTime}`));
  console.log();

  try {
    console.log(chalk.cyan(`📤 Sending: ${latestFile}`));
    
    // Read report content
    const reportContent = await fs.readFile(latestFilePath, 'utf-8');
    
    // Send to configured channels
    const channels = await sendReportToChannels(reportContent, latestFile, projectPath);
    
    console.log(chalk.green(`✅ Successfully sent to ${channels.length} channel(s): ${channels.join(', ')}`));
    
  } catch (error) {
    console.log(chalk.red(`❌ Failed to send latest report: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }
}

async function sendReportToChannels(content: string, fileName: string, projectPath: string): Promise<string[]> {
  const sentChannels: string[] = [];

  try {
    // For now, we'll implement basic terminal output and file saving
    // This is a placeholder for the message configuration system
    
    // Always send to terminal (console output)
    console.log(chalk.gray(`     📺 Sending to terminal`));
    sentChannels.push('terminal');

    // Save to .woaru/sent-reports/ directory
    const sentReportsDir = path.join(projectPath, '.woaru', 'sent-reports');
    await fs.ensureDir(sentReportsDir);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sentFileName = `${timestamp}-${fileName}`;
    const sentFilePath = path.join(sentReportsDir, sentFileName);
    
    await fs.writeFile(sentFilePath, content, 'utf-8');
    console.log(chalk.gray(`     💾 Saved copy to: ${sentFileName}`));
    sentChannels.push('file-backup');

    // TODO: Integration with TelegramSender and other messaging systems
    // This will be implemented when the messaging configuration is set up
    
  } catch (error) {
    console.warn(chalk.yellow(`⚠️ Some channels failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }

  return sentChannels;
}

// LLM Provider Setup Functions
async function setupAnthropicProvider(): Promise<any> {
  console.log(chalk.cyan.bold('\n🤖 Setting up Anthropic Claude'));
  console.log(chalk.gray('───────────────────────────'));
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'apiKey',
      message: 'Environment variable name for API key:',
      default: 'ANTHROPIC_API_KEY',
      validate: (input: string) => input.trim().length > 0 || 'API key environment variable is required'
    },
    {
      type: 'list',
      name: 'model',
      message: 'Select Claude model:',
      choices: [
        { name: 'Claude 3.5 Sonnet (Latest)', value: 'claude-3-5-sonnet-20241022' },
        { name: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-20241022' },
        { name: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
        { name: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229' },
        { name: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' }
      ],
      default: 'claude-3-5-sonnet-20241022'
    },
    {
      type: 'confirm',
      name: 'enabled',
      message: 'Enable this provider?',
      default: true
    }
  ]);

  return {
    id: "anthropic-claude",
    providerType: "anthropic",
    apiKeyEnvVar: answers.apiKey,
    baseUrl: "https://api.anthropic.com/v1/messages",
    model: answers.model,
    headers: {
      "anthropic-version": "2023-06-01"
    },
    bodyTemplate: JSON.stringify({
      model: "{model}",
      max_tokens: 4000,
      temperature: 0.1,
      messages: [
        {
          role: "user", 
          content: "{prompt}\\n\\nCode to analyze:\\n```{language}\\n{code}\\n```"
        }
      ]
    }),
    timeout: 30000,
    maxTokens: 4000,
    temperature: 0.1,
    enabled: answers.enabled
  };
}

async function setupOpenAIProvider(): Promise<any> {
  console.log(chalk.cyan.bold('\n🧠 Setting up OpenAI GPT'));
  console.log(chalk.gray('─────────────────────────'));
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'apiKey',
      message: 'Environment variable name for API key:',
      default: 'OPENAI_API_KEY',
      validate: (input: string) => input.trim().length > 0 || 'API key environment variable is required'
    },
    {
      type: 'list',
      name: 'model',
      message: 'Select GPT model:',
      choices: [
        { name: 'GPT-4o (Latest)', value: 'gpt-4o' },
        { name: 'GPT-4o Mini', value: 'gpt-4o-mini' },
        { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
        { name: 'GPT-4', value: 'gpt-4' },
        { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }
      ],
      default: 'gpt-4o'
    },
    {
      type: 'confirm',
      name: 'enabled',
      message: 'Enable this provider?',
      default: true
    }
  ]);

  return {
    id: "openai-gpt4",
    providerType: "openai",
    apiKeyEnvVar: answers.apiKey,
    baseUrl: "https://api.openai.com/v1/chat/completions",
    model: answers.model,
    headers: {},
    bodyTemplate: JSON.stringify({
      model: "{model}",
      messages: [
        {
          role: "system",
          content: "{systemPrompt}"
        },
        {
          role: "user",
          content: "{prompt}\\n\\nCode to analyze:\\n```{language}\\n{code}\\n```"
        }
      ],
      max_tokens: 4000,
      temperature: 0.1
    }),
    timeout: 30000,
    maxTokens: 4000,
    temperature: 0.1,
    enabled: answers.enabled
  };
}

async function setupGoogleProvider(): Promise<any> {
  console.log(chalk.cyan.bold('\n🔍 Setting up Google Gemini'));
  console.log(chalk.gray('─────────────────────────────'));
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'apiKey',
      message: 'Environment variable name for API key:',
      default: 'GOOGLE_AI_API_KEY',
      validate: (input: string) => input.trim().length > 0 || 'API key environment variable is required'
    },
    {
      type: 'list',
      name: 'model',
      message: 'Select Gemini model:',
      choices: [
        { name: 'Gemini 1.5 Pro (Latest)', value: 'gemini-1.5-pro' },
        { name: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
        { name: 'Gemini Pro', value: 'gemini-pro' }
      ],
      default: 'gemini-1.5-pro'
    },
    {
      type: 'confirm',
      name: 'enabled',
      message: 'Enable this provider?',
      default: true
    }
  ]);

  return {
    id: "google-gemini",
    providerType: "google",
    apiKeyEnvVar: answers.apiKey,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    model: answers.model,
    headers: {},
    bodyTemplate: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: "{systemPrompt}\\n\\n{prompt}\\n\\nCode to analyze:\\n```{language}\\n{code}\\n```"
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4000
      }
    }),
    timeout: 30000,
    maxTokens: 4000,
    temperature: 0.1,
    enabled: answers.enabled
  };
}

async function setupAzureProvider(): Promise<any> {
  console.log(chalk.cyan.bold('\n☁️ Setting up Azure OpenAI'));
  console.log(chalk.gray('────────────────────────────'));
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'apiKey',
      message: 'Environment variable name for API key:',
      default: 'AZURE_OPENAI_API_KEY',
      validate: (input: string) => input.trim().length > 0 || 'API key environment variable is required'
    },
    {
      type: 'input',
      name: 'endpoint',
      message: 'Azure OpenAI endpoint URL:',
      validate: (input: string) => {
        const url = input.trim();
        return (url.startsWith('https://') && url.includes('.openai.azure.com')) || 'Please enter a valid Azure OpenAI endpoint';
      }
    },
    {
      type: 'input',
      name: 'deploymentName',
      message: 'Deployment name:',
      validate: (input: string) => input.trim().length > 0 || 'Deployment name is required'
    },
    {
      type: 'list',
      name: 'apiVersion',
      message: 'API Version:',
      choices: [
        { name: '2024-02-15-preview (Latest)', value: '2024-02-15-preview' },
        { name: '2023-12-01-preview', value: '2023-12-01-preview' },
        { name: '2023-05-15', value: '2023-05-15' }
      ],
      default: '2024-02-15-preview'
    },
    {
      type: 'confirm',
      name: 'enabled',
      message: 'Enable this provider?',
      default: true
    }
  ]);

  const baseUrl = `${answers.endpoint}/openai/deployments/${answers.deploymentName}/chat/completions?api-version=${answers.apiVersion}`;

  return {
    id: "azure-openai",
    providerType: "azure-openai",
    apiKeyEnvVar: answers.apiKey,
    baseUrl: baseUrl,
    model: answers.deploymentName,
    headers: {},
    bodyTemplate: JSON.stringify({
      messages: [
        {
          role: "system",
          content: "{systemPrompt}"
        },
        {
          role: "user",
          content: "{prompt}\\n\\nCode to analyze:\\n```{language}\\n{code}\\n```"
        }
      ],
      max_tokens: 4000,
      temperature: 0.1
    }),
    timeout: 30000,
    maxTokens: 4000,
    temperature: 0.1,
    enabled: answers.enabled
  };
}

async function setupOllamaProvider(): Promise<any> {
  console.log(chalk.cyan.bold('\n🏠 Setting up Local Ollama'));
  console.log(chalk.gray('───────────────────────────'));
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseUrl',
      message: 'Ollama API URL:',
      default: 'http://localhost:11434/api/generate',
      validate: (input: string) => {
        const url = input.trim();
        return (url.startsWith('http://') || url.startsWith('https://')) || 'Please enter a valid URL';
      }
    },
    {
      type: 'input',
      name: 'model',
      message: 'Model name (must be pulled in Ollama):',
      default: 'codellama:7b',
      validate: (input: string) => input.trim().length > 0 || 'Model name is required'
    },
    {
      type: 'confirm',
      name: 'enabled',
      message: 'Enable this provider?',
      default: true
    }
  ]);

  return {
    id: "local-ollama",
    providerType: "custom-ollama",
    apiKeyEnvVar: null,
    baseUrl: answers.baseUrl,
    model: answers.model,
    headers: {},
    bodyTemplate: JSON.stringify({
      model: "{model}",
      prompt: "{systemPrompt}\\n\\n{prompt}\\n\\nCode to analyze:\\n```{language}\\n{code}\\n```",
      stream: false,
      options: {
        temperature: 0.1
      }
    }),
    timeout: 60000,
    maxTokens: 4000,
    temperature: 0.1,
    enabled: answers.enabled
  };
}

// Logs command implementation functions
async function showLogs(options: any): Promise<void> {
  const { ActivityLogger } = await import('./utils/ActivityLogger');
  const logger = ActivityLogger.getInstance();
  
  console.log(chalk.cyan.bold('📋 WOARU Activity Logs'));
  console.log(chalk.gray('─'.repeat(30)));
  
  let logs: string[] = [];
  
  // Apply filters
  if (options.project) {
    logs = await logger.getLogsByProject(options.project);
  } else if (options.action) {
    logs = await logger.getLogsByAction(options.action);
  } else if (options.since || options.until) {
    const startDate = options.since ? new Date(options.since + 'T00:00:00.000Z') : new Date(0);
    const endDate = options.until ? new Date(options.until + 'T23:59:59.999Z') : new Date();
    logs = await logger.getLogsByDateRange(startDate, endDate);
  } else {
    const tailLines = parseInt(options.tail) || 50;
    logs = await logger.getRecentLogs(tailLines);
  }
  
  // Export if requested
  if (options.export) {
    const outputFile = options.output || `woaru-logs-${new Date().toISOString().split('T')[0]}.${options.export}`;
    await logger.exportLogs(options.export, outputFile);
    console.log(chalk.green(`✅ Logs exported to: ${outputFile}`));
    return;
  }
  
  // Display logs
  if (logs.length === 0) {
    console.log(chalk.yellow('⚠️ No logs found matching criteria'));
    return;
  }
  
  console.log(chalk.blue(`📊 Showing ${logs.length} log entries:`));
  console.log();
  
  logs.forEach((log, index) => {
    const formatted = logger.formatLogEntry(log);
    if (formatted) {
      const statusColor = formatted.status === 'SUCCESS' ? chalk.green : 
                         formatted.status === 'ERROR' ? chalk.red : chalk.yellow;
      const timestamp = new Date(formatted.timestamp).toLocaleString();
      
      console.log(`${chalk.gray(String(index + 1).padStart(3, ' '))}. ${statusColor(formatted.status.padEnd(7, ' '))} ${chalk.blue(timestamp)} | ${chalk.cyan(formatted.action)}`);
      console.log(`     ${chalk.gray(formatted.details)}`);
      console.log();
    } else {
      console.log(`${chalk.gray(String(index + 1).padStart(3, ' '))}. ${chalk.dim(log)}`);
    }
  });
  
  // Show active actions
  const activeActions = logger.getActiveActions();
  if (activeActions.size > 0) {
    console.log(chalk.yellow('🔄 Active Actions:'));
    activeActions.forEach((action, id) => {
      const duration = Date.now() - action.performance.startTime;
      console.log(`   ${chalk.cyan(action.action)} | ${chalk.gray(action.command)} | ${chalk.yellow(duration + 'ms')}`);
    });
  }
}

async function clearLogs(options: any): Promise<void> {
  const { ActivityLogger } = await import('./utils/ActivityLogger');
  const logger = ActivityLogger.getInstance();
  
  if (!options.confirm) {
    const { confirmClear } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmClear',
        message: 'Are you sure you want to clear all WOARU activity logs?',
        default: false
      }
    ]);
    
    if (!confirmClear) {
      console.log(chalk.yellow('⚠️ Log clearing cancelled'));
      return;
    }
  }
  
  console.log(chalk.cyan('🗑️ Clearing activity logs...'));
  
  await logger.clearLogs();
  
  console.log(chalk.green('✅ All activity logs cleared'));
}

async function showLogStats(): Promise<void> {
  const { ActivityLogger } = await import('./utils/ActivityLogger');
  const logger = ActivityLogger.getInstance();
  
  console.log(chalk.cyan.bold('📊 WOARU Log Statistics'));
  console.log(chalk.gray('─'.repeat(30)));
  
  const stats = await logger.getLogStats();
  
  console.log(`📁 **Log File:** ${logger.getLogFilePath()}`);
  console.log(`📏 **File Size:** ${(stats.fileSize / 1024).toFixed(2)} KB`);
  console.log(`📋 **Total Entries:** ${stats.totalLines}`);
  
  if (stats.oldestEntry) {
    const oldestFormatted = logger.formatLogEntry(stats.oldestEntry);
    if (oldestFormatted) {
      console.log(`📅 **Oldest Entry:** ${new Date(oldestFormatted.timestamp).toLocaleString()}`);
    }
  }
  
  if (stats.newestEntry) {
    const newestFormatted = logger.formatLogEntry(stats.newestEntry);
    if (newestFormatted) {
      console.log(`🆕 **Newest Entry:** ${new Date(newestFormatted.timestamp).toLocaleString()}`);
    }
  }
  
  // Show active actions
  const activeActions = logger.getActiveActions();
  if (activeActions.size > 0) {
    console.log(`🔄 **Active Actions:** ${activeActions.size}`);
    activeActions.forEach((action, id) => {
      const duration = Date.now() - action.performance.startTime;
      console.log(`   ${chalk.cyan(action.action)} | ${chalk.gray(duration + 'ms')}`);
    });
  } else {
    console.log(`🔄 **Active Actions:** 0`);
  }
}

// Show help if no command provided
if (process.argv.length === 2) {
  program.help();
}

program.parse();
