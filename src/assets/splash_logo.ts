/**
 * WOARU Splash Screen Module
 * Production-Ready implementation with comprehensive security and error handling
 */

import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { t, initializeI18n } from '../config/i18n';

/**
 * Type definition for package.json structure
 */
interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Configuration for splash screen display
 */
interface SplashConfig {
  showVersion: boolean;
  showCommands: boolean;
  maxVersionLength: number;
}

/**
 * Default splash screen configuration
 */
const DEFAULT_SPLASH_CONFIG: SplashConfig = {
  showVersion: true,
  showCommands: true,
  maxVersionLength: 20,
};

/**
 * Sanitizes version string to prevent injection attacks
 * @param version - The version string to sanitize
 * @returns Sanitized version string safe for display
 */
function sanitizeVersion(version: unknown): string {
  if (typeof version !== 'string') {
    return 'unknown';
  }

  // Remove dangerous characters and limit length
  const sanitized = version
    .replace(/[^\w.-]/g, '')
    .substring(0, DEFAULT_SPLASH_CONFIG.maxVersionLength);

  // Validate version format (basic semver pattern)
  const versionPattern = /^\d+\.\d+\.\d+/;
  if (!versionPattern.test(sanitized)) {
    return 'unknown';
  }

  return sanitized;
}

/**
 * Type guard for package.json validation
 * @param packageData - Package data to validate
 * @returns True if packageData is valid PackageJson
 */
function isValidPackageJson(packageData: unknown): packageData is PackageJson {
  return (
    typeof packageData === 'object' &&
    packageData !== null &&
    (typeof (packageData as PackageJson).version === 'string' ||
      typeof (packageData as PackageJson).version === 'undefined')
  );
}

/**
 * Safely loads package.json with comprehensive error handling
 * @returns Promise<string> The sanitized version string
 */
async function loadVersionSafely(): Promise<string> {
  try {
    const packagePath = path.resolve(__dirname, '../../package.json');

    // Validate path security
    const normalizedPath = path.normalize(packagePath);
    if (!normalizedPath.endsWith('package.json')) {
      console.debug('Invalid package.json path detected');
      return 'unknown';
    }

    const packageData = await fs.readJson(normalizedPath);

    if (!isValidPackageJson(packageData)) {
      console.debug('Invalid package.json structure');
      return 'unknown';
    }

    return sanitizeVersion(packageData.version);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.debug(`Version loading failed: ${sanitizeVersion(errorMessage)}`);
    return 'unknown';
  }
}

/**
 * Main splash screen display function with Production-Ready implementation
 * Implements comprehensive security validation and error handling
 *
 * @param config - Optional configuration for splash display
 */
export async function displaySplashScreen(
  config: Partial<SplashConfig> = {}
): Promise<void> {
  const finalConfig = { ...DEFAULT_SPLASH_CONFIG, ...config };

  try {
    // Initialize i18n first with error handling
    await initializeI18n();

    // Load version safely
    const version = finalConfig.showVersion ? await loadVersionSafely() : null;

    // Display properly framed ASCII art splash screen
    console.log();
    console.log(WOARU_FRAMED_SPLASH);

    if (version && finalConfig.showVersion) {
      console.log(
        chalk.gray(`   Version ${version}`)
      );
    }

    console.log();

    // Display commands section if enabled
    if (finalConfig.showCommands) {
      await displayCommandsSection();
    }

    console.log();
  } catch {
    // Fallback display with English defaults if i18n fails
    await displayFallbackSplash(finalConfig);
  }
}

/**
 * Displays the commands section with proper error handling
 */
async function displayCommandsSection(): Promise<void> {
  try {
    console.log(chalk.white(t('ui.quick_commands')));

    const commands = [
      { name: 'analyze', key: 'commands.analyze.description' },
      { name: 'watch', key: 'commands.watch.description' },
      { name: 'review', key: 'commands.review.description' },
      { name: 'setup', key: 'commands.setup.description' },
      { name: 'commands', key: 'commands.commands.description' },
    ];

    for (const command of commands) {
      try {
        const description = t(command.key);
        console.log(
          chalk.gray(`  • woaru ${command.name.padEnd(12)} - ${description}`)
        );
      } catch {
        // Skip individual command if translation fails
        console.debug(`Command translation failed for: ${command.name}`);
      }
    }

    console.log();
    console.log(chalk.yellow(`💡 ${t('ui.run_commands_help')}`));
  } catch {
    // Fallback commands display
    console.log(chalk.white(t('ui.quick_commands')));
    console.log(chalk.gray(t('ui.command_analyze_desc')));
    console.log(chalk.gray(t('ui.command_commands_desc')));
  }
}

/**
 * Fallback splash display when i18n or other systems fail
 * @param config - Splash configuration
 */
async function displayFallbackSplash(config: SplashConfig): Promise<void> {
  try {
    console.log();
    console.log(WOARU_FRAMED_SPLASH);

    if (config.showVersion) {
      const version = await loadVersionSafely();
      console.log(chalk.gray(`   Version ${version}`));
    }

    console.log();

    if (config.showCommands) {
      console.log(chalk.white('Quick Commands:'));
      console.log(chalk.gray('  • woaru analyze    - Analyze project'));
      console.log(chalk.gray('  • woaru commands   - Show all commands'));
      console.log();
      console.log(chalk.yellow('💡 Type "woaru --help" to see all available commands'));
    }

    console.log();
  } catch {
    // Final fallback - minimal safe output with framed display
    console.log();
    console.log(WOARU_FRAMED_SPLASH);
    console.log();
  }
}

/**
 * Static logo components with secure ANSI escape sequences
 * These are pre-sanitized and safe for display
 */
export const WOARU_COMPACT_LOGO = `
\x1b[36m ╔══════════════════════════════════════════════════════════════╗
\x1b[36m ║  \x1b[33m📢\x1b[36m \x1b[37m●●●\x1b[36m \x1b[32m✓✓✓\x1b[36m   \x1b[1m\x1b[33mWOARU\x1b[0m\x1b[36m                       \x1b[33m📦\x1b[36m         ║
\x1b[36m ╚══════════════════════════════════════════════════════════════╝
\x1b[0m`;

export const WOARU_MINI_LOGO = `\x1b[33m📢\x1b[36m \x1b[37m●●●\x1b[36m \x1b[32m✓✓✓\x1b[36m \x1b[1m\x1b[33mWOARU\x1b[0m\x1b[36m \x1b[33m📦\x1b[0m`;

/**
 * Properly framed splash screen with exact character width control
 * Language-independent hardcoded content ensures consistent frame rendering
 * Frame width: 66 characters total (64 + 2 borders)
 * Content area: 62 characters (including padding)
 */
export const WOARU_FRAMED_SPLASH = `\x1b[36m╔══════════════════════════════════════════════════════════════╗
\x1b[36m║ \x1b[33m🤖 WOARU - HELPS YOU TO WRITE YOUR BEST CODE POSSIBLE        \x1b[36m║
\x1b[36m╚══════════════════════════════════════════════════════════════╝\x1b[0m`;

/**
 * Legacy export for backward compatibility
 * @deprecated Use displaySplashScreen instead
 */
export const displaySplashScreenLegacy = displaySplashScreen;
