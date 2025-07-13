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
  .command('analyze')
  .description('Analyze current project and get recommendations')
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

program
  .command('setup')
  .description('Automatically setup recommended tools')
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
  woaru review git                    # Analyze changes since main branch
  woaru review git --branch develop  # Analyze changes since develop branch
  woaru review local                  # Analyze uncommitted changes
  woaru review path src/components    # Analyze specific directory
  woaru review path src/file.ts       # Analyze specific file
`
  );

// Review git sub-command (original review functionality)
reviewCommand
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

// Review local sub-command (uncommitted changes)
reviewCommand
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

// Review path sub-command (specific files/directories)
reviewCommand
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

program
  .command('analyze')
  .description('Comprehensive project analysis including security audit')
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
      name: '🔍 woaru analyze',
      description: 'Comprehensive project analysis including security audit',
      usage: 'woaru analyze [options]',
      purpose:
        'Performs a full analysis of your project including code quality, security vulnerabilities, production readiness, and tool recommendations. Perfect for understanding the overall health of your codebase.',
    },
    {
      name: '👁️ woaru watch',
      description: 'Start WOARU supervisor to continuously monitor the project',
      usage: 'woaru watch [options]',
      purpose:
        'Continuously monitors your project for changes and provides real-time recommendations. Automatically detects new issues as you code and suggests improvements.',
    },
    {
      name: '⚙️ woaru setup',
      description: 'Automatically setup recommended tools',
      usage: 'woaru setup [options]',
      purpose:
        'Automatically installs and configures development tools based on your project analysis. Saves time by setting up linters, formatters, git hooks, and other productivity tools.',
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
      usage: 'woaru review <git|local|path> [options]',
      purpose:
        'Focused analysis tools for code reviews. Choose from git diff analysis, uncommitted changes review, or specific file/directory analysis.',
      subcommands: [
        {
          name: 'woaru review git',
          description: 'Analyze changes since a specific branch (git diff)',
          usage: 'woaru review git [--branch <name>]',
          purpose:
            'Analyzes changes between your current branch and a base branch (default: main). Perfect for code review preparation and CI/CD quality gates.',
        },
        {
          name: 'woaru review local',
          description: 'Analyze uncommitted changes in working directory',
          usage: 'woaru review local',
          purpose:
            'Reviews your uncommitted changes before you commit them. Helps catch issues early and ensures code quality before pushing to remote.',
        },
        {
          name: 'woaru review path',
          description: 'Analyze specific files or directories',
          usage: 'woaru review path <file_or_directory>',
          purpose:
            'Focused analysis of specific files or directories. Useful for deep-diving into particular components or modules of your codebase.',
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

program
  .command('commands')
  .description('Show detailed command reference documentation')
  .action(() => {
    displayCommandReference();
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error(
    chalk.red('❌ Invalid command. Use --help to see available commands.')
  );
  process.exit(1);
});

// Show help if no command provided
if (process.argv.length === 2) {
  program.help();
}

program.parse();
