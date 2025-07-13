import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';

export interface GitDiffResult {
  changedFiles: string[];
  baseBranch: string;
  totalChanges: number;
}

export class GitDiffAnalyzer {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async isGitRepository(): Promise<boolean> {
    return await fs.pathExists(path.join(this.projectPath, '.git'));
  }

  async getChangedFilesSince(
    baseBranch: string = 'main'
  ): Promise<GitDiffResult> {
    if (!(await this.isGitRepository())) {
      throw new Error('Not a git repository');
    }

    return new Promise((resolve, reject) => {
      const gitProcess = spawn(
        'git',
        ['diff', '--name-only', `${baseBranch}...HEAD`],
        {
          cwd: this.projectPath,
          stdio: 'pipe',
        }
      );

      let stdout = '';
      let stderr = '';

      gitProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      gitProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      gitProcess.on('close', (code: number) => {
        if (code !== 0) {
          reject(new Error(`Git command failed: ${stderr}`));
          return;
        }

        const changedFiles = stdout
          .trim()
          .split('\n')
          .filter(file => file.length > 0)
          .map(file => path.resolve(this.projectPath, file))
          .filter(file => fs.existsSync(file)); // Only include files that still exist

        resolve({
          changedFiles,
          baseBranch,
          totalChanges: changedFiles.length,
        });
      });

      gitProcess.on('error', error => {
        reject(new Error(`Failed to execute git command: ${error.message}`));
      });
    });
  }

  async getCurrentBranch(): Promise<string> {
    return new Promise((resolve, reject) => {
      const gitProcess = spawn('git', ['branch', '--show-current'], {
        cwd: this.projectPath,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      gitProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      gitProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      gitProcess.on('close', (code: number) => {
        if (code !== 0) {
          reject(new Error(`Failed to get current branch: ${stderr}`));
          return;
        }

        resolve(stdout.trim());
      });
    });
  }

  async getCommitsSince(baseBranch: string = 'main'): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const gitProcess = spawn(
        'git',
        ['log', '--oneline', `${baseBranch}...HEAD`],
        {
          cwd: this.projectPath,
          stdio: 'pipe',
        }
      );

      let stdout = '';
      let stderr = '';

      gitProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      gitProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      gitProcess.on('close', (code: number) => {
        if (code !== 0) {
          reject(new Error(`Failed to get commits: ${stderr}`));
          return;
        }

        const commits = stdout
          .trim()
          .split('\n')
          .filter(line => line.length > 0);

        resolve(commits);
      });
    });
  }

  filterFilesByExtension(files: string[], extensions: string[]): string[] {
    return files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return extensions.includes(ext);
    });
  }

  categorizeChangedFiles(files: string[]): {
    source: string[];
    config: string[];
    tests: string[];
    docs: string[];
    other: string[];
  } {
    const result = {
      source: [] as string[],
      config: [] as string[],
      tests: [] as string[],
      docs: [] as string[],
      other: [] as string[],
    };

    files.forEach(file => {
      const filename = path.basename(file);
      const ext = path.extname(file).toLowerCase();
      const relativePath = path.relative(this.projectPath, file);

      // Configuration files
      if (
        [
          'package.json',
          'tsconfig.json',
          'requirements.txt',
          'Cargo.toml',
          'go.mod',
        ].includes(filename) ||
        ['.eslintrc', '.prettierrc', 'jest.config', 'pyproject.toml'].some(
          config => filename.includes(config)
        )
      ) {
        result.config.push(file);
      }
      // Test files
      else if (
        relativePath.includes('test') ||
        relativePath.includes('spec') ||
        filename.includes('.test.') ||
        filename.includes('.spec.')
      ) {
        result.tests.push(file);
      }
      // Documentation
      else if (
        ['.md', '.txt', '.rst'].includes(ext) ||
        relativePath.includes('docs')
      ) {
        result.docs.push(file);
      }
      // Source files
      else if (
        [
          '.js',
          '.jsx',
          '.ts',
          '.tsx',
          '.py',
          '.rs',
          '.go',
          '.java',
          '.cs',
          '.php',
          '.rb',
        ].includes(ext)
      ) {
        result.source.push(file);
      }
      // Everything else
      else {
        result.other.push(file);
      }
    });

    return result;
  }
}
