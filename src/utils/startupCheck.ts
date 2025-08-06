/**
 * WOARU Startup Check Module
 * Production-Ready implementation with comprehensive security and error handling
 */

import { spawn } from 'child_process';
import fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { VersionManager } from './versionManager';
import { t, initializeI18n } from '../config/i18n';

/**
 * Type definition for version information
 */
interface VersionInfo {
  isUpToDate: boolean;
  latest?: string;
  releaseDate?: string;
  current?: string;
}

/**
 * Type definition for tool availability check result
 */
interface ToolAvailabilityResult {
  available: boolean;
  error?: string;
  version?: string;
}

/**
 * Type definition for environment check result
 */
interface EnvironmentCheckResult {
  errors: string[];
  warnings: string[];
  toolsAvailable: {
    git: boolean;
    docker: boolean;
    snyk: boolean;
  };
}

/**
 * Type definition for version check result
 */
interface VersionCheckResult {
  updated: boolean;
  errors: string[];
  versionInfo?: VersionInfo;
}

/**
 * Type definition for complete startup check result
 */
interface StartupCheckResult {
  versionCheck: boolean;
  environmentCheck: boolean;
  errors: string[];
  warnings: string[];
  toolsAvailable?: {
    git: boolean;
    docker: boolean;
    snyk: boolean;
  };
  cacheUsed: boolean;
}

/**
 * Sanitizes error messages to prevent information leakage
 * @param error - The error to sanitize
 * @returns Sanitized error message safe for display
 */
function sanitizeErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    // Remove sensitive paths and limit length
    return error.replace(/\/[^\s]*\/[^\s]*/g, '[PATH]').substring(0, 200);
  }

  if (error instanceof Error) {
    return sanitizeErrorMessage(error.message);
  }

  return 'Unknown error occurred';
}

/**
 * Validates command name to prevent injection attacks
 * @param command - Command name to validate
 * @returns True if command name is safe
 */
function isValidCommand(command: string): boolean {
  const validCommands = ['git', 'docker', 'snyk'];
  return validCommands.includes(command) && /^[a-zA-Z0-9-_]+$/.test(command);
}

/**
 * Type guard for version info validation
 * @param versionInfo - Version info to validate
 * @returns True if version info is valid
 */
function isValidVersionInfo(versionInfo: unknown): versionInfo is VersionInfo {
  return (
    typeof versionInfo === 'object' &&
    versionInfo !== null &&
    typeof (versionInfo as VersionInfo).isUpToDate === 'boolean'
  );
}

export class StartupCheck {
  /**
   * Secure command execution using spawn instead of execSync
   * Prevents command injection vulnerabilities
   */
  private static secureCommandExecution(
    command: string,
    args: string[],
    timeout: number
  ): Promise<string> {
    return new Promise(resolve => {
      const process = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout,
      });

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', data => {
        output += data.toString();
      });

      process.stderr.on('data', data => {
        errorOutput += data.toString();
      });

      process.on('close', code => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          console.error(`Command failed: ${command}`, errorOutput);
          resolve('');
        }
      });

      process.on('error', error => {
        console.error(`Command error: ${command}`, error);
        resolve('');
      });
    });
  }
  private static readonly CACHE_FILE = path.join(
    process.env.HOME || process.env.USERPROFILE || '~',
    '.woaru',
    'startup-cache.json'
  );
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private static readonly MAX_CACHE_SIZE = 1024; // Maximum cache file size in bytes

  /**
   * Check if we should run the startup check based on cache
   * Implements secure cache validation with size limits
   */
  private static shouldRunCheck(): boolean {
    try {
      if (!fs.existsSync(this.CACHE_FILE)) {
        return true;
      }

      // Check cache file size for security
      const stats = fs.statSync(this.CACHE_FILE);
      if (stats.size > this.MAX_CACHE_SIZE) {
        console.debug('Cache file too large, running check');
        return true;
      }

      const cache = fs.readJsonSync(this.CACHE_FILE);

      // Validate cache structure
      if (
        typeof cache !== 'object' ||
        cache === null ||
        typeof cache.timestamp !== 'number'
      ) {
        console.debug('Invalid cache structure, running check');
        return true;
      }

      const now = Date.now();
      const cacheAge = now - cache.timestamp;

      // Validate timestamp is reasonable (not in future, not too old)
      if (
        cache.timestamp > now ||
        cache.timestamp < now - 365 * 24 * 60 * 60 * 1000
      ) {
        console.debug('Invalid cache timestamp, running check');
        return true;
      }

      return cacheAge > this.CACHE_DURATION;
    } catch (error) {
      console.debug(`Cache check failed: ${sanitizeErrorMessage(error)}`);
      return true;
    }
  }

  /**
   * Update the cache timestamp with security validation
   */
  private static updateCache(): void {
    try {
      // Validate cache directory path
      const woaruDir = path.dirname(this.CACHE_FILE);
      const normalizedDir = path.normalize(woaruDir);

      // Ensure path is within expected bounds
      if (!normalizedDir.includes('.woaru')) {
        console.debug('Invalid cache directory path');
        return;
      }

      fs.ensureDirSync(normalizedDir);

      const cache = {
        timestamp: Date.now(),
        lastCheck: new Date().toISOString(),
        version: '1.0', // Cache format version
      };

      // Write with restricted permissions
      fs.writeJsonSync(this.CACHE_FILE, cache, { spaces: 2 });

      // Set restrictive file permissions (Unix-like systems)
      try {
        fs.chmodSync(this.CACHE_FILE, 0o600);
      } catch {
        // Ignore permission errors on Windows
      }
    } catch (error) {
      console.debug(`Cache update failed: ${sanitizeErrorMessage(error)}`);
    }
  }

  /**
   * Check if git is available in the system with security validation
   */
  private static async checkGitAvailability(): Promise<ToolAvailabilityResult> {
    try {
      await initializeI18n();

      if (!isValidCommand('git')) {
        return {
          available: false,
          error: t('startup_check.git_not_available'),
        };
      }

      // Use secure spawn instead of execSync
      const output = await this.secureCommandExecution(
        'git',
        ['--version'],
        5000
      );
      if (!output) {
        return {
          available: false,
          error: t('startup_check.git_command_failed'),
        };
      }

      // Extract version for logging (optional)
      const versionMatch = output.toString().match(/git version ([\d.]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      return {
        available: true,
        version: sanitizeErrorMessage(version),
      };
    } catch {
      return {
        available: false,
        error: t('startup_check.git_not_available'),
      };
    }
  }

  /**
   * Check if docker is available (optional) with security validation
   */
  private static async checkDockerAvailability(): Promise<ToolAvailabilityResult> {
    try {
      await initializeI18n();

      if (!isValidCommand('docker')) {
        return {
          available: false,
          error: t('startup_check.docker_not_available'),
        };
      }

      // Use secure spawn instead of execSync
      const output = await this.secureCommandExecution(
        'docker',
        ['--version'],
        5000
      );
      if (!output) {
        return {
          available: false,
          error: t('startup_check.docker_command_failed'),
        };
      }

      const versionMatch = output.toString().match(/Docker version ([\d.]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      return {
        available: true,
        version: sanitizeErrorMessage(version),
      };
    } catch {
      return {
        available: false,
        error: t('startup_check.docker_not_available'),
      };
    }
  }

  /**
   * Check if snyk is available (optional) with security validation
   */
  private static async checkSnykAvailability(): Promise<ToolAvailabilityResult> {
    try {
      await initializeI18n();

      if (!isValidCommand('snyk')) {
        return {
          available: false,
          error: t('startup_check.snyk_not_available'),
        };
      }

      // Use secure spawn instead of execSync
      const output = await this.secureCommandExecution(
        'snyk',
        ['--version'],
        10000
      );
      if (!output) {
        return {
          available: false,
          error: t('startup_check.snyk_command_failed'),
        };
      }

      const version = output.toString().trim();

      return {
        available: true,
        version: sanitizeErrorMessage(version),
      };
    } catch {
      return {
        available: false,
        error: t('startup_check.snyk_not_available'),
      };
    }
  }

  /**
   * Perform environment checks with comprehensive validation
   */
  private static async performEnvironmentCheck(): Promise<EnvironmentCheckResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const toolsAvailable = {
      git: false,
      docker: false,
      snyk: false,
    };

    try {
      await initializeI18n();

      // Check Git (required) with parallel execution safety
      const gitCheck = await this.checkGitAvailability();
      toolsAvailable.git = gitCheck.available;

      if (!gitCheck.available) {
        errors.push(`${t('startup_check.warning_prefix')} ${gitCheck.error}`);
        warnings.push(t('startup_check.git_commands_warning'));
      }

      // Check Docker (optional)
      const dockerCheck = await this.checkDockerAvailability();
      toolsAvailable.docker = dockerCheck.available;

      if (!dockerCheck.available) {
        warnings.push(t('startup_check.docker_tip'));
      }

      // Check Snyk (optional)
      const snykCheck = await this.checkSnykAvailability();
      toolsAvailable.snyk = snykCheck.available;

      if (!snykCheck.available) {
        warnings.push(t('startup_check.snyk_tip'));
      }

      return { errors, warnings, toolsAvailable };
    } catch (error) {
      // Fallback error handling
      const sanitizedError = sanitizeErrorMessage(error);
      console.debug(`Environment check failed: ${sanitizedError}`);

      return {
        errors: ['Environment check failed'],
        warnings: ['Some tools may not be available'],
        toolsAvailable,
      };
    }
  }

  /**
   * Perform version check and prompt for update if needed with security validation
   */
  private static async performVersionCheck(): Promise<VersionCheckResult> {
    const errors: string[] = [];

    try {
      await initializeI18n();

      const versionInfo = await VersionManager.checkVersion();

      // Validate version info structure
      if (!isValidVersionInfo(versionInfo)) {
        errors.push(
          t('startup_check.version_check_failed', {
            error: 'Invalid version information',
          })
        );
        return { updated: false, errors };
      }

      if (!versionInfo.isUpToDate && versionInfo.latest) {
        // Sanitize version string before display
        const sanitizedVersion = sanitizeErrorMessage(versionInfo.latest);

        console.log(
          chalk.yellow(
            t('startup_check.new_version_available', {
              version: sanitizedVersion,
            })
          )
        );

        if (versionInfo.releaseDate) {
          const sanitizedDate = sanitizeErrorMessage(versionInfo.releaseDate);
          console.log(
            chalk.gray(
              `   ${t('startup_check.released_on', { date: sanitizedDate })}`
            )
          );
        }

        try {
          const answer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'update',
              message: t('startup_check.update_prompt'),
              default: false,
              timeout: 30000, // 30 second timeout
            },
          ]);

          // Validate answer structure
          if (
            typeof answer !== 'object' ||
            answer === null ||
            typeof answer.update !== 'boolean'
          ) {
            console.debug('Invalid user input received');
            return { updated: false, errors, versionInfo };
          }

          if (answer.update) {
            try {
              await VersionManager.updateToLatest();
              return { updated: true, errors: [], versionInfo };
            } catch (updateError) {
              const sanitizedError = sanitizeErrorMessage(updateError);
              errors.push(
                t('startup_check.update_failed', { error: sanitizedError })
              );
              return { updated: false, errors, versionInfo };
            }
          }
        } catch (promptError) {
          // Handle prompt timeout or other issues
          console.debug(`Prompt failed: ${sanitizeErrorMessage(promptError)}`);
          return { updated: false, errors, versionInfo };
        }
      }

      return { updated: false, errors: [], versionInfo };
    } catch (error) {
      const sanitizedError = sanitizeErrorMessage(error);
      errors.push(
        t('startup_check.version_check_failed', { error: sanitizedError })
      );
      return { updated: false, errors };
    }
  }

  /**
   * Main startup check function with comprehensive error handling
   */
  static async performStartupCheck(): Promise<StartupCheckResult> {
    try {
      await initializeI18n();

      const cacheUsed = !this.shouldRunCheck();

      // Check if we should run the check based on cache
      if (cacheUsed) {
        return {
          versionCheck: true,
          environmentCheck: true,
          errors: [],
          warnings: [],
          cacheUsed: true,
        };
      }

      const result: StartupCheckResult = {
        versionCheck: true,
        environmentCheck: true,
        errors: [],
        warnings: [],
        cacheUsed: false,
      };

      // Perform environment check with error isolation
      try {
        const envCheck = await this.performEnvironmentCheck();
        result.errors.push(...envCheck.errors);
        result.warnings.push(...envCheck.warnings);
        result.toolsAvailable = envCheck.toolsAvailable;

        if (envCheck.errors.length > 0) {
          result.environmentCheck = false;
        }
      } catch (envError) {
        const sanitizedError = sanitizeErrorMessage(envError);
        result.errors.push(`Environment check failed: ${sanitizedError}`);
        result.environmentCheck = false;
      }

      // Perform version check with error isolation
      try {
        const versionCheck = await this.performVersionCheck();
        result.errors.push(...versionCheck.errors);

        if (versionCheck.errors.length > 0) {
          result.versionCheck = false;
        }
      } catch (versionError) {
        const sanitizedError = sanitizeErrorMessage(versionError);
        result.errors.push(
          t('startup_check.version_check_failed', { error: sanitizedError })
        );
        result.versionCheck = false;
      }

      // Update cache safely
      this.updateCache();

      // Display results with safe output
      await this.displayResults(result);

      return result;
    } catch (criticalError) {
      // Final fallback for catastrophic failures
      const sanitizedError = sanitizeErrorMessage(criticalError);
      console.error(`Critical startup check failure: ${sanitizedError}`);

      return {
        versionCheck: false,
        environmentCheck: false,
        errors: ['Critical startup check failure'],
        warnings: [],
        cacheUsed: false,
      };
    }
  }

  /**
   * Silent startup check (no interactive prompts) with enhanced security
   */
  static async performSilentStartupCheck(): Promise<StartupCheckResult> {
    try {
      await initializeI18n();

      const cacheUsed = !this.shouldRunCheck();

      // Check if we should run the check based on cache
      if (cacheUsed) {
        return {
          versionCheck: true,
          environmentCheck: true,
          errors: [],
          warnings: [],
          cacheUsed: true,
        };
      }

      const result: StartupCheckResult = {
        versionCheck: true,
        environmentCheck: true,
        errors: [],
        warnings: [],
        cacheUsed: false,
      };

      // Perform environment check with isolation
      try {
        const envCheck = await this.performEnvironmentCheck();
        result.errors.push(...envCheck.errors);
        result.warnings.push(...envCheck.warnings);
        result.toolsAvailable = envCheck.toolsAvailable;

        if (envCheck.errors.length > 0) {
          result.environmentCheck = false;
        }
      } catch (envError) {
        const sanitizedError = sanitizeErrorMessage(envError);
        result.errors.push(`Environment check failed: ${sanitizedError}`);
        result.environmentCheck = false;
      }

      // Silent version check (no prompts) with validation
      try {
        const versionInfo = await VersionManager.checkVersion();

        if (
          isValidVersionInfo(versionInfo) &&
          !versionInfo.isUpToDate &&
          versionInfo.latest
        ) {
          const sanitizedVersion = sanitizeErrorMessage(versionInfo.latest);
          result.warnings.push(
            t('startup_check.new_version_silent', { version: sanitizedVersion })
          );
        }
      } catch (error) {
        const sanitizedError = sanitizeErrorMessage(error);
        result.errors.push(
          t('startup_check.version_check_failed', { error: sanitizedError })
        );
        result.versionCheck = false;
      }

      // Update cache
      this.updateCache();

      return result;
    } catch (criticalError) {
      // Final fallback
      const sanitizedError = sanitizeErrorMessage(criticalError);
      console.debug(`Silent startup check failed: ${sanitizedError}`);

      return {
        versionCheck: false,
        environmentCheck: false,
        errors: ['Silent startup check failed'],
        warnings: [],
        cacheUsed: false,
      };
    }
  }

  /**
   * Display startup check results with safe i18n output
   */
  private static async displayResults(
    result: StartupCheckResult
  ): Promise<void> {
    try {
      // Display warnings if any
      if (result.warnings.length > 0) {
        console.log(chalk.yellow(`\n${t('startup_check.startup_notes')}`));
        result.warnings.forEach(warning => {
          console.log(`   ${warning}`);
        });
      }

      // Display errors if any
      if (result.errors.length > 0) {
        console.log(chalk.red(`\n${t('startup_check.startup_problems')}`));
        result.errors.forEach(error => {
          console.log(`   ${error}`);
        });
      }
    } catch {
      // Fallback display
      console.log('\n📋 Startup Notes:');
      result.warnings.forEach(warning => console.log(`   ${warning}`));

      if (result.errors.length > 0) {
        console.log('\n❌ Startup Problems:');
        result.errors.forEach(error => console.log(`   ${error}`));
      }
    }
  }
}
