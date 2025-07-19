// WOARU Splash Screen
// Simple text-based logo display

export const displaySplashScreen = async () => {
  const chalk = require('chalk');
  const fs = require('fs-extra');
  const path = require('path');

  // Import i18n function
  const { t } = await import('../config/i18n');

  // Get version from package.json
  const packagePath = path.resolve(__dirname, '../../package.json');
  const packageData = await fs.readJson(packagePath);
  const version = packageData.version;

  // Display simple text-based logo
  console.log();
  console.log(
    chalk.cyan.bold(`🤖 WOARU - HELPS YOU TO WRITE YOUR BEST CODE POSSIBLE`)
  );
  console.log(chalk.gray(`   Version ${version}`));
  console.log();
  console.log(chalk.white(t('ui.quick_commands')));
  console.log(
    chalk.gray(`  • woaru analyze        - ${t('commands.analyze.description')}`)
  );
  console.log(
    chalk.gray(`  • woaru watch          - ${t('commands.watch.description')}`)
  );
  console.log(
    chalk.gray(`  • woaru review         - ${t('commands.review.description')}`)
  );
  console.log(
    chalk.gray(`  • woaru setup          - ${t('commands.setup.description')}`)
  );
  console.log(
    chalk.gray(`  • woaru commands       - ${t('commands.commands.description')}`)
  );
  console.log();
  console.log(chalk.yellow(`💡 ${t('ui.run_commands_help')}`));
  console.log();
};

export const WOARU_COMPACT_LOGO = `
\x1b[36m ╔══════════════════════════════════════════════════════════════╗
\x1b[36m ║  \x1b[33m📢\x1b[36m \x1b[37m●●●\x1b[36m \x1b[32m✓✓✓\x1b[36m   \x1b[1m\x1b[33mWOARU\x1b[0m\x1b[36m                       \x1b[33m📦\x1b[36m         ║
\x1b[36m ╚══════════════════════════════════════════════════════════════╝
\x1b[0m`;

export const WOARU_MINI_LOGO = `\x1b[33m📢\x1b[36m \x1b[37m●●●\x1b[36m \x1b[32m✓✓✓\x1b[36m \x1b[1m\x1b[33mWOARU\x1b[0m\x1b[36m \x1b[33m📦\x1b[0m`;
