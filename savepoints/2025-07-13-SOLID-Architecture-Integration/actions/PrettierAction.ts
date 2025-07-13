import { BaseAction } from './BaseAction';
import { SetupOptions, PackageJson } from '../types';
import * as path from 'path';

export class PrettierAction extends BaseAction {
  name = 'prettier';
  description = 'Install and configure Prettier for code formatting';

  async canExecute(projectPath: string): Promise<boolean> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = await this.readJsonFile<PackageJson>(packageJsonPath);

    if (!packageJson) return false;

    // Check if prettier is already installed
    const hasPrettier =
      packageJson.devDependencies?.prettier ||
      packageJson.dependencies?.prettier;
    return !hasPrettier;
  }

  async execute(projectPath: string, options: SetupOptions): Promise<boolean> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const prettierrcPath = path.join(projectPath, '.prettierrc');
      const prettierIgnorePath = path.join(projectPath, '.prettierignore');

      if (options.dryRun) {
        console.log('Would install prettier packages');
        console.log('Would create .prettierrc configuration');
        console.log('Would create .prettierignore file');
        return true;
      }

      // Create backups
      if (!options.skipBackup) {
        await this.createBackup(packageJsonPath);
      }

      // Detect if Tailwind is present
      const packageJson = await this.readJsonFile<PackageJson>(packageJsonPath);
      const hasTailwind =
        packageJson?.dependencies?.tailwindcss ||
        packageJson?.devDependencies?.tailwindcss;

      // Install prettier packages
      const packages = ['prettier'];
      if (hasTailwind) {
        packages.push('prettier-plugin-tailwindcss');
      }

      const installResult = await this.runCommand(
        'npm',
        ['install', '--save-dev', ...packages],
        projectPath
      );

      if (!installResult.success) {
        throw new Error(`Failed to install packages: ${installResult.output}`);
      }

      // Create .prettierrc configuration
      const prettierConfig = {
        semi: true,
        trailingComma: 'es5',
        singleQuote: true,
        printWidth: 80,
        tabWidth: 2,
        useTabs: false,
        ...(hasTailwind && { plugins: ['prettier-plugin-tailwindcss'] }),
      };

      await this.writeJsonFile(prettierrcPath, prettierConfig);

      // Create .prettierignore
      const prettierIgnoreContent = `# Dependencies
node_modules/

# Build outputs
dist/
build/
.next/

# Environment files
.env*

# Logs
*.log

# OS files
.DS_Store
Thumbs.db
`;

      const fs = await import('fs-extra');
      await fs.writeFile(prettierIgnorePath, prettierIgnoreContent);

      // Add scripts to package.json
      if (packageJson) {
        if (!packageJson.scripts) {
          packageJson.scripts = {};
        }
        packageJson.scripts['format'] = 'prettier --write .';
        packageJson.scripts['format:check'] = 'prettier --check .';

        await this.writeJsonFile(packageJsonPath, packageJson);
      }

      console.log('✅ Prettier installed and configured successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to setup Prettier:', error);
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

      // Remove created files
      const filesToRemove = ['.prettierrc', '.prettierignore'];
      for (const file of filesToRemove) {
        const filePath = path.join(projectPath, file);
        if (await fs.pathExists(filePath)) {
          await fs.remove(filePath);
        }
      }

      console.log('✅ Prettier setup rolled back successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to rollback Prettier setup:', error);
      return false;
    }
  }
}
