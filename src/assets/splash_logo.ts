// WOARU Splash Screen
// Simple text-based logo display

export const displaySplashScreen = async () => {
  const chalk = require('chalk');
  const fs = require('fs-extra');
  const path = require('path');

  // Get version from package.json
  const packagePath = path.resolve(__dirname, '../../package.json');
  const packageData = await fs.readJson(packagePath);
  const version = packageData.version;

  // Display simple text-based logo
  console.log();
  console.log(chalk.cyan.bold(`🤖 WOARU - HELPS YOU TO WRITE YOUR BEST CODE POSSIBLE`));
  console.log(chalk.gray(`   Version ${version}`));
  console.log();
  console.log(chalk.white('Quick Commands:'));
  console.log(
    chalk.gray('  • woaru analyze        - Comprehensive project analysis')
  );
  console.log(
    chalk.gray('  • woaru watch          - Start continuous monitoring')
  );
  console.log(
    chalk.gray('  • woaru review         - Code review and analysis')
  );
  console.log(chalk.gray('  • woaru setup          - Setup development tools & ai'));
  console.log(
    chalk.gray('  • woaru commands       - Show all available commands')
  );
  console.log();
  console.log(chalk.yellow('💡 Run "woaru commands" for detailed help'));
  console.log();
};

export const WOARU_COMPACT_LOGO = `
\x1b[36m ╔══════════════════════════════════════════════════════════════╗
\x1b[36m ║  \x1b[33m📢\x1b[36m \x1b[37m●●●\x1b[36m \x1b[32m✓✓✓\x1b[36m   \x1b[1m\x1b[33mWOARU\x1b[0m\x1b[36m                       \x1b[33m📦\x1b[36m         ║
\x1b[36m ╚══════════════════════════════════════════════════════════════╝
\x1b[0m`;

export const WOARU_MINI_LOGO = `\x1b[33m📢\x1b[36m \x1b[37m●●●\x1b[36m \x1b[32m✓✓✓\x1b[36m \x1b[1m\x1b[33mWOARU\x1b[0m\x1b[36m \x1b[33m📦\x1b[0m`;
