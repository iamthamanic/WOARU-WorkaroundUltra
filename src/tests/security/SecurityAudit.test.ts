/**
 * Security Audit Tests
 * Tests for code injection vulnerabilities and security fixes
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { TemplateEngine } from '../../init/TemplateEngine';

describe('Security Audit Tests', () => {
  describe('Code Injection Prevention', () => {
    test('should detect and prevent eval() usage in codebase', async () => {
      const srcPath = path.join(__dirname, '../../');
      const files = await getAllTsFiles(srcPath);
      
      for (const file of files) {
        const content = await fs.readFile(file, 'utf8');
        
        // Skip test files as they may contain eval() for testing purposes
        if (file.includes('test') || file.includes('spec')) {
          continue;
        }
        
        // Check that eval() is not used unsafely
        const evalMatches = content.match(/\beval\s*\(/g);
        if (evalMatches) {
          // Allow only documented safe usage patterns
          const hasSecurityComment = content.includes('// Security:') || 
                                   content.includes('// Secure evaluation') ||
                                   content.includes('containsUnsafeExpressions');
          
          expect(hasSecurityComment).toBe(true);
        }
      }
    });

    test('should prevent execSync usage without security measures', async () => {
      const srcPath = path.join(__dirname, '../../');
      const files = await getAllTsFiles(srcPath);
      
      for (const file of files) {
        const content = await fs.readFile(file, 'utf8');
        
        // Skip test files
        if (file.includes('test') || file.includes('spec')) {
          continue;
        }
        
        // Check for execSync usage
        const execSyncMatches = content.match(/\bexecSync\s*\(/g);
        if (execSyncMatches) {
          // Should have security comment or be replaced with spawn
          const hasSecurityMeasures = content.includes('spawn') ||
                                     content.includes('// Security:') ||
                                     content.includes('secureCommandExecution');
          
          expect(hasSecurityMeasures).toBe(true);
        }
      }
    });
  });

  describe('TemplateEngine Security', () => {
    test('should block unsafe expressions', () => {
      const engine = new TemplateEngine();
      
      // Test that unsafe expressions are blocked
      const unsafeExpressions = [
        'eval("malicious")',
        'Function("return process")()',
        'require("fs")',
        'process.exit()',
        'global.something',
        'window.location',
        'document.cookie',
        '__dirname',
        '__filename',
        'obj.constructor',
        'obj["constructor"]'
      ];

      unsafeExpressions.forEach(expr => {
        const result = (engine as any).containsUnsafeExpressions(expr);
        expect(result).toBe(true);
      });
    });

    test('should allow safe expressions', () => {
      const engine = new TemplateEngine();
      
      const safeExpressions = [
        'true',
        'false',
        '1 + 1',
        'name === "test"',
        'version.startsWith("1.")',
        'arr.length > 0',
        'obj.prop === "value"'
      ];

      safeExpressions.forEach(expr => {
        const result = (engine as any).containsUnsafeExpressions(expr);
        expect(result).toBe(false);
      });
    });
  });
});

/**
 * Helper function to get all TypeScript files recursively
 */
async function getAllTsFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  async function traverse(currentDir: string) {
    const items = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item.name);
      
      if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
        await traverse(fullPath);
      } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  }
  
  await traverse(dir);
  return files;
}