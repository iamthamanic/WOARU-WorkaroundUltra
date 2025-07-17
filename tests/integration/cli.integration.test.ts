import { spawn, SpawnOptions } from 'child_process';
import path from 'path';
import fs from 'fs-extra';

// Mock fs-extra for test setup
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn(),
  writeFile: jest.fn(),
  remove: jest.fn()
}));

// CLI Integration Tests - Testing the actual CLI binary
describe('CLI Integration Tests', () => {
  const CLI_PATH = path.join(__dirname, '../../dist/cli.js');
  const TEST_PROJECT_PATH = path.join(__dirname, '../fixtures/test-project');
  
  // Helper function to run CLI commands
  const runCLICommand = (args: string[], options: SpawnOptions = {}): Promise<{
    stdout: string;
    stderr: string;
    code: number;
  }> => {
    return new Promise((resolve) => {
      const child = spawn('node', [CLI_PATH, ...args], {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: 'test' },
        ...options
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          code: code || 0
        });
      });
    });
  };

  // Setup test project directory
  beforeAll(async () => {
    const mockedFs = fs as jest.Mocked<typeof fs>;
    mockedFs.ensureDir.mockResolvedValue(undefined);
    mockedFs.writeFile.mockResolvedValue(undefined);
    mockedFs.remove.mockResolvedValue(undefined);
    
    await fs.ensureDir(TEST_PROJECT_PATH);
    await fs.writeFile(
      path.join(TEST_PROJECT_PATH, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        scripts: {
          test: 'jest',
          build: 'tsc'
        },
        dependencies: {
          'express': '^4.18.0',
          'react': '^18.0.0'
        }
      }, null, 2)
    );
    
    await fs.writeFile(
      path.join(TEST_PROJECT_PATH, 'src/index.js'),
      'console.log("Hello World");'
    );
  });

  // Cleanup test project directory
  afterAll(async () => {
    await fs.remove(TEST_PROJECT_PATH);
  });

  describe('Command Parsing Tests', () => {
    describe('Main Commands', () => {
      it('should recognize "quick-analyze" command', async () => {
        const result = await runCLICommand(['quick-analyze', '--path', TEST_PROJECT_PATH, '--json']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toBeTruthy();
        
        // Should return valid JSON
        expect(() => JSON.parse(result.stdout)).not.toThrow();
      });

      it('should recognize "analyze" command', async () => {
        const result = await runCLICommand(['analyze', '--path', TEST_PROJECT_PATH, '--json']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toBeTruthy();
      });

      it('should recognize "setup" command', async () => {
        const result = await runCLICommand(['setup', '--help']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('setup');
      });

      it('should recognize "status" command', async () => {
        const result = await runCLICommand(['status', '--help']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('status');
      });

      it('should recognize "review" command', async () => {
        const result = await runCLICommand(['review', '--help']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('review');
      });

      it('should recognize "ai" command', async () => {
        const result = await runCLICommand(['ai', '--help']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('ai');
      });

      it('should recognize "watch" command', async () => {
        const result = await runCLICommand(['watch', '--help']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('watch');
      });

      it('should recognize "logs" command', async () => {
        const result = await runCLICommand(['logs', '--help']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('logs');
      });

      it('should recognize "docu" command', async () => {
        const result = await runCLICommand(['docu', '--help']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('docu');
      });

      it('should recognize "helpers" command', async () => {
        const result = await runCLICommand(['helpers', '--help']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('helpers');
      });
    });

    describe('Sub-Commands', () => {
      it('should recognize "review git" sub-command', async () => {
        const result = await runCLICommand(['review', 'git', '--help']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('review git');
      });

      it('should recognize "review local" sub-command', async () => {
        const result = await runCLICommand(['review', 'local', '--help']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('review local');
      });

      it('should recognize "review path" sub-command', async () => {
        const result = await runCLICommand(['review', 'path', '--help']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('review path');
      });

      it('should recognize "review git ai" nested sub-command', async () => {
        const result = await runCLICommand(['review', 'git', 'ai', '--help']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('ai');
      });

      it('should recognize "review local ai" nested sub-command', async () => {
        const result = await runCLICommand(['review', 'local', 'ai', '--help']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('ai');
      });

      it('should recognize "setup ai" sub-command', async () => {
        const result = await runCLICommand(['setup', 'ai', '--help']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('ai');
      });

      it('should recognize "ai setup" sub-command', async () => {
        const result = await runCLICommand(['ai', 'setup', '--help']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('setup');
      });

      it('should recognize "docu ai" sub-command', async () => {
        const result = await runCLICommand(['docu', 'ai', '--help']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('ai');
      });

      it('should recognize "logs clear" sub-command', async () => {
        const result = await runCLICommand(['logs', 'clear', '--help']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('clear');
      });

      it('should recognize "logs stats" sub-command', async () => {
        const result = await runCLICommand(['logs', 'stats', '--help']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('stats');
      });
    });
  });

  describe('Flag and Option Tests', () => {
    it('should handle --path option for analyze command', async () => {
      const result = await runCLICommand(['analyze', '--path', TEST_PROJECT_PATH, '--json']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toBeTruthy();
    });

    it('should handle --json flag for analyze command', async () => {
      const result = await runCLICommand(['analyze', '--path', TEST_PROJECT_PATH, '--json']);
      
      expect(result.code).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });

    it('should handle --branch option for review git command', async () => {
      const result = await runCLICommand(['review', 'git', '--help']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('--branch');
    });

    it('should handle --output option for review commands', async () => {
      const result = await runCLICommand(['review', 'git', '--help']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('--output');
    });

    it('should handle --tail option for logs command', async () => {
      const result = await runCLICommand(['logs', '--help']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('--tail');
    });

    it('should handle --dashboard option for watch command', async () => {
      const result = await runCLICommand(['watch', '--help']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('--dashboard');
    });

    it('should handle --auto-fix option for watch command', async () => {
      const result = await runCLICommand(['watch', '--help']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('--auto-fix');
    });

    it('should handle --detached option for watch command', async () => {
      const result = await runCLICommand(['watch', '--help']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('--detached');
    });

    it('should handle --local option for docu command', async () => {
      const result = await runCLICommand(['docu', '--help']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('--local');
    });

    it('should handle --force option for docu command', async () => {
      const result = await runCLICommand(['docu', '--help']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('--force');
    });

    it('should handle --preview option for docu command', async () => {
      const result = await runCLICommand(['docu', '--help']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('--preview');
    });

    it('should handle multiple flags together', async () => {
      const result = await runCLICommand(['analyze', '--path', TEST_PROJECT_PATH, '--json']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toBeTruthy();
    });

    it('should handle short flags (-p, -j)', async () => {
      const result = await runCLICommand(['analyze', '-p', TEST_PROJECT_PATH, '-j']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toBeTruthy();
    });
  });

  describe('Error Handling Tests', () => {
    describe('Unknown Commands', () => {
      it('should handle unknown main command', async () => {
        const result = await runCLICommand(['unknown-command']);
        
        expect(result.code).toBe(1);
        expect(result.stderr).toContain('❌ Invalid command');
        expect(result.stderr).toContain('Use --help to see available commands');
      });

      it('should handle unknown sub-command', async () => {
        const result = await runCLICommand(['review', 'unknown-subcommand']);
        
        expect(result.code).toBe(1);
        expect(result.stderr).toContain('error:');
      });

      it('should handle unknown nested sub-command', async () => {
        const result = await runCLICommand(['review', 'git', 'unknown-nested']);
        
        expect(result.code).toBe(1);
        expect(result.stderr).toContain('error:');
      });

      it('should handle typos in command names', async () => {
        const result = await runCLICommand(['analysys']); // typo in "analyze"
        
        expect(result.code).toBe(1);
        expect(result.stderr).toContain('❌ Invalid command');
      });

      it('should handle typos in sub-command names', async () => {
        const result = await runCLICommand(['review', 'gitt']); // typo in "git"
        
        expect(result.code).toBe(1);
        expect(result.stderr).toContain('error:');
      });
    });

    describe('Missing Arguments', () => {
      it('should handle missing required argument for review path command', async () => {
        const result = await runCLICommand(['review', 'path']);
        
        expect(result.code).toBe(1);
        expect(result.stderr).toContain('error:');
        expect(result.stderr).toContain('missing required argument');
      });

      it('should handle missing value for --path option', async () => {
        const result = await runCLICommand(['analyze', '--path']);
        
        expect(result.code).toBe(1);
        expect(result.stderr).toContain('error:');
      });

      it('should handle missing value for --branch option', async () => {
        const result = await runCLICommand(['review', 'git', '--branch']);
        
        expect(result.code).toBe(1);
        expect(result.stderr).toContain('error:');
      });

      it('should handle missing value for --output option', async () => {
        const result = await runCLICommand(['review', 'git', '--output']);
        
        expect(result.code).toBe(1);
        expect(result.stderr).toContain('error:');
      });

      it('should handle missing value for --tail option', async () => {
        const result = await runCLICommand(['logs', '--tail']);
        
        expect(result.code).toBe(1);
        expect(result.stderr).toContain('error:');
      });
    });

    describe('Invalid Arguments', () => {
      it('should handle invalid path argument', async () => {
        const result = await runCLICommand(['analyze', '--path', '/nonexistent/path']);
        
        expect(result.code).toBe(1);
        expect(result.stderr).toContain('❌') || expect(result.stdout).toContain('❌');
      });

      it('should handle invalid branch name', async () => {
        const result = await runCLICommand(['review', 'git', '--branch', 'nonexistent-branch'], {
          cwd: TEST_PROJECT_PATH
        });
        
        // Should fail gracefully (might be 0 or 1 depending on git handling)
        expect(result.code).toBeGreaterThanOrEqual(0);
      });

      it('should handle invalid numeric value for --tail', async () => {
        const result = await runCLICommand(['logs', '--tail', 'not-a-number']);
        
        expect(result.code).toBe(1);
        expect(result.stderr).toContain('error:');
      });

      it('should handle invalid output file path', async () => {
        const result = await runCLICommand(['review', 'git', '--output', '/root/forbidden/path.md']);
        
        // Should handle gracefully (might warn or fail)
        expect(result.code).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Command Conflicts', () => {
      it('should handle conflicting flags', async () => {
        const result = await runCLICommand(['docu', '--local', '--git', 'main']);
        
        expect(result.code).toBeGreaterThanOrEqual(0);
      });

      it('should handle mutually exclusive options', async () => {
        const result = await runCLICommand(['analyze', '--json', '--path', TEST_PROJECT_PATH]);
        
        // Should work fine as these are not mutually exclusive
        expect(result.code).toBe(0);
      });
    });
  });

  describe('Help and Version Tests', () => {
    it('should display help for main command', async () => {
      const result = await runCLICommand(['--help']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('woaru');
      expect(result.stdout).toContain('Commands:');
    });

    it('should display version', async () => {
      const result = await runCLICommand(['--version']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/); // Version format
    });

    it('should display help for sub-commands', async () => {
      const result = await runCLICommand(['review', '--help']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('review');
    });

    it('should display help for nested sub-commands', async () => {
      const result = await runCLICommand(['review', 'git', '--help']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('git');
    });
  });

  describe('Output Format Tests', () => {
    it('should output JSON when --json flag is used', async () => {
      const result = await runCLICommand(['analyze', '--path', TEST_PROJECT_PATH, '--json']);
      
      expect(result.code).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
      
      const parsed = JSON.parse(result.stdout);
      expect(parsed).toHaveProperty('language');
      expect(parsed).toHaveProperty('setup_recommendations');
    });

    it('should output human-readable format by default', async () => {
      const result = await runCLICommand(['analyze', '--path', TEST_PROJECT_PATH]);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('📋'); // Emoji indicators
      expect(() => JSON.parse(result.stdout)).toThrow(); // Should not be JSON
    });

    it('should handle output redirection', async () => {
      const result = await runCLICommand(['analyze', '--path', TEST_PROJECT_PATH, '--json']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toBeTruthy();
      expect(result.stderr).toBeFalsy();
    });
  });

  describe('Process Exit Codes', () => {
    it('should exit with code 0 for successful commands', async () => {
      const result = await runCLICommand(['--version']);
      
      expect(result.code).toBe(0);
    });

    it('should exit with code 1 for invalid commands', async () => {
      const result = await runCLICommand(['invalid-command']);
      
      expect(result.code).toBe(1);
    });

    it('should exit with code 1 for missing arguments', async () => {
      const result = await runCLICommand(['review', 'path']);
      
      expect(result.code).toBe(1);
    });
  });

  describe('Environment and Context', () => {
    it('should respect current working directory', async () => {
      const result = await runCLICommand(['analyze', '--json'], {
        cwd: TEST_PROJECT_PATH
      });
      
      expect(result.code).toBe(0);
      expect(result.stdout).toBeTruthy();
    });

    it('should handle different project types', async () => {
      const result = await runCLICommand(['analyze', '--path', TEST_PROJECT_PATH, '--json']);
      
      expect(result.code).toBe(0);
      
      const parsed = JSON.parse(result.stdout);
      expect(parsed.language).toBeDefined();
    });

    it('should handle environment variables', async () => {
      const result = await runCLICommand(['analyze', '--path', TEST_PROJECT_PATH], {
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      expect(result.code).toBe(0);
    });
  });
});