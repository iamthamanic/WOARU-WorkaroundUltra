import { BaseAction } from './BaseAction';
import { SetupOptions } from '../types';
import * as path from 'path';

export class HuskyAction extends BaseAction {
  name = 'husky';
  description = 'Install and configure Husky with lint-staged for Git hooks';

  async canExecute(projectPath: string): Promise<boolean> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = await this.readJsonFile(packageJsonPath);

    if (!packageJson) return false;

    // Check if husky is already installed
    const hasHusky =
      packageJson.devDependencies?.husky || packageJson.dependencies?.husky;
    return !hasHusky;
  }

  async execute(projectPath: string, options: SetupOptions): Promise<boolean> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const huskyDir = path.join(projectPath, '.husky');

      if (options.dryRun) {
        console.log('Would install husky and lint-staged packages');
        console.log('Would create .husky directory and pre-commit hook');
        console.log('Would configure lint-staged in package.json');
        return true;
      }

      // Create backups
      if (!options.skipBackup) {
        await this.createBackup(packageJsonPath);
      }

      // Install packages
      const packages = ['husky', 'lint-staged'];
      const installResult = await this.runCommand(
        'npm',
        ['install', '--save-dev', ...packages],
        projectPath
      );

      if (!installResult.success) {
        throw new Error(`Failed to install packages: ${installResult.output}`);
      }

      // Initialize husky
      const huskyInitResult = await this.runCommand(
        'npx',
        ['husky', 'init'],
        projectPath
      );
      if (!huskyInitResult.success) {
        throw new Error(
          `Failed to initialize husky: ${huskyInitResult.output}`
        );
      }

      // Read package.json to detect available scripts
      const packageJson = await this.readJsonFile(packageJsonPath);
      const hasLint = packageJson.scripts?.lint;
      const hasFormat = packageJson.scripts?.format;
      const hasTypeCheck =
        packageJson.scripts?.['type-check'] || packageJson.scripts?.tsc;

      // Create pre-commit hook
      const preCommitPath = path.join(huskyDir, 'pre-commit');
      const preCommitContent =
        '#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\nnpx lint-staged\n';

      const fs = await import('fs-extra');
      await fs.writeFile(preCommitPath, preCommitContent);
      await this.runCommand('chmod', ['+x', preCommitPath], projectPath);

      // Configure lint-staged
      const lintStagedConfig: any = {};

      // Configure for TypeScript/JavaScript files
      const jsPattern = '*.{js,jsx,ts,tsx}';
      const commands: string[] = [];

      if (hasLint) {
        commands.push('eslint --fix');
      }
      if (hasFormat) {
        commands.push('prettier --write');
      }

      if (commands.length > 0) {
        lintStagedConfig[jsPattern] = commands;
      }

      // Add type-checking if available
      if (hasTypeCheck) {
        lintStagedConfig['*.{ts,tsx}'] = [
          ...(lintStagedConfig['*.{ts,tsx}'] || commands),
          () => 'tsc --noEmit',
        ];
      }

      // Configure for other file types
      if (hasFormat) {
        lintStagedConfig['*.{json,md,yml,yaml}'] = ['prettier --write'];
      }

      // Add lint-staged configuration to package.json
      packageJson['lint-staged'] = lintStagedConfig;

      // Add prepare script for husky
      packageJson.scripts = packageJson.scripts || {};
      packageJson.scripts.prepare = 'husky';

      await this.writeJsonFile(packageJsonPath, packageJson);

      console.log(
        '✅ Husky and lint-staged installed and configured successfully'
      );
      return true;
    } catch (error) {
      console.error('❌ Failed to setup Husky:', error);
      return false;
    }
  }

  async rollback(projectPath: string): Promise<boolean> {
    try {
      const fs = await import('fs-extra');
      const glob = await import('glob');

      // Find backup files
      const backupFiles = await glob.glob(
        path.join(projectPath, '*.wau-backup-*')
      );

      for (const backupFile of backupFiles) {
        const originalFile = backupFile.replace(/\.wau-backup-\d+$/, '');
        await fs.move(backupFile, originalFile, { overwrite: true });
      }

      // Remove .husky directory
      const huskyDir = path.join(projectPath, '.husky');
      if (await fs.pathExists(huskyDir)) {
        await fs.remove(huskyDir);
      }

      console.log('✅ Husky setup rolled back successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to rollback Husky setup:', error);
      return false;
    }
  }
}
