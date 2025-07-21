/**
 * Secure Command Execution Utilities
 * Prevents Command Injection by using proper argument handling
 */

import { spawn } from 'child_process';
import * as path from 'path';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Sanitizes and validates a file path to prevent path traversal attacks
 */
export function sanitizeFilePath(filePath: string): string {
  const normalized = path.normalize(filePath);

  // Check for directory traversal attempts
  if (normalized.includes('..')) {
    throw new Error('Invalid file path: Directory traversal detected');
  }

  // Ensure the path is absolute for consistency
  return path.resolve(normalized);
}

/**
 * Safely executes a command with arguments using spawn instead of shell execution
 * This prevents command injection by treating arguments as separate parameters
 */
export async function safeExecAsync(
  command: string,
  args: string[] = [],
  options: {
    cwd?: string;
    timeout?: number;
    env?: NodeJS.ProcessEnv;
  } = {}
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const { timeout = 30000, ...spawnOptions } = options;

    const child = spawn(command, args, {
      ...spawnOptions,
      shell: false, // CRITICAL: Never use shell to prevent injection
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timeoutId: NodeJS.Timeout | null = null;

    if (child.stdout) {
      child.stdout.on('data', data => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', data => {
        stderr += data.toString();
      });
    }

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timeout after ${timeout}ms`));
      }, timeout);
    }

    child.on('close', code => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? -1,
      });
    });

    child.on('error', error => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reject(error);
    });
  });
}

/**
 * Validates that a command is in an allowed list (whitelist approach)
 */
export function validateCommand(
  command: string,
  allowedCommands: readonly string[]
): boolean {
  const baseCommand = path.basename(command);
  return allowedCommands.includes(baseCommand);
}

/**
 * Escape special characters for shell commands (only when shell is absolutely necessary)
 * NOTE: Prefer safeExecAsync over shell execution
 */
export function escapeShellArg(arg: string): string {
  return `"${arg.replace(/"/g, '\\"')}"`;
}

/**
 * Common allowed commands for WOARU tools
 */
export const ALLOWED_COMMANDS = [
  'eslint',
  'prettier',
  'tsc',
  'npm',
  'yarn',
  'pnpm',
  'python',
  'python3',
  'pip',
  'pip3',
  'black',
  'ruff',
  'mypy',
  'pytest',
  'go',
  'golint',
  'gofmt',
  'dotnet',
  'mvn',
  'gradle',
  'rustc',
  'cargo',
  'clippy',
  'snyk',
  'trivy',
  'gitleaks',
  'semgrep',
  'bandit',
  'safety',
] as const;

export type AllowedCommand = (typeof ALLOWED_COMMANDS)[number];
