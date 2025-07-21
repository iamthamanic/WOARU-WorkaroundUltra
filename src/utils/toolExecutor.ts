/**
 * Secure Tool Execution Manager
 * Provides safe interfaces for running development tools with proper argument handling
 */

import {
  safeExecAsync,
  sanitizeFilePath,
  validateCommand,
  ALLOWED_COMMANDS,
  ExecResult,
} from './secureExecution';

export interface ToolExecutionOptions {
  timeout?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export class ToolExecutor {
  /**
   * Run ESLint on a file
   */
  static async runESLint(
    filePath: string,
    options: ToolExecutionOptions = {}
  ): Promise<ExecResult> {
    const sanitizedPath = sanitizeFilePath(filePath);
    return safeExecAsync('eslint', [sanitizedPath], {
      timeout: 30000,
      ...options,
    });
  }

  /**
   * Run Prettier on a file
   */
  static async runPrettier(
    filePath: string,
    options: ToolExecutionOptions = {}
  ): Promise<ExecResult> {
    const sanitizedPath = sanitizeFilePath(filePath);
    return safeExecAsync('prettier', ['--check', sanitizedPath], {
      timeout: 15000,
      ...options,
    });
  }

  /**
   * Run Ruff (Python linter) on a file
   */
  static async runRuff(
    filePath: string,
    fix: boolean = false,
    options: ToolExecutionOptions = {}
  ): Promise<ExecResult> {
    const sanitizedPath = sanitizeFilePath(filePath);
    const args = ['check'];

    if (fix) {
      args.push('--fix');
    }

    args.push('--show-source', sanitizedPath);

    return safeExecAsync('ruff', args, {
      timeout: 30000,
      ...options,
    });
  }

  /**
   * Run Go fmt on a file
   */
  static async runGoFmt(
    filePath: string,
    options: ToolExecutionOptions = {}
  ): Promise<ExecResult> {
    const sanitizedPath = sanitizeFilePath(filePath);
    return safeExecAsync('gofmt', ['-l', sanitizedPath], {
      timeout: 15000,
      ...options,
    });
  }

  /**
   * Run Go vet on a file
   */
  static async runGoVet(
    filePath: string,
    options: ToolExecutionOptions = {}
  ): Promise<ExecResult> {
    const sanitizedPath = sanitizeFilePath(filePath);
    return safeExecAsync('go', ['vet', sanitizedPath], {
      timeout: 30000,
      ...options,
    });
  }

  /**
   * Run Rustfmt on a file
   */
  static async runRustFmt(
    filePath: string,
    options: ToolExecutionOptions = {}
  ): Promise<ExecResult> {
    const sanitizedPath = sanitizeFilePath(filePath);
    return safeExecAsync('rustfmt', ['--check', sanitizedPath], {
      timeout: 15000,
      ...options,
    });
  }

  /**
   * Run .NET format on a file
   */
  static async runDotNetFormat(
    filePath: string,
    options: ToolExecutionOptions = {}
  ): Promise<ExecResult> {
    const sanitizedPath = sanitizeFilePath(filePath);
    return safeExecAsync(
      'dotnet',
      ['format', '--verify-no-changes', sanitizedPath],
      {
        timeout: 30000,
        ...options,
      }
    );
  }

  /**
   * Run Java Checkstyle on a file
   */
  static async runCheckstyle(
    filePath: string,
    configPath: string = '/google_checks.xml',
    options: ToolExecutionOptions = {}
  ): Promise<ExecResult> {
    const sanitizedPath = sanitizeFilePath(filePath);
    return safeExecAsync('checkstyle', ['-c', configPath, sanitizedPath], {
      timeout: 30000,
      ...options,
    });
  }

  /**
   * Run PHP CodeSniffer on a file
   */
  static async runPhpCs(
    filePath: string,
    standard: string = 'PSR12',
    options: ToolExecutionOptions = {}
  ): Promise<ExecResult> {
    const sanitizedPath = sanitizeFilePath(filePath);
    return safeExecAsync('phpcs', [`--standard=${standard}`, sanitizedPath], {
      timeout: 30000,
      ...options,
    });
  }

  /**
   * Run RuboCop on a file
   */
  static async runRuboCop(
    filePath: string,
    format: string = 'simple',
    options: ToolExecutionOptions = {}
  ): Promise<ExecResult> {
    const sanitizedPath = sanitizeFilePath(filePath);
    return safeExecAsync('rubocop', [`--format`, format, sanitizedPath], {
      timeout: 30000,
      ...options,
    });
  }

  /**
   * Run TypeScript compiler check
   */
  static async runTsc(options: ToolExecutionOptions = {}): Promise<ExecResult> {
    return safeExecAsync('tsc', ['--noEmit'], {
      timeout: 60000,
      ...options,
    });
  }

  /**
   * Run Python Black formatter
   */
  static async runBlack(
    filePath: string,
    check: boolean = true,
    options: ToolExecutionOptions = {}
  ): Promise<ExecResult> {
    const sanitizedPath = sanitizeFilePath(filePath);
    const args = check ? ['--check', sanitizedPath] : [sanitizedPath];

    return safeExecAsync('black', args, {
      timeout: 30000,
      ...options,
    });
  }

  /**
   * Run MyPy type checker
   */
  static async runMyPy(
    filePath: string,
    options: ToolExecutionOptions = {}
  ): Promise<ExecResult> {
    const sanitizedPath = sanitizeFilePath(filePath);
    return safeExecAsync('mypy', [sanitizedPath], {
      timeout: 45000,
      ...options,
    });
  }

  /**
   * Generic tool runner with validation
   */
  static async runTool(
    command: string,
    args: string[],
    options: ToolExecutionOptions = {}
  ): Promise<ExecResult> {
    if (!validateCommand(command, [...ALLOWED_COMMANDS])) {
      throw new Error(`Command '${command}' is not allowed`);
    }

    // Sanitize any file paths in arguments
    const sanitizedArgs = args.map(arg => {
      // Check if argument looks like a file path
      if (arg.includes('/') || arg.includes('\\') || arg.includes('.')) {
        try {
          return sanitizeFilePath(arg);
        } catch {
          // If sanitization fails, return the original arg (might not be a path)
          return arg;
        }
      }
      return arg;
    });

    return safeExecAsync(command, sanitizedArgs, {
      timeout: 30000,
      ...options,
    });
  }
}
