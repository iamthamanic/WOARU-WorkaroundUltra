import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { NotificationManager } from '../supervisor/NotificationManager';

const execAsync = promisify(exec);

export class QualityRunner {
  private notificationManager: NotificationManager;

  constructor(notificationManager: NotificationManager) {
    this.notificationManager = notificationManager;
  }

  async runChecksOnFileChange(filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    const relativePath = path.relative(process.cwd(), filePath);

    // TypeScript/JavaScript files
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      await this.runESLintCheck(relativePath);
    }
    
    // Python files
    if (ext === '.py') {
      await this.runRuffCheck(relativePath);
    }
    
    // Go files
    if (ext === '.go') {
      await this.runGoCheck(relativePath);
    }
    
    // Rust files
    if (ext === '.rs') {
      await this.runRustCheck(relativePath);
    }
    
    // C# files
    if (ext === '.cs') {
      await this.runCSharpCheck(relativePath);
    }
    
    // Java files
    if (ext === '.java') {
      await this.runJavaCheck(relativePath);
    }
    
    // PHP files
    if (ext === '.php') {
      await this.runPHPCheck(relativePath);
    }
    
    // Ruby files
    if (ext === '.rb') {
      await this.runRubyCheck(relativePath);
    }
  }

  private async runESLintCheck(filePath: string): Promise<void> {
    try {
      await execAsync(`npx eslint "${filePath}"`);
      this.notificationManager.showQualitySuccess(filePath, 'ESLint');
    } catch (error: any) {
      // ESLint failed - extract error output
      const output = error.stdout || error.stderr || error.message;
      this.notificationManager.showCriticalQualityError(
        filePath,
        'ESLint',
        output
      );
    }
  }

  private async runRuffCheck(filePath: string): Promise<void> {
    try {
      await execAsync(`ruff check --fix --show-source "${filePath}"`);
      this.notificationManager.showQualitySuccess(filePath, 'Ruff');
    } catch (error: any) {
      // Ruff failed - extract error output
      const output = error.stdout || error.stderr || error.message;
      this.notificationManager.showCriticalQualityError(
        filePath,
        'Ruff',
        output
      );
    }
  }

  private async runGoCheck(filePath: string): Promise<void> {
    try {
      // First run gofmt to check formatting
      const { stdout: gofmtOutput } = await execAsync(`gofmt -l "${filePath}"`);
      
      // If gofmt returns output, the file needs formatting
      if (gofmtOutput.trim()) {
        // Get the diff to show what needs to be changed
        const { stdout: diffOutput } = await execAsync(`gofmt -d "${filePath}"`);
        this.notificationManager.showCriticalQualityError(
          filePath,
          'gofmt',
          `File is not properly formatted. Run 'gofmt -w ${filePath}' to fix.\n\n${diffOutput}`
        );
        return;
      }
      
      // Also run go vet for additional checks
      await execAsync(`go vet "${filePath}"`);
      
      this.notificationManager.showQualitySuccess(filePath, 'Go (gofmt + go vet)');
    } catch (error: any) {
      // go vet failed - extract error output
      const output = error.stdout || error.stderr || error.message;
      this.notificationManager.showCriticalQualityError(
        filePath,
        'go vet',
        output
      );
    }
  }

  private async runRustCheck(filePath: string): Promise<void> {
    let hasErrors = false;
    let errorOutput = '';

    try {
      // First check formatting with rustfmt
      const { stdout: fmtOutput } = await execAsync(`rustfmt --check "${filePath}" 2>&1`);
      
      // rustfmt returns non-zero exit code if formatting is needed
      // We'll catch this in the error handler below
    } catch (fmtError: any) {
      if (fmtError.message.includes('Diff in')) {
        hasErrors = true;
        errorOutput += `Formatting issues found. Run 'rustfmt ${filePath}' to fix.\n\n`;
        errorOutput += fmtError.stdout || fmtError.stderr || fmtError.message;
      }
    }

    try {
      // Run clippy for linting
      await execAsync(`cargo clippy --manifest-path=$(dirname "${filePath}")/Cargo.toml -- -D warnings 2>&1`);
      
      if (!hasErrors) {
        this.notificationManager.showQualitySuccess(filePath, 'Rust (rustfmt + clippy)');
      }
    } catch (clippyError: any) {
      hasErrors = true;
      const clippyOutput = clippyError.stdout || clippyError.stderr || clippyError.message;
      
      // Add separator if we already have formatting errors
      if (errorOutput) {
        errorOutput += '\n\n--- Clippy Warnings ---\n\n';
      }
      errorOutput += clippyOutput;
    }

    if (hasErrors) {
      this.notificationManager.showCriticalQualityError(
        filePath,
        'Rust (rustfmt + clippy)',
        errorOutput
      );
    }
  }

  private async runCSharpCheck(filePath: string): Promise<void> {
    try {
      // Run dotnet format to check and fix formatting
      const { stdout } = await execAsync(`dotnet format --verify-no-changes --include "${filePath}" 2>&1`);
      
      // If no output and success, file is properly formatted
      this.notificationManager.showQualitySuccess(filePath, 'dotnet format');
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      
      // Check if it's a formatting issue
      if (output.includes('Formatted code file') || output.includes('needs formatting')) {
        this.notificationManager.showCriticalQualityError(
          filePath,
          'dotnet format',
          `File needs formatting. Run 'dotnet format --include ${filePath}' to fix.\n\n${output}`
        );
      } else {
        this.notificationManager.showCriticalQualityError(
          filePath,
          'dotnet format',
          output
        );
      }
    }
  }

  private async runJavaCheck(filePath: string): Promise<void> {
    try {
      // Try to use google-java-format for formatting check
      await execAsync(`java -jar google-java-format.jar --dry-run --set-exit-if-changed "${filePath}" 2>&1`);
      this.notificationManager.showQualitySuccess(filePath, 'Java Format');
    } catch (error: any) {
      // If google-java-format is not available, try checkstyle
      try {
        await execAsync(`checkstyle -c /google_checks.xml "${filePath}" 2>&1`);
        this.notificationManager.showQualitySuccess(filePath, 'Checkstyle');
      } catch (checkstyleError: any) {
        const output = checkstyleError.stdout || checkstyleError.stderr || error.message;
        this.notificationManager.showCriticalQualityError(
          filePath,
          'Java Quality',
          output
        );
      }
    }
  }

  private async runPHPCheck(filePath: string): Promise<void> {
    try {
      // Run PHP_CodeSniffer
      await execAsync(`phpcs --standard=PSR12 "${filePath}" 2>&1`);
      this.notificationManager.showQualitySuccess(filePath, 'PHP_CodeSniffer');
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      
      // PHPCS returns non-zero exit code when issues are found
      if (output.includes('FOUND') && output.includes('ERROR')) {
        this.notificationManager.showCriticalQualityError(
          filePath,
          'PHP_CodeSniffer',
          `${output}\n\nRun 'phpcbf --standard=PSR12 ${filePath}' to automatically fix some issues.`
        );
      } else {
        this.notificationManager.showCriticalQualityError(
          filePath,
          'PHP_CodeSniffer',
          output
        );
      }
    }
  }

  private async runRubyCheck(filePath: string): Promise<void> {
    try {
      // Run RuboCop with auto-correct in dry-run mode
      await execAsync(`rubocop --format simple "${filePath}" 2>&1`);
      this.notificationManager.showQualitySuccess(filePath, 'RuboCop');
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      
      // RuboCop returns non-zero exit when offenses are found
      if (output.includes('Offense')) {
        this.notificationManager.showCriticalQualityError(
          filePath,
          'RuboCop',
          `${output}\n\nRun 'rubocop -a ${filePath}' to auto-correct fixable offenses.`
        );
      } else {
        this.notificationManager.showCriticalQualityError(
          filePath,
          'RuboCop',
          output
        );
      }
    }
  }
}