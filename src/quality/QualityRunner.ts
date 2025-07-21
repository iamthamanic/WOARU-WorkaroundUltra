import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolExecutor } from '../utils/toolExecutor';
import * as path from 'path';
import * as fs from 'fs-extra';
import { APP_CONFIG } from '../config/constants';
import { NotificationManager } from '../supervisor/NotificationManager';
import i18next from 'i18next';
import {
  ToolsDatabaseManager,
  // CoreTool, // unused
  ExperimentalTool,
} from '../database/ToolsDatabaseManager';
import { EslintPlugin } from '../plugins/EslintPlugin';
import {
  SecurityFinding,
  SecurityScanResult,
  SecurityCheckOptions,
} from '../types/security';
import { SOLIDChecker } from '../solid/SOLIDChecker';
import { SOLIDCheckResult } from '../solid/types/solid-types';
import { CodeSmellAnalyzer } from '../analyzer/CodeSmellAnalyzer';
import { CodeSmellFinding } from '../types/code-smell';
import { CodeIssue } from '../supervisor/types';
import {
  SnykVulnerability as ImportedSnykVulnerability,
  SnykResult as ImportedSnykResult,
} from '../types';

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
  codeSmellFindings?: CodeSmellFinding[]; // Internal code smell analysis
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
  private corePlugins: Map<string, Record<string, unknown>>;
  private solidChecker: SOLIDChecker;
  private codeSmellAnalyzer: CodeSmellAnalyzer;

  constructor(notificationManager: NotificationManager) {
    this.notificationManager = notificationManager;
    this.databaseManager = new ToolsDatabaseManager();
    this.corePlugins = new Map();
    this.solidChecker = new SOLIDChecker();
    this.codeSmellAnalyzer = new CodeSmellAnalyzer();

    // Initialize core plugins
    this.initializeCorePlugins();
  }

  /**
   * Initialize secure core plugins
   */
  private initializeCorePlugins(): void {
    // Only add verified, secure core plugins
    this.corePlugins.set(
      'EslintPlugin',
      new EslintPlugin() as unknown as Record<string, unknown>
    );
    // More core plugins would be added here as they're implemented
  }

  /**
   * HYBRID ARCHITECTURE: Run quality checks using both core plugins and experimental tools
   */
  async runChecksOnFileChange(filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    const relativePath = path.relative(process.cwd(), filePath);

    try {
      // Phase 0: Always run internal code smell analysis first (no external dependencies)
      await this.runInternalCodeSmellAnalysis(relativePath, ext);

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
      console.warn(
        i18next.t('quality_runner.check_failed', { file: relativePath }),
        error
      );
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

        const pluginWithMethods = plugin as Record<string, unknown> & {
          canHandleFile?: (path: string) => Promise<boolean>;
          runLinter?: (
            path: string,
            options: { fix: boolean }
          ) => Promise<{
            hasErrors: boolean;
            hasWarnings: boolean;
            output: string;
          }>;
        };

        if (
          pluginWithMethods.canHandleFile &&
          (await pluginWithMethods.canHandleFile(filePath))
        ) {
          console.log(
            `🔧 ${i18next.t('quality_runner.core_plugin_running', { tool: coreTool.name, file: filePath })}`
          );

          if (pluginWithMethods.runLinter) {
            const result = await pluginWithMethods.runLinter(filePath, {
              fix: false,
            });

            if (result.hasErrors) {
              this.notificationManager.showCriticalQualityError(
                filePath,
                coreTool.name,
                result.output
              );
            } else if (result.hasWarnings) {
              console.log(
                `⚠️ ${i18next.t('quality_runner.tool_warnings', { tool: coreTool.name, file: filePath })}`
              );
            } else {
              this.notificationManager.showQualitySuccess(
                filePath,
                coreTool.name
              );
            }

            return true; // Successfully handled by core plugin
          }
        }
      }

      return false; // No core plugin could handle this file
    } catch (error) {
      console.warn(i18next.t('quality_runner.core_plugin_failed'), error);
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
            `🧪 ${i18next.t('quality_runner.experimental_tool_running', { tool: experimentalTool.name, file: filePath })}`
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
      console.warn(i18next.t('quality_runner.experimental_tool_failed'), error);
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
    console.log(
      `📦 ${i18next.t('quality_runner.legacy_check_running', { file: filePath })}`
    );

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
          const language = ext.startsWith('.ts') ? 'typescript' : 'javascript';

          // Always run internal code smell analysis first
          const codeSmellFindings = await this.codeSmellAnalyzer.analyzeFile(
            filePath,
            language
          );

          // Try ESLint check
          const eslintResult = await this.runESLintCheckForReview(relativePath);

          if (eslintResult) {
            // Add SOLID analysis and code smell findings to ESLint results
            const solidResult = await this.runSOLIDCheckForReview(
              filePath,
              language
            );
            eslintResult.solidResult = solidResult;
            eslintResult.codeSmellFindings = codeSmellFindings;
            results.push(eslintResult);
          } else if (codeSmellFindings.length > 0) {
            // No ESLint but we have code smell findings - create a result
            const issues = codeSmellFindings.map(
              finding =>
                `Line ${finding.line}:${finding.column} - ${finding.message}`
            );
            const fixes = codeSmellFindings
              .filter(finding => finding.suggestion)
              .map(finding => finding.suggestion || 'No suggestion available');
            const criticalFindings = codeSmellFindings.filter(
              f => f.severity === 'error'
            );
            const severity =
              criticalFindings.length > 0
                ? ('error' as const)
                : ('warning' as const);

            // Add SOLID analysis
            const solidResult = await this.runSOLIDCheckForReview(
              filePath,
              language
            );

            results.push({
              filePath: relativePath,
              tool: 'WOARU Code Smell Analyzer',
              severity,
              issues,
              fixes: fixes.length > 0 ? fixes : undefined,
              explanation: `WOARU internal analysis found ${codeSmellFindings.length} code quality issues`,
              codeSmellFindings,
              solidResult,
            });
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
      await ToolExecutor.runESLint(filePath, {
        cwd: path.dirname(filePath),
      });

      this.notificationManager.showQualitySuccess(filePath, 'ESLint');
    } catch (error: unknown) {
      // ESLint failed - extract error output
      const output = String(
        (error as Record<string, unknown>)?.stdout ||
          (error as Record<string, unknown>)?.stderr ||
          (error as Record<string, unknown>)?.message ||
          'Unknown error'
      );
      this.notificationManager.showCriticalQualityError(
        filePath,
        'ESLint',
        String(output)
      );
    }
  }

  private async runRuffCheck(filePath: string): Promise<void> {
    try {
      await ToolExecutor.runRuff(filePath, true); // true = fix enabled
      this.notificationManager.showQualitySuccess(filePath, 'Ruff');
    } catch (error: unknown) {
      // Ruff failed - extract error output
      const output = String(
        (error as Record<string, unknown>)?.stdout ||
          (error as Record<string, unknown>)?.stderr ||
          (error as Record<string, unknown>)?.message ||
          'Unknown error'
      );
      this.notificationManager.showCriticalQualityError(
        filePath,
        'Ruff',
        String(output)
      );
    }
  }

  private async runGoCheck(filePath: string): Promise<void> {
    try {
      // First run gofmt to check formatting
      const { stdout: gofmtOutput } = await ToolExecutor.runGoFmt(filePath);

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
      await ToolExecutor.runGoVet(filePath);

      this.notificationManager.showQualitySuccess(
        filePath,
        'Go (gofmt + go vet)'
      );
    } catch (error: unknown) {
      // go vet failed - extract error output
      const output = String(
        (error as Record<string, unknown>)?.stdout ||
          (error as Record<string, unknown>)?.stderr ||
          (error as Record<string, unknown>)?.message ||
          'Unknown error'
      );
      this.notificationManager.showCriticalQualityError(
        filePath,
        'go vet',
        String(output)
      );
    }
  }

  private async runRustCheck(filePath: string): Promise<void> {
    let hasErrors = false;
    let errorOutput = '';

    try {
      // First check formatting with rustfmt
      await ToolExecutor.runRustFmt(filePath);

      // rustfmt returns non-zero exit code if formatting is needed
      // We'll catch this in the error handler below
    } catch (fmtError: unknown) {
      if (
        (fmtError as Record<string, unknown>)?.message
          ?.toString()
          ?.includes('Diff in')
      ) {
        hasErrors = true;
        errorOutput += `Formatting issues found. Run 'rustfmt ${filePath}' to fix.\n\n`;
        errorOutput +=
          (fmtError as Record<string, unknown>)?.stdout ||
          (fmtError as Record<string, unknown>)?.stderr ||
          (fmtError as Record<string, unknown>)?.message ||
          'Unknown error';
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
    } catch (clippyError: unknown) {
      hasErrors = true;
      const clippyOutput =
        (clippyError as Record<string, unknown>)?.stdout ||
        (clippyError as Record<string, unknown>)?.stderr ||
        (clippyError as Record<string, unknown>)?.message ||
        'Unknown error';

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
      await execAsync(
        `dotnet format --verify-no-changes --include "${filePath}" 2>&1`
      );

      // If no output and success, file is properly formatted
      this.notificationManager.showQualitySuccess(filePath, 'dotnet format');
    } catch (error: unknown) {
      const output = String(
        (error as Record<string, unknown>)?.stdout ||
          (error as Record<string, unknown>)?.stderr ||
          (error as Record<string, unknown>)?.message ||
          'Unknown error'
      );

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
    } catch {
      // If google-java-format is not available, try checkstyle
      try {
        await ToolExecutor.runCheckstyle(filePath);
        this.notificationManager.showQualitySuccess(filePath, 'Checkstyle');
      } catch (checkstyleError: unknown) {
        const output = String(
          (checkstyleError as Record<string, unknown>)?.stdout ||
            (checkstyleError as Record<string, unknown>)?.stderr ||
            (checkstyleError as Record<string, unknown>)?.message ||
            'Unknown error'
        );
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
      await ToolExecutor.runPhpCs(filePath, 'PSR12');
      this.notificationManager.showQualitySuccess(filePath, 'PHP_CodeSniffer');
    } catch (error: unknown) {
      const output = String(
        (error as Record<string, unknown>)?.stdout ||
          (error as Record<string, unknown>)?.stderr ||
          (error as Record<string, unknown>)?.message ||
          'Unknown error'
      );

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
      await ToolExecutor.runRuboCop(filePath, 'simple');
      this.notificationManager.showQualitySuccess(filePath, 'RuboCop');
    } catch (error: unknown) {
      const output = String(
        (error as Record<string, unknown>)?.stdout ||
          (error as Record<string, unknown>)?.stderr ||
          (error as Record<string, unknown>)?.message ||
          'Unknown error'
      );

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
      // Run ESLint with context-sensitive configuration
      await ToolExecutor.runESLint(filePath);
      return null; // No issues found
    } catch (error: unknown) {
      const output = String(
        (error as Record<string, unknown>)?.stdout ||
          (error as Record<string, unknown>)?.stderr ||
          (error as Record<string, unknown>)?.message ||
          'Unknown error'
      );
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
      await ToolExecutor.runRuff(filePath, false); // false = no fix, just check
      return null; // No issues found
    } catch (error: unknown) {
      const output = String(
        (error as Record<string, unknown>)?.stdout ||
          (error as Record<string, unknown>)?.stderr ||
          (error as Record<string, unknown>)?.message ||
          'Unknown error'
      );
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
      const { stdout: fmtOutput } = await ToolExecutor.runGoFmt(filePath);
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
    } catch (error: unknown) {
      issues.push(`gofmt error: ${(error as Error).message}`);
    }

    try {
      // Run go vet
      await ToolExecutor.runGoVet(filePath);
    } catch (error: unknown) {
      const output = String(
        (error as Record<string, unknown>)?.stdout ||
          (error as Record<string, unknown>)?.stderr ||
          (error as Record<string, unknown>)?.message ||
          'Unknown error'
      );
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
      await ToolExecutor.runRustFmt(filePath);
      await execAsync(
        `cargo clippy --manifest-path "${path.dirname(filePath)}/Cargo.toml" -- -D warnings`
      );
      return null; // No issues found
    } catch (error: unknown) {
      const output = String(
        (error as Record<string, unknown>)?.stdout ||
          (error as Record<string, unknown>)?.stderr ||
          (error as Record<string, unknown>)?.message ||
          'Unknown error'
      );
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
      await ToolExecutor.runDotNetFormat(filePath);
      return null; // No issues found
    } catch (error: unknown) {
      const output = String(
        (error as Record<string, unknown>)?.stdout ||
          (error as Record<string, unknown>)?.stderr ||
          (error as Record<string, unknown>)?.message ||
          'Unknown error'
      );
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
      await ToolExecutor.runCheckstyle(filePath);
      return null; // No issues found
    } catch (error: unknown) {
      const output = String(
        (error as Record<string, unknown>)?.stdout ||
          (error as Record<string, unknown>)?.stderr ||
          (error as Record<string, unknown>)?.message ||
          'Unknown error'
      );
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
      await ToolExecutor.runPhpCs(filePath, 'PSR12');
      return null; // No issues found
    } catch (error: unknown) {
      const output = String(
        (error as Record<string, unknown>)?.stdout ||
          (error as Record<string, unknown>)?.stderr ||
          (error as Record<string, unknown>)?.message ||
          'Unknown error'
      );
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
      await ToolExecutor.runRuboCop(filePath);
      return null; // No issues found
    } catch (error: unknown) {
      const output = String(
        (error as Record<string, unknown>)?.stdout ||
          (error as Record<string, unknown>)?.stderr ||
          (error as Record<string, unknown>)?.message ||
          'Unknown error'
      );
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
        /^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+([a-z0-9\-/]+)$/
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
    } catch {
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
        data.vulnerabilities.forEach((vuln: ImportedSnykVulnerability) => {
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
            version: vuln.version as string,
            from: (vuln.from as string[]) || [],
            upgradePath: vuln.upgradePath as string[] | undefined,
            isUpgradable: (vuln.isUpgradable as boolean) || false,
            isPatchable: (vuln.isPatchable as boolean) || false,
            description: vuln.description as string | undefined,
            fixedIn: vuln.fixedIn as string[] | undefined,
            exploit: vuln.exploit as string | undefined,
            CVSSv3: vuln.CVSSv3 as string | undefined,
            semver: vuln.semver as { vulnerable: string[] } | undefined,
          });
        });
      }

      return {
        type: 'dependencies',
        vulnerabilities,
        summary,
      };
    } catch (error: unknown) {
      // If error contains JSON, it might be vulnerabilities found (non-zero exit)
      if ((error as any).stdout) {
        try {
          const data = JSON.parse((error as any).stdout);
          if (data.vulnerabilities) {
            return this.parseSnykErrorOutput(data) as any;
          }
        } catch {
          // Not JSON, actual error
        }
      }

      return {
        type: 'dependencies',
        error: `Snyk dependency check failed: ${(error as Error).message}`,
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
    } catch (error: unknown) {
      // Check if Snyk Code is available
      if ((error as Error).message.includes('snyk code is not supported')) {
        return {
          type: 'code',
          error:
            'Snyk Code is not available. Ensure you have authenticated with "snyk auth" and have access to Snyk Code.',
        };
      }

      return {
        type: 'code',
        error: `Snyk Code check failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Helper to parse Snyk error output that contains vulnerability data
   */
  private parseSnykErrorOutput(data: {
    vulnerabilities: ImportedSnykVulnerability[];
  }): ImportedSnykResult {
    const vulnerabilities: SnykVulnerability[] = [];
    const summary = {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    if (data.vulnerabilities && Array.isArray(data.vulnerabilities)) {
      data.vulnerabilities.forEach((vuln: ImportedSnykVulnerability) => {
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
          version: vuln.version as string,
          from: (vuln.from as string[]) || [],
          upgradePath: vuln.upgradePath as string[] | undefined,
          isUpgradable: (vuln.isUpgradable as boolean) || false,
          isPatchable: (vuln.isPatchable as boolean) || false,
          description: vuln.description as string | undefined,
          fixedIn: vuln.fixedIn as string[] | undefined,
          exploit: vuln.exploit as string | undefined,
          CVSSv3: vuln.CVSSv3 as string | undefined,
          semver: vuln.semver as { vulnerable: string[] } | undefined,
        });
      });
    }

    return {
      type: 'dependencies' as const,
      tool: 'snyk',
      totalVulnerabilities: vulnerabilities.length,
      findings: [], // Will be populated if needed
      summary,
      vulnerabilities,
    } as any;
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

    // Run basic security analysis for XSS and other vulnerabilities
    const basicSecurityResult = await this.runBasicSecurityAnalysis(
      filePaths,
      options
    );
    if (basicSecurityResult) {
      results.push(basicSecurityResult);
    }

    return results;
  }

  /**
   * Run Gitleaks to detect secrets in code
   */
  private async runGitleaksCheck(
    filePaths: string[],
    _options: SecurityCheckOptions = {}
  ): Promise<SecurityScanResult | null> {
    try {
      // Check if gitleaks is installed
      await execAsync('which gitleaks');
    } catch {
      console.log(
        `⚠️  ${i18next.t('security_analysis.gitleaks_not_installed')}`
      );
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
        const results: any[] = JSON.parse(stdout);

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
    } catch (error: unknown) {
      return {
        tool: 'gitleaks',
        scanTime: new Date(),
        findings: [],
        summary,
        error: `Gitleaks check failed: ${error instanceof Error ? error.message : String(error)}`,
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
          `Führe "${APP_CONFIG.TOOL_COMMANDS.NPM.LINT_FIX}" aus, um Einrückung automatisch zu korrigieren`
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
      if (issue.includes(APP_CONFIG.ESLINT_RULES.NO_VAR)) {
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
        `Führe "${APP_CONFIG.TOOL_COMMANDS.NPM.LINT_FIX}" aus, um automatisch behebbare Probleme zu korrigieren`
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

  /**
   * Phase 0: Run internal code smell analysis (no external dependencies)
   */
  private async runInternalCodeSmellAnalysis(
    filePath: string,
    fileExtension: string
  ): Promise<void> {
    try {
      // Only analyze JavaScript/TypeScript files for now
      const supportedExtensions = [
        '.js',
        '.jsx',
        '.ts',
        '.tsx',
        '.mjs',
        '.cjs',
      ];
      if (!supportedExtensions.includes(fileExtension)) {
        return;
      }

      const language = this.getLanguageFromExtension(fileExtension);
      const codeSmellFindings = await this.codeSmellAnalyzer.analyzeFile(
        filePath,
        language
      );

      if (codeSmellFindings.length > 0) {
        // Convert code smell findings to CodeIssue format
        const codeIssues: CodeIssue[] = codeSmellFindings.map(finding => ({
          type: finding.type,
          severity:
            finding.severity === 'error'
              ? 'critical'
              : finding.severity === 'warning'
                ? 'high'
                : 'medium',
          file: filePath,
          line: finding.line,
          message: finding.message,
          tool: 'WOARU Code Smell Analyzer',
          autoFixable: false,
        }));

        await this.notificationManager.notifyIssues(codeIssues);
      }
    } catch (error) {
      console.warn(
        i18next.t('quality_runner.check_failed', { file: filePath }),
        error
      );
    }
  }

  /**
   * Helper method to determine language from file extension
   */
  private getLanguageFromExtension(extension: string): string {
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
    };

    return languageMap[extension] || 'javascript';
  }

  /**
   * Get available code smell types for a language
   */
  getAvailableCodeSmellChecks(language: string): string[] {
    if (language === 'javascript' || language === 'typescript') {
      return [
        'complexity',
        'var-keyword',
        'weak-equality',
        'console-log',
        'function-length',
        'parameter-count',
        'nested-depth',
        'magic-number',
      ];
    }
    return [];
  }

  /**
   * Check if code smell analysis is supported for a language
   */
  supportsCodeSmellAnalysis(language: string): boolean {
    return language === 'javascript' || language === 'typescript';
  }

  /**
   * Get context-sensitive ESLint command based on file extension
   * Implements Bug Fix 2: Context-sensitive linting for JS/TS files
   */
  private getContextSensitiveESLintCommand(
    filePath: string,
    withFormat = false
  ): string {
    const ext = path.extname(filePath).toLowerCase();
    const isTypeScript = ['.ts', '.tsx'].includes(ext);
    const isJavaScript = ['.js', '.jsx', '.mjs', '.cjs'].includes(ext);

    if (!isTypeScript && !isJavaScript) {
      // Fallback to default ESLint command
      return withFormat
        ? APP_CONFIG.TOOL_COMMANDS.ESLINT.WITH_FORMAT
        : APP_CONFIG.TOOL_COMMANDS.ESLINT.BASE;
    }

    // Create temporary ESLint config for this file type
    const baseCommand = withFormat
      ? 'npx eslint --format stylish'
      : 'npx eslint';

    if (isJavaScript) {
      // JavaScript-specific configuration (no TypeScript rules)
      return `${baseCommand} --no-eslintrc --config '{"env":{"node":true,"es6":true},"extends":["eslint:recommended"],"parserOptions":{"ecmaVersion":2020,"sourceType":"module"},"rules":{"complexity":["error",10],"no-var":"error","eqeqeq":"error","no-console":"error","prefer-const":"error","no-unused-vars":["error",{"argsIgnorePattern":"^_"}]}}'`;
    } else {
      // TypeScript-specific configuration (with TypeScript rules)
      return `${baseCommand} --no-eslintrc --config '{"env":{"node":true,"es6":true},"extends":["eslint:recommended"],"parser":"@typescript-eslint/parser","plugins":["@typescript-eslint"],"parserOptions":{"ecmaVersion":2020,"sourceType":"module","project":"./tsconfig.json"},"rules":{"complexity":["error",10],"no-var":"error","eqeqeq":"error","no-console":"error","prefer-const":"error","@typescript-eslint/no-unused-vars":["error",{"argsIgnorePattern":"^_"}],"@typescript-eslint/no-explicit-any":"warn"}}'`;
    }
  }

  /**
   * Run basic security analysis for XSS and other vulnerabilities
   * Implements Bug Fix 3: Basic security analysis with pattern matching
   */
  private async runBasicSecurityAnalysis(
    filePaths: string[],
    options: SecurityCheckOptions = {}
  ): Promise<SecurityScanResult | null> {
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
      // First try Semgrep if available
      const semgrepResult = await this.runSemgrepAnalysis(filePaths, options);
      if (semgrepResult) {
        return semgrepResult;
      }

      // Fallback to pattern-based analysis
      for (const filePath of filePaths) {
        const ext = path.extname(filePath).toLowerCase();

        // Only analyze JavaScript/TypeScript files for web vulnerabilities
        if (!['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
          continue;
        }

        const fileContent = await fs.readFile(filePath, 'utf-8');
        const lines = fileContent.split('\n');

        // Check for XSS vulnerabilities
        const xssFindings = this.detectXSSVulnerabilities(filePath, lines);
        findings.push(...xssFindings);

        // Check for other security issues
        const otherFindings = this.detectOtherSecurityIssues(filePath, lines);
        findings.push(...otherFindings);
      }

      // Calculate summary
      findings.forEach(finding => {
        summary.total++;
        summary[finding.severity]++;
      });

      return {
        tool: 'woaru-security',
        scanTime: new Date(),
        findings,
        summary,
      };
    } catch (error: unknown) {
      return {
        tool: 'woaru-security',
        scanTime: new Date(),
        findings: [],
        summary,
        error: `Basic security analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Try to run Semgrep analysis if available
   */
  private async runSemgrepAnalysis(
    filePaths: string[],
    _options: SecurityCheckOptions = {}
  ): Promise<SecurityScanResult | null> {
    try {
      // Check if Semgrep is installed
      await execAsync('which semgrep', { timeout: 5000 });

      // Run Semgrep with basic security rules
      const { stdout } = await execAsync(
        `semgrep --config=auto --json ${filePaths.join(' ')}`,
        { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
      );

      const results = JSON.parse(stdout);
      const findings: SecurityFinding[] = [];
      const summary = {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      };

      if (results.results && Array.isArray(results.results)) {
        results.results.forEach((result: any) => {
          const severity = this.mapSemgrepSeverity(
            result.extra?.severity || 'INFO'
          );
          summary.total++;
          summary[severity]++;

          findings.push({
            tool: 'semgrep',
            type: 'vulnerability',
            severity,
            title: result.check_id || 'Security Issue',
            description:
              result.extra?.message ||
              result.message ||
              'Security vulnerability detected',
            file: result.path,
            line: result.start?.line,
            column: result.start?.col,
            cwe: result.extra?.metadata?.cwe
              ? [result.extra.metadata.cwe]
              : undefined,
            recommendation:
              result.extra?.fix || 'Review and fix the security issue',
            references: result.extra?.references || [],
          });
        });
      }

      return {
        tool: 'semgrep',
        scanTime: new Date(),
        findings,
        summary,
      };
    } catch {
      // Semgrep not available, return null to fallback to pattern matching
      return null;
    }
  }

  /**
   * Detect XSS vulnerabilities using pattern matching
   */
  private detectXSSVulnerabilities(
    filePath: string,
    lines: string[]
  ): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    const xssPatterns = [
      {
        pattern: /\.innerHTML\s*=\s*([^;]+)/gi,
        title: 'Potential XSS vulnerability via innerHTML',
        description:
          'Direct assignment to innerHTML can lead to XSS attacks if user input is not sanitized',
        severity: 'high' as const,
        cwe: ['CWE-79'],
        recommendation:
          'Use textContent instead of innerHTML, or sanitize user input with a library like DOMPurify',
      },
      {
        pattern: /document\.write\s*\(/gi,
        title: 'Potential XSS vulnerability via document.write',
        description: 'document.write can be exploited for XSS attacks',
        severity: 'high' as const,
        cwe: ['CWE-79'],
        recommendation:
          'Avoid document.write and use safer DOM manipulation methods',
      },
      {
        pattern: /eval\s*\(/gi,
        title: 'Code injection vulnerability via eval()',
        description:
          'eval() can execute arbitrary JavaScript code and is a major security risk',
        severity: 'critical' as const,
        cwe: ['CWE-94'],
        recommendation:
          'Replace eval() with safer alternatives like JSON.parse() for data or explicit function calls',
      },
      {
        pattern: /setTimeout\s*\(\s*["'`][^"'`]*\+/gi,
        title:
          'Potential code injection via setTimeout with string concatenation',
        description:
          'setTimeout with string concatenation can lead to code injection',
        severity: 'high' as const,
        cwe: ['CWE-94'],
        recommendation:
          'Use function references instead of string concatenation in setTimeout',
      },
      {
        pattern: /setInterval\s*\(\s*["'`][^"'`]*\+/gi,
        title:
          'Potential code injection via setInterval with string concatenation',
        description:
          'setInterval with string concatenation can lead to code injection',
        severity: 'high' as const,
        cwe: ['CWE-94'],
        recommendation:
          'Use function references instead of string concatenation in setInterval',
      },
    ];

    lines.forEach((line, index) => {
      xssPatterns.forEach(pattern => {
        const match = pattern.pattern.exec(line);
        if (match) {
          findings.push({
            tool: 'woaru-security',
            type: 'vulnerability',
            severity: pattern.severity,
            title: pattern.title,
            description: pattern.description,
            file: filePath,
            line: index + 1,
            column: match.index + 1,
            cwe: pattern.cwe,
            recommendation: pattern.recommendation,
          });
        }
        // Reset regex for next iteration
        pattern.pattern.lastIndex = 0;
      });
    });

    return findings;
  }

  /**
   * Detect other security issues using pattern matching
   */
  private detectOtherSecurityIssues(
    filePath: string,
    lines: string[]
  ): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    const securityPatterns = [
      {
        pattern: /SELECT\s+.*\s+FROM\s+.*\s+WHERE\s+.*\s*\+\s*/gi,
        title: 'Potential SQL injection vulnerability',
        description:
          'SQL query with string concatenation may be vulnerable to SQL injection',
        severity: 'high' as const,
        cwe: ['CWE-89'],
        recommendation:
          'Use parameterized queries or prepared statements instead of string concatenation',
      },
      {
        pattern: /fs\.(unlink|rmdir|remove).*\+/gi,
        title: 'Potential path traversal vulnerability',
        description:
          'File system operations with string concatenation may be vulnerable to path traversal',
        severity: 'medium' as const,
        cwe: ['CWE-22'],
        recommendation:
          'Validate and sanitize file paths, use path.join() and path.resolve()',
      },
      {
        pattern: /process\.env\.[A-Z_]+\s*\+/gi,
        title: 'Potential environment variable exposure',
        description:
          'Environment variables should not be concatenated directly into strings',
        severity: 'medium' as const,
        cwe: ['CWE-200'],
        recommendation:
          'Validate and sanitize environment variables before use',
      },
    ];

    lines.forEach((line, index) => {
      securityPatterns.forEach(pattern => {
        const match = pattern.pattern.exec(line);
        if (match) {
          findings.push({
            tool: 'woaru-security',
            type: 'vulnerability',
            severity: pattern.severity,
            title: pattern.title,
            description: pattern.description,
            file: filePath,
            line: index + 1,
            column: match.index + 1,
            cwe: pattern.cwe,
            recommendation: pattern.recommendation,
          });
        }
        // Reset regex for next iteration
        pattern.pattern.lastIndex = 0;
      });
    });

    return findings;
  }

  /**
   * Map Semgrep severity to our standard severity levels
   */
  private mapSemgrepSeverity(
    severity: string
  ): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    switch (severity.toUpperCase()) {
      case 'ERROR':
        return 'critical';
      case 'WARNING':
        return 'high';
      case 'INFO':
        return 'medium';
      default:
        return 'low';
    }
  }
}
