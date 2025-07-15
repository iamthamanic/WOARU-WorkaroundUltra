// WOARU Dynamic ASCII Art Splash Screen
// Generates high-quality ASCII art from PNG logo using image-to-ascii library

import { generateTerminalOptimizedAsciiArt, generateCompactAsciiArt } from '../utils/asciiArtGenerator';

export const displaySplashScreen = async () => {
  const chalk = require('chalk');
  const fs = require('fs-extra');
  const path = require('path');

  // Get version from package.json
  const packagePath = path.resolve(__dirname, '../../package.json');
  const packageData = await fs.readJson(packagePath);
  const version = packageData.version;

  try {
    // Generate dynamic ASCII art from PNG logo
    console.log();
    
    // Check terminal size for appropriate ASCII art
    const terminalWidth = process.stdout.columns || 80;
    const terminalHeight = process.stdout.rows || 24;
    
    let asciiArt: string;
    if (terminalWidth >= 100 && terminalHeight >= 20) {
      // Use full terminal-optimized ASCII art for larger terminals
      asciiArt = await generateTerminalOptimizedAsciiArt();
    } else {
      // Use compact ASCII art for smaller terminals
      asciiArt = await generateCompactAsciiArt();
    }
    
    // Output ASCII art directly to stdout for proper rendering
    process.stdout.write(asciiArt);
    process.stdout.write('\n');
    
  } catch (error) {
    // Fallback to compact logo if ASCII generation fails
    console.log();
    console.log(WOARU_COMPACT_LOGO);
  }
  console.log(chalk.cyan.bold(`🤖 WOARU - YOUR TECH LEAD IN A BOX`));
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
  console.log(chalk.gray('  • woaru setup          - Setup development tools'));
  console.log(
    chalk.gray('  • woaru commands       - Show all available commands')
  );
  console.log();
  console.log(chalk.yellow('💡 Run "woaru commands" for detailed help'));
  console.log();
};

export const WOARU_COMPACT_LOGO = `
\x1b[36m ╔══════════════════════════════════════════════════════════════╗
\x1b[36m ║  \x1b[33m📢\x1b[36m \x1b[37m●●●\x1b[36m \x1b[32m✓✓✓\x1b[36m   \x1b[1m\x1b[33mWOARU\x1b[0m\x1b[36m - Tech Lead in a Box   \x1b[33m📦\x1b[36m         ║
\x1b[36m ╚══════════════════════════════════════════════════════════════╝
\x1b[0m`;

export const WOARU_MINI_LOGO = `\x1b[33m📢\x1b[36m \x1b[37m●●●\x1b[36m \x1b[32m✓✓✓\x1b[36m \x1b[1m\x1b[33mWOARU\x1b[0m\x1b[36m \x1b[33m📦\x1b[0m`;
