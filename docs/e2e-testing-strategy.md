# E2E Testing Strategy with Playwright for WOARU CLI

## Overview

This document outlines our end-to-end testing strategy for the WOARU CLI tool using Playwright. Unlike traditional browser-based E2E testing, we need to test a command-line application, which requires a specialized approach.

## Implementation Strategy

### 1. Playwright + Node.js Child Process Approach

We'll use Playwright's ability to run Node.js scripts and capture their output, combined with child process execution for CLI commands.

### 2. Test Environment Setup

```typescript
// tests/e2e/setup.ts
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

export class WOARUTestEnvironment {
  private testDir: string;
  private cliPath: string;

  constructor() {
    this.cliPath = path.resolve(__dirname, '../../dist/cli.js');
    this.testDir = path.join(os.tmpdir(), `woaru-e2e-${Date.now()}`);
  }

  async setup(): Promise<void> {
    await fs.mkdir(this.testDir, { recursive: true });
    process.chdir(this.testDir);
  }

  async cleanup(): Promise<void> {
    await fs.rmdir(this.testDir, { recursive: true });
  }

  async runCommand(args: string[]): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [this.cliPath, ...args], {
        cwd: this.testDir,
        stdio: 'pipe',
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
          exitCode: code || 0,
        });
      });

      child.on('error', reject);

      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill();
        reject(new Error('Command timed out'));
      }, 30000);
    });
  }
}
```

### 3. Example E2E Test: AI Setup Workflow

```typescript
// tests/e2e/ai-setup.e2e.test.ts
import { test, expect } from '@playwright/test';
import { WOARUTestEnvironment } from './setup';
import { promises as fs } from 'fs';
import * as path from 'path';

test.describe('WOARU AI Setup Workflow', () => {
  let env: WOARUTestEnvironment;

  test.beforeEach(async () => {
    env = new WOARUTestEnvironment();
    await env.setup();
  });

  test.afterEach(async () => {
    await env.cleanup();
  });

  test('should display help for ai setup command', async () => {
    const result = await env.runCommand(['ai', 'setup', '--help']);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Set up AI providers for code review');
    expect(result.stdout).toContain('Options:');
    expect(result.stdout).toContain('--provider');
  });

  test('should fail gracefully when no API key is provided', async () => {
    const result = await env.runCommand(['ai', 'setup', '--provider', 'openai']);
    
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('API key is required');
    expect(result.stderr).toContain('Set OPENAI_API_KEY environment variable');
  });

  test('should create AI configuration file when valid setup is provided', async () => {
    // Set up environment variable for test
    process.env.OPENAI_API_KEY = 'sk-test-key-for-e2e-testing';
    
    const result = await env.runCommand([
      'ai', 'setup', 
      '--provider', 'openai',
      '--model', 'gpt-4',
      '--non-interactive'
    ]);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('AI configuration saved successfully');
    
    // Verify configuration file was created
    const configPath = path.join(process.cwd(), '.woaru', 'ai_config.json');
    const configExists = await fs.access(configPath).then(() => true).catch(() => false);
    expect(configExists).toBe(true);
    
    // Verify configuration content
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    expect(config.openai.enabled).toBe(true);
    expect(config.openai.model).toBe('gpt-4');
    
    // Clean up
    delete process.env.OPENAI_API_KEY;
  });

  test('should validate configuration after setup', async () => {
    // First, set up the configuration
    process.env.OPENAI_API_KEY = 'sk-test-key-for-validation';
    
    await env.runCommand([
      'ai', 'setup',
      '--provider', 'openai',
      '--non-interactive'
    ]);
    
    // Then test validation
    const result = await env.runCommand(['ai', 'status']);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('AI providers configured:');
    expect(result.stdout).toContain('✅ OpenAI');
    
    delete process.env.OPENAI_API_KEY;
  });

  test('should handle interactive setup flow', async () => {
    // This test would be more complex and might require input simulation
    // For now, we'll test the non-interactive flow
    test.skip(); // Skip until we implement input simulation
  });
});

test.describe('WOARU AI Review Integration', () => {
  let env: WOARUTestEnvironment;

  test.beforeEach(async () => {
    env = new WOARUTestEnvironment();
    await env.setup();
    
    // Create a sample project for testing
    await fs.writeFile(
      path.join(process.cwd(), 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          react: '^18.0.0'
        }
      }, null, 2)
    );
    
    await fs.writeFile(
      path.join(process.cwd(), 'src', 'App.js'),
      `
import React from 'react';

function App() {
  const [count, setCount] = React.useState(0);
  
  // This has potential issues for AI to catch
  const handleClick = () => {
    setCount(count + 1); // Should use callback form
  };
  
  return (
    <div>
      <button onClick={handleClick}>Count: {count}</button>
    </div>
  );
}

export default App;
      `.trim()
    );
  });

  test.afterEach(async () => {
    await env.cleanup();
  });

  test('should perform AI code review when configured', async () => {
    // Setup AI configuration first
    process.env.OPENAI_API_KEY = 'sk-test-key-for-review';
    
    await env.runCommand([
      'ai', 'setup',
      '--provider', 'openai',
      '--non-interactive'
    ]);
    
    // Perform AI review
    const result = await env.runCommand(['review', '--ai']);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('AI Code Review');
    expect(result.stdout).toContain('Analysis complete');
    
    delete process.env.OPENAI_API_KEY;
  });
});
```

### 4. Test Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000, // 60 seconds for CLI operations
  fullyParallel: false, // CLI tests should run sequentially to avoid conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid file system conflicts
  reporter: 'html',
  use: {
    // CLI tests don't need browser context
    headless: true,
  },
  projects: [
    {
      name: 'CLI Tests',
      testMatch: '**/*.e2e.test.ts',
    },
  ],
});
```

### 5. Package.json Scripts

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:ui": "playwright test --ui"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0"
  }
}
```

## Benefits of This Approach

1. **Real CLI Testing**: Tests the actual compiled CLI binary
2. **Isolated Environments**: Each test runs in a clean temporary directory
3. **Comprehensive Coverage**: Can test file system operations, environment variables, and CLI output
4. **CI/CD Integration**: Easy to integrate with GitHub Actions
5. **Detailed Reporting**: Playwright provides excellent test reports

## Test Scenarios to Cover

### Core Functionality
- [ ] Help command displays correctly
- [ ] Version command works
- [ ] Invalid commands show appropriate errors

### Project Analysis
- [ ] Analyze JavaScript/TypeScript projects
- [ ] Analyze Python projects
- [ ] Analyze multi-language projects
- [ ] Handle invalid project paths gracefully

### AI Integration
- [ ] AI setup workflow (interactive and non-interactive)
- [ ] AI configuration validation
- [ ] AI review functionality
- [ ] Error handling for missing API keys

### File Operations
- [ ] Configuration file creation and updates
- [ ] Temporary file cleanup
- [ ] Permission handling

### Error Scenarios
- [ ] Network timeouts
- [ ] Invalid file permissions
- [ ] Malformed configuration files
- [ ] Missing dependencies

## Implementation Timeline

1. **Phase 1**: Basic CLI testing infrastructure
2. **Phase 2**: Core command tests (analyze, setup)
3. **Phase 3**: AI workflow integration tests
4. **Phase 4**: Error scenario and edge case testing
5. **Phase 5**: Performance and stress testing

This E2E testing strategy will ensure WOARU is robust and reliable in real-world usage scenarios.