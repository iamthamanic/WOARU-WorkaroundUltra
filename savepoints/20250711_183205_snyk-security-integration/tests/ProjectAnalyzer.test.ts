import { ProjectAnalyzer } from '../src/analyzer/ProjectAnalyzer';
import * as fs from 'fs-extra';
import * as path from 'path';
import { tmpdir } from 'os';

describe('ProjectAnalyzer', () => {
  let analyzer: ProjectAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ProjectAnalyzer();
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'wau-test-'));
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('JavaScript/TypeScript projects', () => {
    it('should detect Next.js project', async () => {
      // Create package.json
      await fs.writeJson(path.join(testDir, 'package.json'), {
        name: 'test-nextjs',
        dependencies: { next: '^14.0.0', react: '^18.0.0' }
      });

      // Create next.config.js
      await fs.writeFile(path.join(testDir, 'next.config.js'), 'module.exports = {}');

      const analysis = await analyzer.analyzeProject(testDir);

      expect(analysis.language).toBe('JavaScript');
      expect(analysis.framework).toContain('nextjs');
      expect(analysis.framework).toContain('react');
      expect(analysis.packageManager).toBe('npm');
    });

    it('should detect TypeScript project', async () => {
      await fs.writeJson(path.join(testDir, 'package.json'), {
        name: 'test-ts',
        devDependencies: { typescript: '^5.0.0' }
      });

      await fs.writeJson(path.join(testDir, 'tsconfig.json'), {
        compilerOptions: { target: 'es5' }
      });

      const analysis = await analyzer.analyzeProject(testDir);

      expect(analysis.language).toBe('TypeScript');
    });
  });

  describe('Python projects', () => {
    it('should detect Python project with requirements.txt', async () => {
      await fs.writeFile(path.join(testDir, 'requirements.txt'), 'django>=4.0.0\nrequests>=2.28.0');
      await fs.writeFile(path.join(testDir, 'main.py'), 'print("hello world")');

      const analysis = await analyzer.analyzeProject(testDir);

      expect(analysis.language).toBe('Python');
      expect(analysis.dependencies).toContain('django');
      expect(analysis.dependencies).toContain('requests');
      expect(analysis.packageManager).toBe('pip');
    });

    it('should detect Django framework', async () => {
      await fs.writeFile(path.join(testDir, 'requirements.txt'), 'django>=4.0.0');
      await fs.writeFile(path.join(testDir, 'manage.py'), '#!/usr/bin/env python');

      const analysis = await analyzer.analyzeProject(testDir);

      expect(analysis.framework).toContain('django');
    });
  });

  describe('C# projects', () => {
    it('should detect C# project', async () => {
      await fs.writeFile(path.join(testDir, 'project.csproj'), `
        <Project Sdk="Microsoft.NET.Sdk">
          <PropertyGroup>
            <TargetFramework>net6.0</TargetFramework>
          </PropertyGroup>
          <ItemGroup>
            <PackageReference Include="Microsoft.AspNetCore" Version="6.0.0" />
          </ItemGroup>
        </Project>
      `);

      const analysis = await analyzer.analyzeProject(testDir);

      expect(analysis.language).toBe('C#');
      expect(analysis.dependencies).toContain('Microsoft.AspNetCore');
      expect(analysis.packageManager).toBe('dotnet');
    });
  });

  describe('Go projects', () => {
    it('should detect Go project', async () => {
      await fs.writeFile(path.join(testDir, 'go.mod'), `
        module example.com/myapp
        
        go 1.21
        
        require github.com/gin-gonic/gin v1.9.1
      `);
      await fs.writeFile(path.join(testDir, 'main.go'), 'package main\n\nfunc main() {}');

      const analysis = await analyzer.analyzeProject(testDir);

      expect(analysis.language).toBe('Go');
      expect(analysis.packageManager).toBe('go');
    });
  });

  describe('Rust projects', () => {
    it('should detect Rust project', async () => {
      await fs.writeFile(path.join(testDir, 'Cargo.toml'), `
        [package]
        name = "myapp"
        version = "0.1.0"
        
        [dependencies]
        tokio = "1.0"
        actix-web = "4.0"
      `);
      await fs.writeFile(path.join(testDir, 'main.rs'), 'fn main() {}');

      const analysis = await analyzer.analyzeProject(testDir);

      expect(analysis.language).toBe('Rust');
      expect(analysis.packageManager).toBe('cargo');
    });
  });

  describe('error handling', () => {
    it('should throw error for unrecognized project', async () => {
      await fs.writeFile(path.join(testDir, 'random.txt'), 'not a project');

      await expect(analyzer.analyzeProject(testDir)).rejects.toThrow('Could not detect project language');
    });
  });
});