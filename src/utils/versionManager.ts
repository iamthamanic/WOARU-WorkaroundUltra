import { execSync, spawn } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

export interface VersionInfo {
  current: string;
  latest: string;
  isUpToDate: boolean;
  releaseDate?: string;
}

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
      console.error('Error reading package.json:', error);
      return 'unknown';
    }
  }

  /**
   * Get the latest version from npm registry
   */
  static async getLatestVersion(): Promise<string> {
    try {
      const result = execSync('npm view woaru version', { encoding: 'utf8' });
      return result.trim();
    } catch (error) {
      console.error('Error fetching latest version:', error);
      return 'unknown';
    }
  }

  /**
   * Get the release date of the latest version
   */
  static async getReleaseDate(): Promise<string | undefined> {
    try {
      const result = execSync('npm view woaru time.modified', { encoding: 'utf8' });
      const dateStr = result.trim();
      return new Date(dateStr).toLocaleDateString('de-DE');
    } catch (error) {
      console.error('Error fetching release date:', error);
      return undefined;
    }
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
      releaseDate
    };
  }

  /**
   * Display version information
   */
  static displayVersion(): void {
    const version = this.getCurrentVersion();
    console.log(`${chalk.blue('WOARU')} Version: ${chalk.green(version)}`);
  }

  /**
   * Display version check results
   */
  static async displayVersionCheck(): Promise<void> {
    console.log(chalk.blue('🔍 Checking for updates...'));
    
    const versionInfo = await this.checkVersion();
    
    if (versionInfo.isUpToDate) {
      console.log(chalk.green(`✅ Du verwendest die aktuellste Version (v${versionInfo.current})`));
    } else {
      console.log(chalk.yellow(`📦 Eine neue Version (v${versionInfo.latest}) ist verfügbar!`));
      if (versionInfo.releaseDate) {
        console.log(chalk.gray(`   Veröffentlicht am: ${versionInfo.releaseDate}`));
      }
      console.log(chalk.cyan('   Führe `woaru update` aus, um zu aktualisieren.'));
    }
  }

  /**
   * Update WOARU to the latest version
   */
  static async updateToLatest(): Promise<void> {
    console.log(chalk.blue('🚀 Updating WOARU to latest version...'));
    
    return new Promise((resolve, reject) => {
      const updateProcess = spawn('npm', ['install', '-g', 'woaru@latest'], {
        stdio: 'inherit'
      });

      updateProcess.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green('✅ Update erfolgreich abgeschlossen!'));
          resolve();
        } else {
          console.error(chalk.red(`❌ Update fehlgeschlagen (Exit Code: ${code})`));
          reject(new Error(`Update failed with exit code ${code}`));
        }
      });

      updateProcess.on('error', (error) => {
        console.error(chalk.red('❌ Update fehlgeschlagen:'), error);
        reject(error);
      });
    });
  }
}