import { spawn } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { t } from '../config/i18n';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * VersionManager handles version checking and updates for WOARU
 * Now with full i18n support for internationalized messages
 */

export interface VersionInfo {
  current: string;
  latest: string;
  isUpToDate: boolean;
  releaseDate?: string;
}

/**
 * Manages version checking and updates for WOARU
 *
 * This class provides utilities for:
 * - Checking the current installed version
 * - Fetching the latest available version from npm
 * - Comparing versions and displaying update notifications
 * - Performing self-updates of the WOARU package
 *
 * All user-facing messages are internationalized using the i18n system.
 */
export class VersionManager {
  private static packageJsonPath = path.join(__dirname, '../../package.json');

  /**
   * Get the current version from package.json
   */
  static getCurrentVersion(): string {
    try {
      const packageJson = fs.readJsonSync(this.packageJsonPath);
      return packageJson.version;
    } catch (error) {
      console.error(t('version_manager.error_reading_package'), error);
      return 'unknown';
    }
  }

  /**
   * Get the latest version from npm registry (secure implementation)
   */
  static async getLatestVersion(): Promise<string> {
    return new Promise(resolve => {
      // Use spawn instead of execSync for security
      const npmProcess = spawn('npm', ['view', 'woaru', 'version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10000, // 10 second timeout
      });

      let output = '';
      let errorOutput = '';

      npmProcess.stdout.on('data', data => {
        output += data.toString();
      });

      npmProcess.stderr.on('data', data => {
        errorOutput += data.toString();
      });

      npmProcess.on('close', code => {
        if (code === 0 && output.trim()) {
          resolve(output.trim());
        } else {
          console.error(
            t('version_manager.error_fetching_latest'),
            errorOutput
          );
          resolve('unknown');
        }
      });

      npmProcess.on('error', error => {
        console.error(t('version_manager.error_fetching_latest'), error);
        resolve('unknown');
      });
    });
  }

  /**
   * Get the release date of the latest version (secure implementation)
   */
  static async getReleaseDate(): Promise<string | undefined> {
    return new Promise(resolve => {
      // Use spawn instead of execSync for security
      const npmProcess = spawn('npm', ['view', 'woaru', 'time.modified'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10000, // 10 second timeout
      });

      let output = '';
      let errorOutput = '';

      npmProcess.stdout.on('data', data => {
        output += data.toString();
      });

      npmProcess.stderr.on('data', data => {
        errorOutput += data.toString();
      });

      npmProcess.on('close', code => {
        if (code === 0 && output.trim()) {
          const dateStr = output.trim();
          try {
            const formattedDate = new Date(dateStr).toLocaleDateString('de-DE');
            resolve(formattedDate);
          } catch (dateError) {
            console.error('Error parsing date:', dateError);
            resolve(undefined);
          }
        } else {
          console.error(
            t('version_manager.error_fetching_release_date'),
            errorOutput
          );
          resolve(undefined);
        }
      });

      npmProcess.on('error', error => {
        console.error(t('version_manager.error_fetching_release_date'), error);
        resolve(undefined);
      });
    });
  }

  /**
   * Check version status
   */
  static async checkVersion(): Promise<VersionInfo> {
    const current = this.getCurrentVersion();
    const latest = await this.getLatestVersion();
    const releaseDate = await this.getReleaseDate();

    return {
      current,
      latest,
      isUpToDate: current === latest,
      releaseDate,
    };
  }

  /**
   * Display version information
   */
  static displayVersion(): void {
    const version = this.getCurrentVersion();
    console.log(
      chalk.blue(
        t('version_manager.version_display', { version: chalk.green(version) })
      )
    );
  }

  /**
   * Display version check results
   */
  static async displayVersionCheck(): Promise<void> {
    console.log(chalk.blue(t('version_manager.checking_updates')));

    const versionInfo = await this.checkVersion();

    if (versionInfo.isUpToDate) {
      console.log(
        chalk.green(
          t('version_manager.up_to_date', { version: versionInfo.current })
        )
      );
    } else {
      console.log(
        chalk.yellow(
          t('version_manager.new_version_available', {
            version: versionInfo.latest,
          })
        )
      );
      if (versionInfo.releaseDate) {
        console.log(
          chalk.gray(
            t('version_manager.released_on', { date: versionInfo.releaseDate })
          )
        );
      }
      console.log(chalk.cyan(t('version_manager.update_instruction')));
    }
  }

  /**
   * Update WOARU to the latest version
   */
  static async updateToLatest(): Promise<void> {
    console.log(chalk.blue(t('version_manager.updating')));

    return new Promise((resolve, reject) => {
      const updateProcess = spawn('npm', ['install', '-g', 'woaru@latest'], {
        stdio: 'inherit',
      });

      updateProcess.on('close', code => {
        if (code === 0) {
          console.log(chalk.green(t('version_manager.update_success')));
          resolve();
        } else {
          console.error(
            chalk.red(t('version_manager.update_failed', { code }))
          );
          reject(new Error(`Update failed with exit code ${code}`));
        }
      });

      updateProcess.on('error', error => {
        console.error(chalk.red(t('version_manager.update_error')), error);
        reject(error);
      });
    });
  }
}
