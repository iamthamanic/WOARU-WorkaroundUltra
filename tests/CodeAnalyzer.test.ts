import { CodeAnalyzer } from '../src/analyzer/CodeAnalyzer';
import * as fs from 'fs-extra';
import * as path from 'path';
import { tmpdir } from 'os';

describe('CodeAnalyzer', () => {
  let analyzer: CodeAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new CodeAnalyzer();
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'wau-code-test-'));
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('JavaScript/TypeScript analysis', () => {
    it('should detect console.log statements', async () => {
      const testFile = path.join(testDir, 'test.js');
      await fs.writeFile(testFile, `
        function doSomething() {
          console.log('debug message');
          return true;
        }
      `);

      const insights = await analyzer.analyzeCodebase(testDir, 'JavaScript');
      const eslintInsight = insights.get('eslint');

      expect(eslintInsight).toBeDefined();
      expect(eslintInsight?.reason).toContain('Debug-Statements');
      expect(eslintInsight?.evidence[0]).toContain('console.log');
    });

    it('should detect formatting inconsistencies', async () => {
      const testFile = path.join(testDir, 'test.js');
      await fs.writeFile(testFile, `
function badFormatting(){
\t  console.log('mixed indentation');   
  return true;
}
      `);

      const insights = await analyzer.analyzeCodebase(testDir, 'JavaScript');
      const prettierInsight = insights.get('prettier');

      expect(prettierInsight).toBeDefined();
      expect(prettierInsight?.reason).toContain('Code-Formatierung');
    });
  });

  describe('Python analysis', () => {
    it('should detect PEP8 violations', async () => {
      const testFile = path.join(testDir, 'test.py');
      await fs.writeFile(testFile, `
def long_function_name_that_violates_pep8_line_length_rules_and_should_be_detected():
\tprint("using tabs instead of spaces")
\treturn True
      `);

      const insights = await analyzer.analyzeCodebase(testDir, 'Python');
      const blackInsight = insights.get('black');

      expect(blackInsight).toBeDefined();
      expect(blackInsight?.reason).toContain('PEP8');
      expect(blackInsight?.evidence.some(e => e.includes('Zeile zu lang'))).toBe(true);
    });

    it('should detect print statements', async () => {
      const testFile = path.join(testDir, 'test.py');
      await fs.writeFile(testFile, `
def debug_function():
    print("Debug message")
    print(f"Value: {42}")
    return True
      `);

      const insights = await analyzer.analyzeCodebase(testDir, 'Python');
      const ruffInsight = insights.get('ruff');

      expect(ruffInsight).toBeDefined();
      expect(ruffInsight?.reason).toContain('Print-Statements');
      expect(ruffInsight?.evidence.length).toBeGreaterThan(0);
    });
  });

  describe('C# analysis', () => {
    it('should detect async void methods', async () => {
      const testFile = path.join(testDir, 'test.cs');
      await fs.writeFile(testFile, `
public class TestClass {
    public async void BadAsyncMethod() {
        await Task.Delay(100);
    }
    
    public void AnotherMethod() {
        var result = SomeAsyncMethod().Result;
    }
}
      `);

      const insights = await analyzer.analyzeCodebase(testDir, 'C#');
      const sonarInsight = insights.get('sonaranalyzer');

      expect(sonarInsight).toBeDefined();
      expect(sonarInsight?.reason).toContain('async/await');
      expect(sonarInsight?.evidence.some(e => e.includes('async void'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty directories', async () => {
      const insights = await analyzer.analyzeCodebase(testDir, 'JavaScript');
      expect(insights.size).toBe(0);
    });

    it('should handle unreadable files gracefully', async () => {
      const testFile = path.join(testDir, 'test.js');
      await fs.writeFile(testFile, 'console.log("test");');
      
      // This should not throw
      const insights = await analyzer.analyzeCodebase(testDir, 'JavaScript');
      expect(insights).toBeDefined();
    });
  });
});