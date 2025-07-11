import { BaseAction } from './BaseAction';
import { SetupOptions, PackageJson } from '../types';
import * as path from 'path';

export class EslintAction extends BaseAction {
  name = 'eslint';
  description = 'Install and configure ESLint for code linting';

  async canExecute(projectPath: string): Promise<boolean> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = await this.readJsonFile<PackageJson>(packageJsonPath);

    if (!packageJson) return false;

    // Check if eslint is already installed
    const hasEslint =
      packageJson.devDependencies?.eslint || packageJson.dependencies?.eslint;
    return !hasEslint;
  }

  async execute(projectPath: string, options: SetupOptions): Promise<boolean> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const eslintrcPath = path.join(projectPath, '.eslintrc.json');

      if (options.dryRun) {
        console.log('Would install ESLint packages');
        console.log('Would create .eslintrc.json configuration');
        return true;
      }

      // Create backups
      if (!options.skipBackup) {
        await this.createBackup(packageJsonPath);
        await this.createBackup(eslintrcPath);
      }

      // Detect project characteristics
      const packageJson = await this.readJsonFile<PackageJson>(packageJsonPath);
      const hasNext =
        packageJson?.dependencies?.next || packageJson?.devDependencies?.next;
      const hasReact =
        packageJson?.dependencies?.react || packageJson?.devDependencies?.react;
      const hasTypeScript = await this.fileExists(
        path.join(projectPath, 'tsconfig.json')
      );

      // Determine packages to install
      const packages = ['eslint'];

      if (hasNext) {
        packages.push('eslint-config-next');
      } else if (hasReact) {
        packages.push(
          '@eslint/js',
          'eslint-plugin-react',
          'eslint-plugin-react-hooks'
        );
      }

      if (hasTypeScript) {
        packages.push(
          '@typescript-eslint/eslint-plugin',
          '@typescript-eslint/parser'
        );
      }

      // Install packages
      const installResult = await this.runCommand(
        'npm',
        ['install', '--save-dev', ...packages],
        projectPath
      );

      if (!installResult.success) {
        throw new Error(`Failed to install packages: ${installResult.output}`);
      }

      // Create ESLint configuration
      const eslintConfig: Record<string, any> = {
        env: {
          browser: true,
          es2021: true,
          node: true,
        },
        extends: [] as string[],
      };

      if (hasNext) {
        (eslintConfig.extends as string[]).push('next/core-web-vitals');
      } else {
        (eslintConfig.extends as string[]).push('eslint:recommended');

        if (hasReact) {
          (eslintConfig.extends as string[]).push(
            'plugin:react/recommended',
            'plugin:react-hooks/recommended'
          );
          eslintConfig.plugins = ['react', 'react-hooks'];
          eslintConfig.settings = {
            react: {
              version: 'detect',
            },
          };
        }
      }

      if (hasTypeScript) {
        (eslintConfig.extends as string[]).push('@typescript-eslint/recommended');
        eslintConfig.parser = '@typescript-eslint/parser';
        eslintConfig.plugins = [
          ...((eslintConfig.plugins as string[]) || []),
          '@typescript-eslint',
        ];
        eslintConfig.parserOptions = {
          ecmaVersion: 'latest',
          sourceType: 'module',
          ...(hasReact && { ecmaFeatures: { jsx: true } }),
        };
      }

      eslintConfig.rules = {
        'no-unused-vars': 'warn',
        'no-console': 'warn',
        ...(hasReact && { 'react/react-in-jsx-scope': 'off' }),
      };

      await this.writeJsonFile(eslintrcPath, eslintConfig);

      // Add scripts to package.json
      if (packageJson) {
        if (!packageJson.scripts) {
          packageJson.scripts = {};
        }
        packageJson.scripts['lint'] = 'eslint . --ext .js,.jsx,.ts,.tsx';
        packageJson.scripts['lint:fix'] =
          'eslint . --ext .js,.jsx,.ts,.tsx --fix';

        await this.writeJsonFile(packageJsonPath, packageJson);
      }

      console.log('✅ ESLint installed and configured successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to setup ESLint:', error);
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
      const filesToRemove = ['.eslintrc.json'];
      for (const file of filesToRemove) {
        const filePath = path.join(projectPath, file);
        if (await fs.pathExists(filePath)) {
          await fs.remove(filePath);
        }
      }

      console.log('✅ ESLint setup rolled back successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to rollback ESLint setup:', error);
      return false;
    }
  }
}
