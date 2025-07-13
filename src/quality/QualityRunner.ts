import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs-extra';
import { NotificationManager } from '../supervisor/NotificationManager';
import {
  ToolsDatabaseManager,
  CoreTool,
  ExperimentalTool,
} from '../database/ToolsDatabaseManager';
import { EslintPlugin } from '../plugins/EslintPlugin';
import {
  SecurityFinding,
  SecurityScanResult,
  GitleaksResult,
  SecurityCheckOptions,
} from '../types/security';
import { SOLIDChecker } from '../solid/SOLIDChecker';
import { SOLIDCheckResult, SOLIDViolation } from '../solid/types/solid-types';

const execAsync = promisify(exec);

export interface QualityCheckResult {
  filePath: string;
  tool: string;
  severity: 'error' | 'warning' | 'info';
  issues: string[];
  raw_output?: string; // Store full tool output for detailed analysis
  fixes?: string[]; // Suggested fixes for the issues
  explanation?: string; // Human-readable explanation of the problems
  solidResult?: SOLIDCheckResult; // SOLID analysis results
}

export interface SnykVulnerability {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  packageName: string;
  version: string;
  from: string[];
  upgradePath?: string[];
  isUpgradable: boolean;
  isPatchable: boolean;
  description?: string;
  fixedIn?: string[];
  exploit?: string;
  CVSSv3?: string;
  semver?: {
    vulnerable: string[];
  };
}

export interface SnykCodeIssue {
  filePath: string;
  line: number;
  column: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  ruleId: string;
  categories: string[];
}

export interface SnykResult {
  type: 'dependencies' | 'code';
  vulnerabilities?: SnykVulnerability[];
  codeIssues?: SnykCodeIssue[];
  summary?: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  error?: string;
}

export class QualityRunner {
  private notificationManager: NotificationManager;
  private databaseManager: ToolsDatabaseManager;
  private corePlugins: Map<string, any>;
  private solidChecker: SOLIDChecker;

  constructor(notificationManager: NotificationManager) {
    this.notificationManager = notificationManager;
    this.databaseManager = new ToolsDatabaseManager();
    this.corePlugins = new Map();
    this.solidChecker = new SOLIDChecker();

    // Initialize core plugins
    this.initializeCorePlugins();
  }

  /**
   * Initialize secure core plugins
   */
  private initializeCorePlugins(): void {
    // Only add verified, secure core plugins
    this.corePlugins.set('EslintPlugin', new EslintPlugin());
    // More core plugins would be added here as they're implemented
  }

  /**
   * HYBRID ARCHITECTURE: Run quality checks using both core plugins and experimental tools
   */
  async runChecksOnFileChange(filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    const relativePath = path.relative(process.cwd(), filePath);

    try {
      // Phase 1: Try core plugins first (secure, established tools)
      const coreHandled = await this.runCorePluginCheck(relativePath, ext);

      if (coreHandled) {
        return; // Core plugin handled the file successfully
      }

      // Phase 2: Try experimental tools (dynamic command templates)
      const experimentalHandled = await this.runExperimentalToolCheck(
        relativePath,
        ext
      );

      if (experimentalHandled) {
        return; // Experimental tool handled the file successfully
      }

      // Phase 3: Fallback to legacy hardcoded checks
      await this.runLegacyChecks(relativePath, ext);
    } catch (error) {
      console.warn(`Quality check failed for ${relativePath}:`, error);
    }
  }

  /**
   * Phase 1: Run checks using secure core plugins
   */
  private async runCorePluginCheck(
    filePath: string,
    fileExtension: string
  ): Promise<boolean> {
    try {
      // Get core tools that support this file extension
      const coreTools =
        await this.databaseManager.getCoreToolsForFileExtension(fileExtension);

      for (const coreTool of coreTools) {
        const plugin = this.corePlugins.get(coreTool.plugin_class);

        if (plugin && (await plugin.canHandleFile(filePath))) {
          console.log(
            `🔧 Running core plugin: ${coreTool.name} on ${filePath}`
          );

          const result = await plugin.runLinter(filePath, { fix: false });

          if (result.hasErrors) {
            this.notificationManager.showCriticalQualityError(
              filePath,
              coreTool.name,
              result.output
            );
          } else if (result.hasWarnings) {
            console.log(`⚠️ ${coreTool.name} warnings in ${filePath}`);
          } else {
            this.notificationManager.showQualitySuccess(
              filePath,
              coreTool.name
            );
          }

          return true; // Successfully handled by core plugin
        }
      }

      return false; // No core plugin could handle this file
    } catch (error) {
      console.warn('Core plugin check failed:', error);
      return false;
    }
  }

  /**
   * Phase 2: Run checks using experimental tools (dynamic command templates)
   */
  private async runExperimentalToolCheck(
    filePath: string,
    fileExtension: string
  ): Promise<boolean> {
    try {
      // Get experimental tools that support this file extension
      const experimentalTools =
        await this.databaseManager.getExperimentalToolsForFileExtension(
          fileExtension
        );

      for (const experimentalTool of experimentalTools) {
        if (await this.canRunExperimentalTool(experimentalTool)) {
          console.log(
            `🧪 Running experimental tool: ${experimentalTool.name} on ${filePath}`
          );

          const result = await this.executeExperimentalTool(
            experimentalTool,
            filePath
          );

          if (result.success) {
            if (result.output.includes('error')) {
              this.notificationManager.showCriticalQualityError(
                filePath,
                experimentalTool.name,
                result.output
              );
            } else {
              this.notificationManager.showQualitySuccess(
                filePath,
                experimentalTool.name
              );
            }
            return true; // Successfully handled by experimental tool
          }
        }
      }

      return false; // No experimental tool could handle this file
    } catch (error) {
      console.warn('Experimental tool check failed:', error);
      return false;
    }
  }

  /**
   * Phase 3: Fallback to legacy hardcoded checks
   */
  private async runLegacyChecks(
    filePath: string,
    fileExtension: string
  ): Promise<void> {
    // Keep existing legacy logic for backward compatibility
    console.log(`📦 Running legacy check for ${filePath}`);

    // TypeScript/JavaScript files
    if (['.ts', '.tsx', '.js', '.jsx'].includes(fileExtension)) {
      await this.runESLintCheck(filePath);
    }

    // Python files
    if (fileExtension === '.py') {
      await this.runRuffCheck(filePath);
    }

    // Go files
    if (fileExtension === '.go') {
      await this.runGoCheck(filePath);
    }

    // Rust files
    if (fileExtension === '.rs') {
      await this.runRustCheck(filePath);
    }

    // C# files
    if (fileExtension === '.cs') {
      await this.runCSharpCheck(filePath);
    }

    // Java files
    if (fileExtension === '.java') {
      await this.runJavaCheck(filePath);
    }

    // PHP files
    if (fileExtension === '.php') {
      await this.runPHPCheck(filePath);
    }

    // Ruby files
    if (fileExtension === '.rb') {
      await this.runRubyCheck(filePath);
    }
  }

  // ========== EXPERIMENTAL TOOL EXECUTION ==========

  /**
   * Check if an experimental tool can be run (is installed)
   */
  private async canRunExperimentalTool(
    tool: ExperimentalTool
  ): Promise<boolean> {
    try {
      // Check if the tool is installed by trying to run it with --version
      const { stdout } = await execAsync(
        `${tool.commandTemplate.split(' ')[0]} --version`
      );
      return stdout.length > 0;
    } catch {
      return false; // Tool not installed or not in PATH
    }
  }

  /**
   * Execute an experimental tool using its command template
   */
  private async executeExperimentalTool(
    tool: ExperimentalTool,
    filePath: string
  ): Promise<{ success: boolean; output: string }> {
    try {
      // Replace {filePath} in command template
      const command = tool.commandTemplate.replace('{filePath}', filePath);

      // Security: Validate command before execution
      if (!this.isValidExperimentalCommand(command, filePath)) {
        throw new Error(`Invalid experimental command: ${command}`);
      }

      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000, // 30 second timeout
        cwd: path.dirname(filePath),
      });

      return {
        success: true,
        output: stdout + stderr,
      };
    } catch (error) {
      return {
        success: false,
        output: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate experimental command for security
   */
  private isValidExperimentalCommand(
    command: string,
    filePath: string
  ): boolean {
    // Security checks for experimental commands

    // Must contain the file path
    if (!command.includes(filePath)) {
      return false;
    }

    // No dangerous shell operators
    const dangerousPatterns = [
      '&&',
      '||',
      ';',
      '|',
      '>',
      '<',
      '`',
      '$',
      '(',
      ')',
    ];
    for (const pattern of dangerousPatterns) {
      if (
        command.includes(pattern) &&
        !command.includes(`'${pattern}'`) &&
        !command.includes(`"${pattern}"`)
      ) {
        return false;
      }
    }

    // Command must start with allowed prefixes
    const allowedPrefixes = ['npx', 'node', 'deno', 'bun'];
    const firstWord = command.split(' ')[0];

    return allowedPrefixes.some(prefix => firstWord.startsWith(prefix));
  }

  // New method for running checks on multiple files (for review command)
  async runChecksOnFileList(
    filePaths: string[]
  ): Promise<QualityCheckResult[]> {
    const results: QualityCheckResult[] = [];

    for (const filePath of filePaths) {
      const ext = path.extname(filePath).toLowerCase();
      const relativePath = path.relative(process.cwd(), filePath);

      try {
        // TypeScript/JavaScript files
        if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
          const eslintResult = await this.runESLintCheckForReview(relativePath);
          if (eslintResult) {
            // Add SOLID analysis to ESLint results
            const language = ext.startsWith('.ts')
              ? 'typescript'
              : 'javascript';
            const solidResult = await this.runSOLIDCheckForReview(
              filePath,
              language
            );
            eslintResult.solidResult = solidResult;
            results.push(eslintResult);
          }
        }

        // Python files
        if (ext === '.py') {
          const result = await this.runRuffCheckForReview(relativePath);
          if (result) results.push(result);
        }

        // Go files
        if (ext === '.go') {
          const result = await this.runGoCheckForReview(relativePath);
          if (result) results.push(result);
        }

        // Rust files
        if (ext === '.rs') {
          const result = await this.runRustCheckForReview(relativePath);
          if (result) results.push(result);
        }

        // C# files
        if (ext === '.cs') {
          const result = await this.runCSharpCheckForReview(relativePath);
          if (result) results.push(result);
        }

        // Java files
        if (ext === '.java') {
          const result = await this.runJavaCheckForReview(relativePath);
          if (result) results.push(result);
        }

        // PHP files
        if (ext === '.php') {
          const result = await this.runPHPCheckForReview(relativePath);
          if (result) results.push(result);
        }

        // Ruby files
        if (ext === '.rb') {
          const result = await this.runRubyCheckForReview(relativePath);
          if (result) results.push(result);
        }
      } catch (error) {
        results.push({
          filePath: relativePath,
          tool: 'Unknown',
          severity: 'error',
          issues: [`Failed to check file: ${error}`],
        });
      }
    }

    return results;
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
        const { stdout: diffOutput } = await execAsync(
          `gofmt -d "${filePath}"`
        );
        this.notificationManager.showCriticalQualityError(
          filePath,
          'gofmt',
          `File is not properly formatted. Run 'gofmt -w ${filePath}' to fix.\n\n${diffOutput}`
        );
        return;
      }

      // Also run go vet for additional checks
      await execAsync(`go vet "${filePath}"`);

      this.notificationManager.showQualitySuccess(
        filePath,
        'Go (gofmt + go vet)'
      );
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
      const { stdout: fmtOutput } = await execAsync(
        `rustfmt --check "${filePath}" 2>&1`
      );

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
      await execAsync(
        `cargo clippy --manifest-path=$(dirname "${filePath}")/Cargo.toml -- -D warnings 2>&1`
      );

      if (!hasErrors) {
        this.notificationManager.showQualitySuccess(
          filePath,
          'Rust (rustfmt + clippy)'
        );
      }
    } catch (clippyError: any) {
      hasErrors = true;
      const clippyOutput =
        clippyError.stdout || clippyError.stderr || clippyError.message;

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
      const { stdout } = await execAsync(
        `dotnet format --verify-no-changes --include "${filePath}" 2>&1`
      );

      // If no output and success, file is properly formatted
      this.notificationManager.showQualitySuccess(filePath, 'dotnet format');
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;

      // Check if it's a formatting issue
      if (
        output.includes('Formatted code file') ||
        output.includes('needs formatting')
      ) {
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
      await execAsync(
        `java -jar google-java-format.jar --dry-run --set-exit-if-changed "${filePath}" 2>&1`
      );
      this.notificationManager.showQualitySuccess(filePath, 'Java Format');
    } catch (error: any) {
      // If google-java-format is not available, try checkstyle
      try {
        await execAsync(`checkstyle -c /google_checks.xml "${filePath}" 2>&1`);
        this.notificationManager.showQualitySuccess(filePath, 'Checkstyle');
      } catch (checkstyleError: any) {
        const output =
          checkstyleError.stdout || checkstyleError.stderr || error.message;
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

  // Review-specific methods that return results instead of showing notifications
  private async runESLintCheckForReview(
    filePath: string
  ): Promise<QualityCheckResult | null> {
    try {
      // Run ESLint with detailed formatter
      await execAsync(`npx eslint --format stylish "${filePath}"`);
      return null; // No issues found
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      const issues = this.parseESLintOutput(output);

      // Determine severity based on output
      const hasErrors = output.includes('error');
      const severity = hasErrors ? 'error' : 'warning';

      return {
        filePath,
        tool: 'ESLint',
        severity,
        issues,
        raw_output: output,
        explanation: this.generateESLintExplanation(issues),
        fixes: this.generateESLintFixes(issues),
      };
    }
  }

  private async runRuffCheckForReview(
    filePath: string
  ): Promise<QualityCheckResult | null> {
    try {
      await execAsync(`ruff check "${filePath}"`);
      return null; // No issues found
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      const issues = this.parseRuffOutput(output);
      return {
        filePath,
        tool: 'Ruff',
        severity: 'error',
        issues,
      };
    }
  }

  private async runGoCheckForReview(
    filePath: string
  ): Promise<QualityCheckResult | null> {
    const issues: string[] = [];

    try {
      // Check formatting
      const { stdout: fmtOutput } = await execAsync(`gofmt -l "${filePath}"`);
      if (fmtOutput.trim()) {
        // Get diff to show what needs to change
        const { stdout: diffOutput } = await execAsync(
          `gofmt -d "${filePath}"`
        );
        issues.push(`Formatting needed - Run 'gofmt -w ${filePath}'`);
        issues.push('Formatting differences:');
        diffOutput
          .split('\n')
          .slice(0, 10)
          .forEach(line => {
            if (line.startsWith('+') || line.startsWith('-')) {
              issues.push(`  ${line}`);
            }
          });
      }
    } catch (error: any) {
      issues.push(`gofmt error: ${error.message}`);
    }

    try {
      // Run go vet
      await execAsync(`go vet "${filePath}"`);
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      issues.push(`go vet: ${output.trim()}`);
    }

    return issues.length > 0
      ? {
          filePath,
          tool: 'Go (gofmt + go vet)',
          severity: 'error',
          issues,
        }
      : null;
  }

  private async runRustCheckForReview(
    filePath: string
  ): Promise<QualityCheckResult | null> {
    try {
      await execAsync(`rustfmt --check "${filePath}"`);
      await execAsync(
        `cargo clippy --manifest-path "${path.dirname(filePath)}/Cargo.toml" -- -D warnings`
      );
      return null; // No issues found
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      return {
        filePath,
        tool: 'Rust (rustfmt + clippy)',
        severity: 'error',
        issues: [output.trim()],
      };
    }
  }

  private async runCSharpCheckForReview(
    filePath: string
  ): Promise<QualityCheckResult | null> {
    try {
      await execAsync(`dotnet format --verify-no-changes "${filePath}"`);
      return null; // No issues found
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      return {
        filePath,
        tool: 'C# (dotnet format)',
        severity: 'error',
        issues: [output.trim()],
      };
    }
  }

  private async runJavaCheckForReview(
    filePath: string
  ): Promise<QualityCheckResult | null> {
    try {
      await execAsync(`checkstyle -c /google_checks.xml "${filePath}"`);
      return null; // No issues found
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      return {
        filePath,
        tool: 'Java (Checkstyle)',
        severity: 'error',
        issues: [output.trim()],
      };
    }
  }

  private async runPHPCheckForReview(
    filePath: string
  ): Promise<QualityCheckResult | null> {
    try {
      await execAsync(`phpcs --standard=PSR12 "${filePath}"`);
      return null; // No issues found
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      return {
        filePath,
        tool: 'PHP (PHPCS)',
        severity: 'error',
        issues: [output.trim()],
      };
    }
  }

  private async runRubyCheckForReview(
    filePath: string
  ): Promise<QualityCheckResult | null> {
    try {
      await execAsync(`rubocop "${filePath}"`);
      return null; // No issues found
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      return {
        filePath,
        tool: 'Ruby (RuboCop)',
        severity: 'error',
        issues: [output.trim()],
      };
    }
  }

  // Helper methods to parse tool outputs
  private parseESLintOutput(output: string): string[] {
    const lines = output.split('\n').filter(line => line.trim());
    const issues: string[] = [];

    // ESLint output format: file:line:column: severity message (rule)
    lines.forEach(line => {
      // Match ESLint output pattern
      const match = line.match(
        /^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+([a-z0-9\-\/]+)$/
      );
      if (match) {
        const [, lineNum, column, severity, message, rule] = match;
        issues.push(
          `Line ${lineNum}:${column} - ${severity.toUpperCase()}: ${message} (Rule: ${rule})`
        );
      } else if (line.includes('error') || line.includes('warning')) {
        // Fallback for non-standard format
        issues.push(line.trim());
      }
    });

    return issues.slice(0, 20); // Increased limit for more detailed output
  }

  private parseRuffOutput(output: string): string[] {
    const lines = output.split('\n').filter(line => line.trim());
    const issues: string[] = [];

    // Ruff output format: file.py:line:column: CODE message
    lines.forEach(line => {
      const match = line.match(/\.py:(\d+):(\d+):\s+([A-Z0-9]+)\s+(.+)$/);
      if (match) {
        const [, lineNum, column, code, message] = match;
        issues.push(`Line ${lineNum}:${column} - ${message} (Code: ${code})`);
      } else if (
        line.includes('.py:') &&
        (line.includes('error') || line.includes('warning'))
      ) {
        // Fallback for variations
        issues.push(line.trim());
      }
    });

    return issues.slice(0, 20); // Increased limit
  }

  /**
   * Runs Snyk security checks on the provided files and their dependencies
   * @param filePaths Array of file paths to check
   * @returns Array of Snyk results containing vulnerabilities and code issues
   */
  async runSnykChecks(filePaths: string[]): Promise<SnykResult[]> {
    const results: SnykResult[] = [];

    try {
      // First, check if Snyk is installed
      await execAsync('snyk --version');
    } catch (error) {
      return [
        {
          type: 'dependencies',
          error:
            'Snyk is not installed. Run "npm install -g snyk" and "snyk auth" to set up.',
        },
      ];
    }

    // Run dependency vulnerability scan
    const depResult = await this.runSnykDependencyCheck();
    if (depResult) {
      results.push(depResult);
    }

    // Run code security scan on changed files
    const codeResult = await this.runSnykCodeCheck(filePaths);
    if (codeResult) {
      results.push(codeResult);
    }

    return results;
  }

  /**
   * Runs Snyk test for dependency vulnerabilities
   */
  private async runSnykDependencyCheck(): Promise<SnykResult | null> {
    try {
      const { stdout } = await execAsync('snyk test --json', {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
      });

      const data = JSON.parse(stdout);

      // Parse vulnerabilities from Snyk output
      const vulnerabilities: SnykVulnerability[] = [];
      const summary = {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      };

      if (data.vulnerabilities && Array.isArray(data.vulnerabilities)) {
        data.vulnerabilities.forEach((vuln: any) => {
          const severity = vuln.severity.toLowerCase() as
            | 'low'
            | 'medium'
            | 'high'
            | 'critical';
          summary.total++;
          summary[severity]++;

          vulnerabilities.push({
            id: vuln.id,
            title: vuln.title,
            severity,
            packageName: vuln.packageName,
            version: vuln.version,
            from: vuln.from || [],
            upgradePath: vuln.upgradePath,
            isUpgradable: vuln.isUpgradable || false,
            isPatchable: vuln.isPatchable || false,
            description: vuln.description,
            fixedIn: vuln.fixedIn,
            exploit: vuln.exploit,
            CVSSv3: vuln.CVSSv3,
            semver: vuln.semver,
          });
        });
      }

      return {
        type: 'dependencies',
        vulnerabilities,
        summary,
      };
    } catch (error: any) {
      // If error contains JSON, it might be vulnerabilities found (non-zero exit)
      if (error.stdout) {
        try {
          const data = JSON.parse(error.stdout);
          if (data.vulnerabilities) {
            return this.parseSnykErrorOutput(data);
          }
        } catch {
          // Not JSON, actual error
        }
      }

      return {
        type: 'dependencies',
        error: `Snyk dependency check failed: ${error.message}`,
      };
    }
  }

  /**
   * Runs Snyk Code for static application security testing
   */
  private async runSnykCodeCheck(
    filePaths: string[]
  ): Promise<SnykResult | null> {
    try {
      // Snyk Code scans the entire project, not individual files
      // But we'll filter results to only show issues in changed files
      const { stdout } = await execAsync('snyk code test --json', {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      const data = JSON.parse(stdout);
      const codeIssues: SnykCodeIssue[] = [];
      const summary = {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      };

      // Filter to only include issues in our changed files
      const changedFilesSet = new Set(filePaths.map(fp => path.resolve(fp)));

      if (data.runs && data.runs[0] && data.runs[0].results) {
        data.runs[0].results.forEach((result: any) => {
          if (result.locations && result.locations[0]) {
            const location = result.locations[0].physicalLocation;
            const filePath = location.artifactLocation.uri;
            const absolutePath = path.resolve(filePath);

            // Only include if it's in our changed files
            if (changedFilesSet.has(absolutePath)) {
              const severity = this.mapSnykCodeSeverity(result.level);
              summary.total++;
              summary[severity]++;

              codeIssues.push({
                filePath,
                line: location.region.startLine,
                column: location.region.startColumn || 0,
                severity,
                title: result.message.text,
                message: result.message.text,
                ruleId: result.ruleId,
                categories: result.properties?.categories || [],
              });
            }
          }
        });
      }

      return {
        type: 'code',
        codeIssues,
        summary,
      };
    } catch (error: any) {
      // Check if Snyk Code is available
      if (error.message.includes('snyk code is not supported')) {
        return {
          type: 'code',
          error:
            'Snyk Code is not available. Ensure you have authenticated with "snyk auth" and have access to Snyk Code.',
        };
      }

      return {
        type: 'code',
        error: `Snyk Code check failed: ${error.message}`,
      };
    }
  }

  /**
   * Helper to parse Snyk error output that contains vulnerability data
   */
  private parseSnykErrorOutput(data: any): SnykResult {
    const vulnerabilities: SnykVulnerability[] = [];
    const summary = {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    if (data.vulnerabilities && Array.isArray(data.vulnerabilities)) {
      data.vulnerabilities.forEach((vuln: any) => {
        const severity = vuln.severity.toLowerCase() as
          | 'low'
          | 'medium'
          | 'high'
          | 'critical';
        summary.total++;
        summary[severity]++;

        vulnerabilities.push({
          id: vuln.id,
          title: vuln.title,
          severity,
          packageName: vuln.packageName,
          version: vuln.version,
          from: vuln.from || [],
          upgradePath: vuln.upgradePath,
          isUpgradable: vuln.isUpgradable || false,
          isPatchable: vuln.isPatchable || false,
          description: vuln.description,
          fixedIn: vuln.fixedIn,
          exploit: vuln.exploit,
          CVSSv3: vuln.CVSSv3,
          semver: vuln.semver,
        });
      });
    }

    return {
      type: 'dependencies',
      vulnerabilities,
      summary,
    };
  }

  /**
   * Maps Snyk Code severity levels to our standard severity
   */
  private mapSnykCodeSeverity(
    level: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    switch (level?.toLowerCase()) {
      case 'error':
      case 'critical':
        return 'critical';
      case 'warning':
      case 'high':
        return 'high';
      case 'note':
      case 'medium':
        return 'medium';
      default:
        return 'low';
    }
  }

  /**
   * Run comprehensive security checks for code review
   * Includes Snyk, Gitleaks, and other security tools
   */
  public async runSecurityChecksForReview(
    filePaths: string[],
    options: SecurityCheckOptions = {}
  ): Promise<SecurityScanResult[]> {
    const results: SecurityScanResult[] = [];

    // Run Snyk checks (dependencies and code)
    const snykResults = await this.runSnykChecks(filePaths);
    results.push(...this.convertSnykToSecurityResults(snykResults));

    // Run Gitleaks for secret detection
    const gitleaksResult = await this.runGitleaksCheck(filePaths, options);
    if (gitleaksResult) {
      results.push(gitleaksResult);
    }

    return results;
  }

  /**
   * Run Gitleaks to detect secrets in code
   */
  private async runGitleaksCheck(
    filePaths: string[],
    options: SecurityCheckOptions = {}
  ): Promise<SecurityScanResult | null> {
    try {
      // Check if gitleaks is installed
      await execAsync('which gitleaks');
    } catch {
      console.log('⚠️  Gitleaks not installed. Skipping secret detection.');
      return null;
    }

    const findings: SecurityFinding[] = [];
    const summary = {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    try {
      // Create a temporary file list for gitleaks
      const tempFile = path.join(process.cwd(), '.woaru-gitleaks-files.txt');
      await fs.writeFile(tempFile, filePaths.join('\n'));

      // Run gitleaks on specific files
      const { stdout } = await execAsync(
        `gitleaks detect --source . --report-format json --no-git --files-at-path "${tempFile}" 2>/dev/null || true`,
        { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
      );

      // Clean up temp file
      await fs.remove(tempFile);

      if (stdout) {
        const results: GitleaksResult[] = JSON.parse(stdout);

        results.forEach(result => {
          // Only include findings from our target files
          if (filePaths.some(fp => fp.includes(result.File))) {
            const severity = this.getSecretSeverity(result.RuleID);
            summary.total++;
            summary[severity]++;

            findings.push({
              tool: 'gitleaks',
              type: 'secret',
              severity,
              title: `Potential secret exposed: ${result.Description}`,
              description: `Found potential secret matching rule "${result.RuleID}" in file`,
              file: result.File,
              line: result.StartLine,
              column: result.StartColumn,
              recommendation:
                'Remove the secret from the code and rotate it immediately. Use environment variables or secret management tools instead.',
            });
          }
        });
      }

      return {
        tool: 'gitleaks',
        scanTime: new Date(),
        findings,
        summary,
      };
    } catch (error: any) {
      return {
        tool: 'gitleaks',
        scanTime: new Date(),
        findings: [],
        summary,
        error: `Gitleaks check failed: ${error.message}`,
      };
    }
  }

  /**
   * Convert Snyk results to unified SecurityScanResult format
   */
  private convertSnykToSecurityResults(
    snykResults: SnykResult[]
  ): SecurityScanResult[] {
    const results: SecurityScanResult[] = [];

    snykResults.forEach(snykResult => {
      const findings: SecurityFinding[] = [];
      const summary = {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      };

      if (snykResult.type === 'dependencies' && snykResult.vulnerabilities) {
        snykResult.vulnerabilities.forEach(vuln => {
          const severity = vuln.severity as
            | 'critical'
            | 'high'
            | 'medium'
            | 'low';
          summary.total++;
          summary[severity]++;

          findings.push({
            tool: 'snyk',
            type: 'vulnerability',
            severity,
            title: vuln.title,
            description:
              vuln.description ||
              `Vulnerability in ${vuln.packageName}@${vuln.version}`,
            package: vuln.packageName,
            version: vuln.version,
            fixedIn: vuln.fixedIn?.[0],
            cve: vuln.id,
            cwe: vuln.id.startsWith('CWE-') ? [vuln.id] : undefined,
            exploitMaturity: vuln.exploit,
            recommendation: vuln.isUpgradable
              ? `Upgrade ${vuln.packageName} to version ${vuln.fixedIn?.[0] || 'latest'}`
              : 'No direct upgrade available. Check for alternative packages or apply workarounds.',
            references: [`https://snyk.io/vuln/${vuln.id}`],
          });
        });
      }

      if (snykResult.type === 'code' && snykResult.codeIssues) {
        snykResult.codeIssues.forEach(issue => {
          const severity = issue.severity as
            | 'critical'
            | 'high'
            | 'medium'
            | 'low';
          summary.total++;
          summary[severity]++;

          findings.push({
            tool: 'snyk',
            type: 'vulnerability',
            severity,
            title: issue.title,
            description: issue.message,
            file: issue.filePath,
            line: issue.line,
            column: issue.column,
            recommendation: 'Review and fix the code vulnerability',
          });
        });
      }

      if (findings.length > 0 || snykResult.error) {
        results.push({
          tool: 'snyk',
          scanTime: new Date(),
          findings,
          summary,
          error: snykResult.error,
        });
      }
    });

    return results;
  }

  /**
   * Determine severity level for different secret types
   */
  private getSecretSeverity(
    ruleId: string
  ): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    const criticalRules = ['aws-access-token', 'private-key', 'stripe-api-key'];
    const highRules = [
      'github-pat',
      'gitlab-pat',
      'slack-token',
      'google-api-key',
    ];

    if (criticalRules.some(rule => ruleId.toLowerCase().includes(rule))) {
      return 'critical';
    }
    if (highRules.some(rule => ruleId.toLowerCase().includes(rule))) {
      return 'high';
    }
    return 'medium';
  }

  /**
   * Generate human-readable explanation for ESLint issues
   */
  private generateESLintExplanation(issues: string[]): string {
    if (issues.length === 0) return '';

    const categories = {
      syntax: issues.filter(
        i => i.includes('SyntaxError') || i.includes('Parsing error')
      ),
      unused: issues.filter(
        i => i.includes('unused') || i.includes('no-unused')
      ),
      formatting: issues.filter(
        i =>
          i.includes('indent') || i.includes('spacing') || i.includes('quotes')
      ),
      security: issues.filter(
        i =>
          i.includes('security') || i.includes('eval') || i.includes('no-eval')
      ),
      imports: issues.filter(
        i => i.includes('import') || i.includes('require')
      ),
      typescript: issues.filter(i => i.includes('@typescript-eslint')),
      other: issues.filter(
        i =>
          !i.includes('SyntaxError') &&
          !i.includes('unused') &&
          !i.includes('indent') &&
          !i.includes('security') &&
          !i.includes('import') &&
          !i.includes('@typescript-eslint')
      ),
    };

    const explanations = [];

    if (categories.syntax.length > 0) {
      explanations.push(
        `${categories.syntax.length} Syntax-Fehler gefunden - Code kann nicht geparst werden`
      );
    }
    if (categories.unused.length > 0) {
      explanations.push(
        `${categories.unused.length} unbenutzte Variablen/Imports - können entfernt werden`
      );
    }
    if (categories.formatting.length > 0) {
      explanations.push(
        `${categories.formatting.length} Formatierungsprobleme - Einrückung, Anführungszeichen, Abstände`
      );
    }
    if (categories.security.length > 0) {
      explanations.push(
        `${categories.security.length} potenzielle Sicherheitsprobleme - dringend prüfen!`
      );
    }
    if (categories.imports.length > 0) {
      explanations.push(`${categories.imports.length} Import/Export-Probleme`);
    }
    if (categories.typescript.length > 0) {
      explanations.push(
        `${categories.typescript.length} TypeScript-spezifische Probleme`
      );
    }
    if (categories.other.length > 0) {
      explanations.push(
        `${categories.other.length} weitere Code-Qualitätsprobleme`
      );
    }

    return explanations.join(', ');
  }

  /**
   * Generate specific fix suggestions for ESLint issues
   */
  private generateESLintFixes(issues: string[]): string[] {
    const fixes: string[] = [];

    issues.forEach(issue => {
      if (issue.includes('unused')) {
        fixes.push(
          'Entferne unbenutzte Variablen oder füge "_" vor den Namen hinzu'
        );
      }
      if (issue.includes('indent')) {
        fixes.push(
          'Führe "npm run lint:fix" aus, um Einrückung automatisch zu korrigieren'
        );
      }
      if (issue.includes('quotes')) {
        fixes.push(
          'Verwende konsistente Anführungszeichen (single quotes bevorzugt)'
        );
      }
      if (issue.includes('semicolon') || issue.includes('semi')) {
        fixes.push('Füge fehlende Semikolons hinzu oder entferne überflüssige');
      }
      if (issue.includes('no-console')) {
        fixes.push(
          'Ersetze console.log durch Logger oder entferne Debug-Ausgaben'
        );
      }
      if (issue.includes('no-var')) {
        fixes.push('Ersetze "var" durch "let" oder "const"');
      }
      if (issue.includes('prefer-const')) {
        fixes.push(
          'Verwende "const" für Variablen, die nicht neu zugewiesen werden'
        );
      }
      if (issue.includes('no-eval')) {
        fixes.push(
          'Entferne eval() - Sicherheitsrisiko! Verwende sichere Alternativen'
        );
      }
      if (issue.includes('@typescript-eslint/no-explicit-any')) {
        fixes.push(
          'Ersetze "any" durch spezifische Typen für bessere Typsicherheit'
        );
      }
      if (issue.includes('import/no-unresolved')) {
        fixes.push('Prüfe Import-Pfade und installiere fehlende Dependencies');
      }
    });

    // Remove duplicates and add general fix
    const uniqueFixes = Array.from(new Set(fixes));
    if (uniqueFixes.length === 0) {
      uniqueFixes.push(
        'Führe "npm run lint:fix" aus, um automatisch behebbare Probleme zu korrigieren'
      );
    }

    return uniqueFixes;
  }

  /**
   * Run SOLID principles check for review
   */
  private async runSOLIDCheckForReview(
    filePath: string,
    language: string
  ): Promise<SOLIDCheckResult | undefined> {
    try {
      if (!this.solidChecker.supportsLanguage(language)) {
        return undefined;
      }

      const result = await this.solidChecker.analyzeFile(filePath, language);

      // Return result even if no violations (for metrics)
      return result;
    } catch (error) {
      console.warn(
        `SOLID-Checker: Fehler beim Analysieren von ${filePath}:`,
        error
      );
      return undefined;
    }
  }

  /**
   * Run comprehensive SOLID analysis for all files (used by ProductionReadinessAuditor)
   */
  async runSOLIDChecksForProject(
    filePaths: string[],
    language: string
  ): Promise<SOLIDCheckResult[]> {
    const results: SOLIDCheckResult[] = [];

    for (const filePath of filePaths) {
      const result = await this.runSOLIDCheckForReview(filePath, language);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get available SOLID principles for a language
   */
  getAvailableSOLIDPrinciples(language: string): string[] {
    return this.solidChecker.getAvailablePrinciples(language);
  }

  /**
   * Check if SOLID analysis is supported for a language
   */
  supportsSOLIDAnalysis(language: string): boolean {
    return this.solidChecker.supportsLanguage(language);
  }
}
