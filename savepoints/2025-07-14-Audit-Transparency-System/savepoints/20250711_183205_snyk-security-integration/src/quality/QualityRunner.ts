import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { NotificationManager } from '../supervisor/NotificationManager';

const execAsync = promisify(exec);

export interface QualityCheckResult {
  filePath: string;
  tool: string;
  severity: 'error' | 'warning' | 'info';
  issues: string[];
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

  // New method for running checks on multiple files (for review command)
  async runChecksOnFileList(filePaths: string[]): Promise<QualityCheckResult[]> {
    const results: QualityCheckResult[] = [];
    
    for (const filePath of filePaths) {
      const ext = path.extname(filePath).toLowerCase();
      const relativePath = path.relative(process.cwd(), filePath);
      
      try {
        // TypeScript/JavaScript files
        if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
          const result = await this.runESLintCheckForReview(relativePath);
          if (result) results.push(result);
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
          issues: [`Failed to check file: ${error}`]
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

  // Review-specific methods that return results instead of showing notifications
  private async runESLintCheckForReview(filePath: string): Promise<QualityCheckResult | null> {
    try {
      await execAsync(`npx eslint "${filePath}"`);
      return null; // No issues found
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      const issues = this.parseESLintOutput(output);
      return {
        filePath,
        tool: 'ESLint',
        severity: 'error',
        issues
      };
    }
  }

  private async runRuffCheckForReview(filePath: string): Promise<QualityCheckResult | null> {
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
        issues
      };
    }
  }

  private async runGoCheckForReview(filePath: string): Promise<QualityCheckResult | null> {
    try {
      await execAsync(`gofmt -l "${filePath}"`);
      await execAsync(`go vet "${filePath}"`);
      return null; // No issues found
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      return {
        filePath,
        tool: 'Go (gofmt + go vet)',
        severity: 'error',
        issues: [output.trim()]
      };
    }
  }

  private async runRustCheckForReview(filePath: string): Promise<QualityCheckResult | null> {
    try {
      await execAsync(`rustfmt --check "${filePath}"`);
      await execAsync(`cargo clippy --manifest-path "${path.dirname(filePath)}/Cargo.toml" -- -D warnings`);
      return null; // No issues found
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      return {
        filePath,
        tool: 'Rust (rustfmt + clippy)',
        severity: 'error',
        issues: [output.trim()]
      };
    }
  }

  private async runCSharpCheckForReview(filePath: string): Promise<QualityCheckResult | null> {
    try {
      await execAsync(`dotnet format --verify-no-changes "${filePath}"`);
      return null; // No issues found
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      return {
        filePath,
        tool: 'C# (dotnet format)',
        severity: 'error',
        issues: [output.trim()]
      };
    }
  }

  private async runJavaCheckForReview(filePath: string): Promise<QualityCheckResult | null> {
    try {
      await execAsync(`checkstyle -c /google_checks.xml "${filePath}"`);
      return null; // No issues found
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      return {
        filePath,
        tool: 'Java (Checkstyle)',
        severity: 'error',
        issues: [output.trim()]
      };
    }
  }

  private async runPHPCheckForReview(filePath: string): Promise<QualityCheckResult | null> {
    try {
      await execAsync(`phpcs --standard=PSR12 "${filePath}"`);
      return null; // No issues found
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      return {
        filePath,
        tool: 'PHP (PHPCS)',
        severity: 'error',
        issues: [output.trim()]
      };
    }
  }

  private async runRubyCheckForReview(filePath: string): Promise<QualityCheckResult | null> {
    try {
      await execAsync(`rubocop "${filePath}"`);
      return null; // No issues found
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      return {
        filePath,
        tool: 'Ruby (RuboCop)',
        severity: 'error',
        issues: [output.trim()]
      };
    }
  }

  // Helper methods to parse tool outputs
  private parseESLintOutput(output: string): string[] {
    const lines = output.split('\n').filter(line => line.trim());
    return lines.filter(line => 
      line.includes('error') || line.includes('warning')
    ).slice(0, 10); // Limit to first 10 issues
  }

  private parseRuffOutput(output: string): string[] {
    const lines = output.split('\n').filter(line => line.trim());
    return lines.filter(line => 
      line.includes('.py:') && (line.includes('error') || line.includes('warning'))
    ).slice(0, 10); // Limit to first 10 issues
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
      return [{
        type: 'dependencies',
        error: 'Snyk is not installed. Run "npm install -g snyk" and "snyk auth" to set up.'
      }];
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
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large outputs
      });
      
      const data = JSON.parse(stdout);
      
      // Parse vulnerabilities from Snyk output
      const vulnerabilities: SnykVulnerability[] = [];
      const summary = {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      };

      if (data.vulnerabilities && Array.isArray(data.vulnerabilities)) {
        data.vulnerabilities.forEach((vuln: any) => {
          const severity = vuln.severity.toLowerCase() as 'low' | 'medium' | 'high' | 'critical';
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
            semver: vuln.semver
          });
        });
      }

      return {
        type: 'dependencies',
        vulnerabilities,
        summary
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
        error: `Snyk dependency check failed: ${error.message}`
      };
    }
  }

  /**
   * Runs Snyk Code for static application security testing
   */
  private async runSnykCodeCheck(filePaths: string[]): Promise<SnykResult | null> {
    try {
      // Snyk Code scans the entire project, not individual files
      // But we'll filter results to only show issues in changed files
      const { stdout } = await execAsync('snyk code test --json', {
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      const data = JSON.parse(stdout);
      const codeIssues: SnykCodeIssue[] = [];
      const summary = {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
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
                categories: result.properties?.categories || []
              });
            }
          }
        });
      }

      return {
        type: 'code',
        codeIssues,
        summary
      };
    } catch (error: any) {
      // Check if Snyk Code is available
      if (error.message.includes('snyk code is not supported')) {
        return {
          type: 'code',
          error: 'Snyk Code is not available. Ensure you have authenticated with "snyk auth" and have access to Snyk Code.'
        };
      }
      
      return {
        type: 'code',
        error: `Snyk Code check failed: ${error.message}`
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
      low: 0
    };

    if (data.vulnerabilities && Array.isArray(data.vulnerabilities)) {
      data.vulnerabilities.forEach((vuln: any) => {
        const severity = vuln.severity.toLowerCase() as 'low' | 'medium' | 'high' | 'critical';
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
          semver: vuln.semver
        });
      });
    }

    return {
      type: 'dependencies',
      vulnerabilities,
      summary
    };
  }

  /**
   * Maps Snyk Code severity levels to our standard severity
   */
  private mapSnykCodeSeverity(level: string): 'low' | 'medium' | 'high' | 'critical' {
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
}