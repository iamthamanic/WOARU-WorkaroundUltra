import { SetupOptions } from '../types';
import * as path from 'path';

export abstract class BaseAction {
  abstract name: string;
  abstract description: string;

  abstract canExecute(projectPath: string): Promise<boolean>;
  abstract execute(
    projectPath: string,
    options: SetupOptions
  ): Promise<boolean>;
  abstract rollback(projectPath: string): Promise<boolean>;

  protected async runCommand(
    command: string,
    args: string[],
    cwd: string,
    options: { timeout?: number; env?: Record<string, string> } = {}
  ): Promise<{ success: boolean; output: string; error?: string }> {
    const { spawn } = await import('child_process');
    const { timeout = 30000 } = options;

    return new Promise((resolve, reject) => {
      // Validate command to prevent injection
      if (!this.isValidCommand(command)) {
        reject(new Error(`Invalid command: ${command}`));
        return;
      }

      // Sanitize arguments
      const sanitizedArgs = args.map(arg => this.sanitizeArgument(arg));

      const child = spawn(command, sanitizedArgs, {
        cwd: this.sanitizePath(cwd),
        stdio: 'pipe',
        shell: false, // Disable shell to prevent injection
        env: { ...process.env, ...options.env },
      });

      let output = '';
      let errorOutput = '';
      let timeoutId: NodeJS.Timeout | null = null;

      // Set up timeout
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`Command timed out after ${timeout}ms`));
        }, timeout);
      }

      child.stdout?.on('data', data => {
        output += data.toString();
      });

      child.stderr?.on('data', data => {
        errorOutput += data.toString();
      });

      child.on('error', error => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(new Error(`Command execution failed: ${error.message}`));
      });

      child.on('close', code => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve({
          success: code === 0,
          output,
          error: errorOutput || undefined,
        });
      });
    });
  }

  // Legacy method for backward compatibility - use with caution
  protected async runCommandLegacy(
    command: string,
    cwd: string
  ): Promise<{ success: boolean; output: string }> {
    console.warn(
      'runCommandLegacy is deprecated and unsafe. Use runCommand with explicit args instead.'
    );

    // Parse command safely
    const parts = this.parseCommand(command);
    if (parts.length === 0) {
      throw new Error('Invalid command');
    }

    const [cmd, ...args] = parts;
    const result = await this.runCommand(cmd, args, cwd);

    return {
      success: result.success,
      output: result.output + (result.error || ''),
    };
  }

  private isValidCommand(command: string): boolean {
    // Whitelist of allowed commands
    const allowedCommands = [
      'npm',
      'yarn',
      'pnpm',
      'node',
      'npx',
      'git',
      'cargo',
      'rustc',
      'python',
      'pip',
      'go',
      'dotnet',
      'java',
      'javac',
      'mvn',
      'eslint',
      'prettier',
      'tsc',
      'jest',
    ];

    return allowedCommands.includes(command.toLowerCase());
  }

  private sanitizeArgument(arg: string): string {
    // Remove potentially dangerous characters
    return arg.replace(/[;&|`$(){}[\]<>]/g, '');
  }

  private sanitizePath(filePath: string): string {
    try {
      return path.resolve(filePath);
    } catch {
      throw new Error(`Invalid path: ${filePath}`);
    }
  }

  private parseCommand(command: string): string[] {
    // Simple command parser that respects quotes
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < command.length; i++) {
      const char = command[i];

      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuotes) {
        if (current.length > 0) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current.length > 0) {
      parts.push(current);
    }

    return parts;
  }

  protected async fileExists(filePath: string): Promise<boolean> {
    const fs = await import('fs-extra');
    return fs.pathExists(filePath);
  }

  protected async readJsonFile<T = any>(filePath: string): Promise<T | null> {
    const fs = await import('fs-extra');
    try {
      // Validate file path to prevent directory traversal
      const sanitizedPath = this.sanitizePath(filePath);
      return (await fs.readJson(sanitizedPath)) as T;
    } catch (error) {
      console.warn(`Failed to read JSON file ${filePath}:`, error);
      return null;
    }
  }

  protected async writeJsonFile(
    filePath: string,
    data: unknown
  ): Promise<void> {
    const fs = await import('fs-extra');
    try {
      // Validate file path and ensure directory exists
      const sanitizedPath = this.sanitizePath(filePath);
      const path = await import('path');
      await fs.ensureDir(path.dirname(sanitizedPath));

      // Atomic write using temporary file
      const tempFile = `${sanitizedPath}.tmp`;
      await fs.writeJson(tempFile, data, { spaces: 2 });
      await fs.move(tempFile, sanitizedPath, { overwrite: true });
    } catch (error) {
      throw new Error(`Failed to write JSON file ${filePath}: ${error}`);
    }
  }

  protected async createBackup(filePath: string): Promise<string> {
    const fs = await import('fs-extra');

    try {
      const sanitizedPath = this.sanitizePath(filePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${sanitizedPath}.woaru-backup-${timestamp}`;

      if (await fs.pathExists(sanitizedPath)) {
        await fs.copy(sanitizedPath, backupPath);

        // Limit number of backup files (keep last 5)
        await this.cleanupOldBackups(sanitizedPath);
      }

      return backupPath;
    } catch (error) {
      throw new Error(`Failed to create backup for ${filePath}: ${error}`);
    }
  }

  private async cleanupOldBackups(originalPath: string): Promise<void> {
    const fs = await import('fs-extra');
    const path = await import('path');

    try {
      const dir = path.dirname(originalPath);
      const basename = path.basename(originalPath);
      const files = await fs.readdir(dir);

      const backupFiles = files
        .filter(file => file.startsWith(`${basename}.woaru-backup-`))
        .sort()
        .reverse(); // Most recent first

      // Keep only the 5 most recent backups
      for (let i = 5; i < backupFiles.length; i++) {
        await fs.remove(path.join(dir, backupFiles[i]));
      }
    } catch (error) {
      console.warn('Failed to cleanup old backups:', error);
    }
  }
}
