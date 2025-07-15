import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { VersionManager } from './versionManager';

interface StartupCheckResult {
  versionCheck: boolean;
  environmentCheck: boolean;
  errors: string[];
  warnings: string[];
}

export class StartupCheck {
  private static readonly CACHE_FILE = path.join(process.env.HOME || '~', '.woaru', 'startup-cache.json');
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  /**
   * Check if we should run the startup check based on cache
   */
  private static shouldRunCheck(): boolean {
    try {
      if (!fs.existsSync(this.CACHE_FILE)) {
        return true;
      }

      const cache = fs.readJsonSync(this.CACHE_FILE);
      const now = Date.now();
      const cacheAge = now - cache.timestamp;

      return cacheAge > this.CACHE_DURATION;
    } catch (error) {
      // If we can't read the cache, run the check
      return true;
    }
  }

  /**
   * Update the cache timestamp
   */
  private static updateCache(): void {
    try {
      // Ensure the .woaru directory exists
      const woaruDir = path.dirname(this.CACHE_FILE);
      fs.ensureDirSync(woaruDir);

      const cache = {
        timestamp: Date.now(),
        lastCheck: new Date().toISOString()
      };

      fs.writeJsonSync(this.CACHE_FILE, cache);
    } catch (error) {
      // Silent fail - cache is optional
    }
  }

  /**
   * Check if git is available in the system
   */
  private static checkGitAvailability(): { available: boolean; error?: string } {
    try {
      execSync('git --version', { stdio: 'ignore' });
      return { available: true };
    } catch (error) {
      return { 
        available: false, 
        error: 'Git ist nicht in deinem System-PATH verfügbar' 
      };
    }
  }

  /**
   * Check if docker is available (optional)
   */
  private static checkDockerAvailability(): { available: boolean; error?: string } {
    try {
      execSync('docker --version', { stdio: 'ignore' });
      return { available: true };
    } catch (error) {
      return { 
        available: false, 
        error: 'Docker ist nicht verfügbar (optional)' 
      };
    }
  }

  /**
   * Check if snyk is available (optional)
   */
  private static checkSnykAvailability(): { available: boolean; error?: string } {
    try {
      execSync('snyk --version', { stdio: 'ignore' });
      return { available: true };
    } catch (error) {
      return { 
        available: false, 
        error: 'Snyk ist nicht verfügbar (optional für Security-Checks)' 
      };
    }
  }

  /**
   * Perform environment checks
   */
  private static async performEnvironmentCheck(): Promise<{ errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check Git (required)
    const gitCheck = this.checkGitAvailability();
    if (!gitCheck.available) {
      errors.push(`⚠️ WARNUNG: ${gitCheck.error}`);
      warnings.push('Befehle wie \'woaru review git\' werden nicht funktionieren.');
    }

    // Check Docker (optional)
    const dockerCheck = this.checkDockerAvailability();
    if (!dockerCheck.available) {
      warnings.push('💡 TIPP: Docker ist nicht verfügbar. Containerisierung-Checks werden übersprungen.');
    }

    // Check Snyk (optional)
    const snykCheck = this.checkSnykAvailability();
    if (!snykCheck.available) {
      warnings.push('💡 TIPP: Snyk ist nicht verfügbar. Erweiterte Security-Checks werden übersprungen.');
    }

    return { errors, warnings };
  }

  /**
   * Perform version check and prompt for update if needed
   */
  private static async performVersionCheck(): Promise<{ updated: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const versionInfo = await VersionManager.checkVersion();
      
      if (!versionInfo.isUpToDate) {
        console.log(chalk.yellow(`💡 Eine neue Version von WOARU (v${versionInfo.latest}) ist verfügbar!`));
        if (versionInfo.releaseDate) {
          console.log(chalk.gray(`   Veröffentlicht am: ${versionInfo.releaseDate}`));
        }
        
        const answer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'update',
            message: 'Möchtest du jetzt updaten?',
            default: false
          }
        ]);

        if (answer.update) {
          try {
            await VersionManager.updateToLatest();
            return { updated: true, errors: [] };
          } catch (error) {
            errors.push(`Update fehlgeschlagen: ${error}`);
            return { updated: false, errors };
          }
        }
      }
      
      return { updated: false, errors: [] };
    } catch (error) {
      errors.push(`Versions-Check fehlgeschlagen: ${error}`);
      return { updated: false, errors };
    }
  }

  /**
   * Main startup check function
   */
  static async performStartupCheck(): Promise<StartupCheckResult> {
    // Check if we should run the check based on cache
    if (!this.shouldRunCheck()) {
      return {
        versionCheck: true,
        environmentCheck: true,
        errors: [],
        warnings: []
      };
    }

    const result: StartupCheckResult = {
      versionCheck: true,
      environmentCheck: true,
      errors: [],
      warnings: []
    };

    // Perform environment check
    const envCheck = await this.performEnvironmentCheck();
    result.errors.push(...envCheck.errors);
    result.warnings.push(...envCheck.warnings);
    
    if (envCheck.errors.length > 0) {
      result.environmentCheck = false;
    }

    // Perform version check
    const versionCheck = await this.performVersionCheck();
    result.errors.push(...versionCheck.errors);
    
    if (versionCheck.errors.length > 0) {
      result.versionCheck = false;
    }

    // Update cache
    this.updateCache();

    // Display warnings if any
    if (result.warnings.length > 0) {
      console.log(chalk.yellow('\n📋 Startup-Hinweise:'));
      result.warnings.forEach(warning => {
        console.log(`   ${warning}`);
      });
    }

    // Display errors if any
    if (result.errors.length > 0) {
      console.log(chalk.red('\n❌ Startup-Probleme:'));
      result.errors.forEach(error => {
        console.log(`   ${error}`);
      });
    }

    return result;
  }

  /**
   * Silent startup check (no interactive prompts)
   */
  static async performSilentStartupCheck(): Promise<StartupCheckResult> {
    // Check if we should run the check based on cache
    if (!this.shouldRunCheck()) {
      return {
        versionCheck: true,
        environmentCheck: true,
        errors: [],
        warnings: []
      };
    }

    const result: StartupCheckResult = {
      versionCheck: true,
      environmentCheck: true,
      errors: [],
      warnings: []
    };

    // Perform environment check
    const envCheck = await this.performEnvironmentCheck();
    result.errors.push(...envCheck.errors);
    result.warnings.push(...envCheck.warnings);
    
    if (envCheck.errors.length > 0) {
      result.environmentCheck = false;
    }

    // Silent version check (no prompts)
    try {
      const versionInfo = await VersionManager.checkVersion();
      
      if (!versionInfo.isUpToDate) {
        result.warnings.push(`💡 Eine neue Version von WOARU (v${versionInfo.latest}) ist verfügbar. Führe 'woaru update' aus.`);
      }
    } catch (error) {
      result.errors.push(`Versions-Check fehlgeschlagen: ${error}`);
      result.versionCheck = false;
    }

    // Update cache
    this.updateCache();

    return result;
  }
}