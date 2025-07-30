import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import {
  AIReviewConfig,
  CodeContext,
  MultiLLMReviewResult,
  PromptTemplate as AIPromptTemplate,
} from '../types/ai-review';
import { AIReviewAgent } from './AIReviewAgent';
import { APP_CONFIG } from '../config/constants';

export interface DocumentationResult {
  filePath: string;
  originalContent: string;
  generatedDoc: string;
  insertionPoint: number;
  functionName: string;
  documentationType: 'nopro' | 'pro' | 'forai';
}

export interface CodeFunction {
  name: string;
  startLine: number;
  endLine: number;
  content: string;
  hasExistingDoc: boolean;
  existingDocType?: 'nopro' | 'pro' | 'forai';
}

/**
 * DocumentationAgent - Generates and applies AI-powered code documentation
 *
 * Features:
 * - Analyzes code to identify functions, classes, and methods
 * - Generates human-friendly or technical documentation
 * - Safely inserts documentation without breaking existing code
 * - Handles existing documentation detection and updates
 */
interface PromptTemplate {
  name: string;
  description: string;
  system_prompt: string;
  user_prompt: string;
  parameters?: Record<string, unknown>;
}

export class DocumentationAgent {
  private aiReviewAgent: AIReviewAgent;
  private promptTemplates: Record<string, PromptTemplate>;

  constructor(
    aiConfig: AIReviewConfig,
    promptTemplates: Record<string, AIPromptTemplate>
  ) {
    this.aiReviewAgent = new AIReviewAgent(aiConfig, promptTemplates);
    this.promptTemplates = promptTemplates as unknown as Record<
      string,
      PromptTemplate
    >;
  }

  /**
   * Generate documentation for a list of files using AI analysis
   *
   * @param fileList - Array of file paths to process for documentation
   * @param projectPath - Root path of the project for context
   * @param documentationType - Type of documentation to generate ('nopro' for human-friendly, 'pro' for technical, 'forai' for machine-readable)
   * @returns Promise resolving to array of documentation results with file modifications
   */
  async generateDocumentation(
    fileList: string[],
    projectPath: string,
    documentationType: 'nopro' | 'pro' | 'forai'
  ): Promise<DocumentationResult[]> {
    const results: DocumentationResult[] = [];

    console.log(
      chalk.cyan(`🔍 Analyzing ${fileList.length} files for documentation...`)
    );

    for (const filePath of fileList) {
      try {
        const fileResults = await this.processFile(
          filePath,
          projectPath,
          documentationType
        );
        results.push(...fileResults);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.warn(
          chalk.yellow(`⚠️ Could not process ${filePath}: ${errorMessage}`)
        );
        // Continue processing other files instead of failing completely
      }
    }

    return results;
  }

  /**
   * Process a single file for documentation generation
   *
   * @param filePath - Path to the file to process
   * @param projectPath - Root project path for context
   * @param documentationType - Type of documentation to generate
   * @returns Promise resolving to array of documentation results for this file
   */
  private async processFile(
    filePath: string,
    projectPath: string,
    documentationType: 'nopro' | 'pro' | 'forai'
  ): Promise<DocumentationResult[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const language = this.detectLanguage(filePath);

    // Skip non-code files
    if (!this.isCodeFile(language)) {
      return [];
    }

    // For ForAI documentation, we generate file-level context headers
    if (documentationType === 'forai') {
      return await this.processFileForAIContext(
        filePath,
        projectPath,
        content,
        language
      );
    }

    // Extract functions/classes that need documentation
    const codeElements = this.extractCodeElements(content, language);
    const results: DocumentationResult[] = [];

    for (const element of codeElements) {
      // Skip if already has documentation of the same type
      if (
        element.hasExistingDoc &&
        element.existingDocType === documentationType
      ) {
        console.log(
          chalk.gray(
            `   ⏭️  Skipping ${element.name} (already has ${documentationType} documentation)`
          )
        );
        continue;
      }

      try {
        // Generate documentation using AI
        const generatedDoc = await this.generateDocumentationForElement(
          element,
          filePath,
          projectPath,
          language,
          documentationType
        );

        if (generatedDoc) {
          results.push({
            filePath,
            originalContent: content,
            generatedDoc,
            insertionPoint: element.startLine,
            functionName: element.name,
            documentationType,
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.warn(
          chalk.yellow(
            `⚠️ Could not generate documentation for ${element.name}: ${errorMessage}`
          )
        );
        // Log additional context for debugging
        console.debug(
          `Debug info: File=${filePath}, Element=${element.name}, Type=${documentationType}`
        );
      }
    }

    return results;
  }

  /**
   * Process a file for AI context header generation (file-level documentation)
   *
   * @param filePath - Path to the file to process
   * @param projectPath - Root project path for context
   * @param content - File content to analyze
   * @param language - Programming language of the file
   * @returns Promise resolving to array with single documentation result for file header
   */
  private async processFileForAIContext(
    filePath: string,
    projectPath: string,
    content: string,
    language: string
  ): Promise<DocumentationResult[]> {
    try {
      // Check if file already has woaru_context header
      const lines = content.split('\n');
      const hasExistingAIDoc = this.checkExistingAIDocumentation(lines);

      if (hasExistingAIDoc) {
        console.log(
          chalk.gray(
            `   ⏭️  Skipping ${path.basename(filePath)} (already has ${APP_CONFIG.DOCUMENTATION.CONTEXT_HEADER_KEY} header)`
          )
        );
        return [];
      }

      // Prepare context for AI analysis
      const context: CodeContext = {
        filePath,
        language,
        totalLines: lines.length,
        projectContext: {
          name: path.basename(projectPath),
          type: 'application',
          dependencies: [],
        },
      };

      // Use AI to generate file-level context documentation
      const result = await this.aiReviewAgent.performMultiLLMReview(
        content,
        context
      );

      // Extract the best documentation from results
      const aiContextHeader = this.extractBestDocumentation(result, 'forai');

      if (aiContextHeader) {
        console.log(
          chalk.gray(
            `   ✓ Generated AI context header for ${path.basename(filePath)}`
          )
        );

        // Format as comment block for the specific language
        const formattedHeader = this.formatAIContextHeader(
          aiContextHeader,
          language
        );

        return [
          {
            filePath,
            originalContent: content,
            generatedDoc: formattedHeader,
            insertionPoint: 1, // Insert at beginning of file
            functionName: 'FILE_HEADER',
            documentationType: 'forai',
          },
        ];
      } else {
        console.warn(
          chalk.yellow(
            `⚠️ No AI context generated for ${path.basename(filePath)}`
          )
        );
        return [];
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        chalk.yellow(
          `⚠️ Could not generate AI context for ${path.basename(filePath)}: ${errorMessage}`
        )
      );
      return [];
    }
  }

  /**
   * Check if file already has woaru_context header at the beginning
   *
   * @param lines - Array of file lines to check
   * @returns True if woaru_context header exists, false otherwise
   */
  private checkExistingAIDocumentation(lines: string[]): boolean {
    // Check first N lines for woaru_context header
    // Why: Headers are typically at the very beginning of files
    const checkLines = APP_CONFIG.DOCUMENTATION.CONTEXT_HEADER_CHECK_LINES;
    for (let i = 0; i < Math.min(checkLines, lines.length); i++) {
      if (
        lines[i].includes(`${APP_CONFIG.DOCUMENTATION.CONTEXT_HEADER_KEY}:`)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Format AI context header as appropriate comment block for the language
   *
   * @param aiContext - Raw AI-generated YAML context content
   * @param language - Programming language for comment syntax selection
   * @returns Formatted comment block with YAML content
   */
  private formatAIContextHeader(aiContext: string, language: string): string {
    // Clean up the AI response to ensure it's valid YAML
    let cleanContext = aiContext.trim();

    // If AI didn't include the woaru_context: wrapper, add it
    // Why: Some LLMs may return just the content without the root key
    const contextKey = APP_CONFIG.DOCUMENTATION.CONTEXT_HEADER_KEY;
    if (!cleanContext.includes(`${contextKey}:`)) {
      cleanContext = `${contextKey}:\n${cleanContext
        .split('\n')
        .map(line => `  ${line}`)
        .join('\n')}`;
    }

    // Add timestamp
    const timestamp = new Date().toISOString();
    // Only replace if generated_at exists, otherwise add it
    if (cleanContext.includes('generated_at:')) {
      cleanContext = cleanContext.replace(
        /generated_at: .*/,
        `generated_at: "${timestamp}"`
      );
    } else {
      // Add generated_at if missing
      const schemaVersion = APP_CONFIG.DOCUMENTATION.SCHEMA_VERSION;
      cleanContext = cleanContext.replace(
        new RegExp(`schema_version: "${schemaVersion}"`),
        `schema_version: "${schemaVersion}"\n  generated_at: "${timestamp}"`
      );
    }

    // Format as comment block based on language
    switch (language) {
      case 'javascript':
      case 'typescript':
      case 'java':
      case 'c':
      case 'cpp':
      case 'csharp':
        return `/*\n${cleanContext}\n*/\n\n`;

      case 'python':
      case 'ruby':
        return `"""\n${cleanContext}\n"""\n\n`;

      case 'go':
      case 'rust':
        return `/*\n${cleanContext}\n*/\n\n`;

      default:
        return `/*\n${cleanContext}\n*/\n\n`;
    }
  }

  /**
   * Generate documentation for a specific code element using AI
   *
   * @param element - Code element (function/class) to document
   * @param filePath - Path to the file containing the element
   * @param projectPath - Root project path for context
   * @param language - Programming language of the file
   * @param documentationType - Type of documentation to generate
   * @returns Promise resolving to generated documentation string or null if failed
   */
  private async generateDocumentationForElement(
    element: CodeFunction,
    filePath: string,
    projectPath: string,
    language: string,
    documentationType: 'nopro' | 'pro' | 'forai'
  ): Promise<string | null> {
    try {
      // Prepare context for AI analysis
      const context: CodeContext = {
        filePath,
        language,
        totalLines: element.content.split('\n').length,
        projectContext: {
          name: path.basename(projectPath),
          type: 'application',
          dependencies: [],
        },
      };

      // Use AI to generate documentation
      const result = await this.aiReviewAgent.performMultiLLMReview(
        element.content,
        context
      );

      // Extract the best documentation from results
      const bestDoc = this.extractBestDocumentation(result, documentationType);

      if (bestDoc) {
        console.log(
          chalk.gray(
            `   ✓ Generated ${documentationType} documentation for ${element.name}`
          )
        );
        return bestDoc;
      } else {
        console.warn(
          chalk.yellow(
            `⚠️ No usable documentation generated for ${element.name}`
          )
        );
        return null;
      }
    } catch (error) {
      console.error(
        chalk.red(
          `❌ AI generation failed for ${element.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      return null;
    }
  }

  /**
   * Extract the best documentation from AI results
   *
   * @param aiResult - Results from AI analysis containing provider responses
   * @param documentationType - Type of documentation requested
   * @returns Best documentation string from available results or null if none found
   */
  private extractBestDocumentation(
    aiResult: MultiLLMReviewResult,
_documentationType: 'nopro' | 'pro' | 'forai'
  ): string | null {
    // Find the first successful result
    const providers = Object.keys(aiResult.results);

    for (const provider of providers) {
      const providerResults = aiResult.results[provider];
      if (providerResults && providerResults.length > 0) {
        const firstResult = providerResults[0];
        // AIReviewFinding has 'suggestion' property containing the generated documentation
        if (firstResult.suggestion) {
          return firstResult.suggestion.trim();
        }
      }
    }

    return null;
  }

  /**
   * Apply documentation changes to files
   */
  async applyDocumentation(results: DocumentationResult[]): Promise<void> {
    const fileGroups = this.groupResultsByFile(results);

    for (const [filePath, fileResults] of fileGroups) {
      try {
        await this.applyDocumentationToFile(filePath, fileResults);
        console.log(
          chalk.green(
            `   ✓ Applied documentation to ${path.basename(filePath)}`
          )
        );
      } catch (error) {
        console.error(
          chalk.red(
            `   ❌ Failed to apply documentation to ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
      }
    }
  }

  /**
   * Apply documentation to a single file
   */
  private async applyDocumentationToFile(
    filePath: string,
    results: DocumentationResult[]
  ): Promise<void> {
    const originalContent = await fs.readFile(filePath, 'utf-8');
    const lines = originalContent.split('\n');

    // Sort results by insertion point (reverse order to maintain line numbers)
    // Why reverse order: When inserting multiple docs, later insertions don't affect earlier line numbers
    const sortedResults = results.sort(
      (a, b) => b.insertionPoint - a.insertionPoint
    );

    // Apply each documentation insertion
    for (const result of sortedResults) {
      const insertionLine = result.insertionPoint - 1; // Convert to 0-based index

      // Add the documentation comment
      const docLines = result.generatedDoc.split('\n');
      lines.splice(insertionLine, 0, ...docLines);
    }

    // Write the modified content back to the file
    await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
  }

  /**
   * Group results by file path
   */
  private groupResultsByFile(
    results: DocumentationResult[]
  ): Map<string, DocumentationResult[]> {
    const groups = new Map<string, DocumentationResult[]>();

    for (const result of results) {
      if (!groups.has(result.filePath)) {
        groups.set(result.filePath, []);
      }
      const group = groups.get(result.filePath);
      if (group) {
        group.push(result);
      }
    }

    return groups;
  }

  /**
   * Extract code elements (functions, classes, methods) from source code
   *
   * Uses regex patterns to identify code constructs that should be documented.
   * Why regex instead of AST parsing: Balance between complexity and reliability across languages.
   *
   * @param content - Source code content to analyze
   * @param language - Programming language for pattern selection
   * @returns Array of detected code elements with metadata
   */
  private extractCodeElements(
    content: string,
    language: string
  ): CodeFunction[] {
    const elements: CodeFunction[] = [];
    const lines = content.split('\n');

    // Simple regex patterns for function/class detection
    const patterns = this.getPatterns(language);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const pattern of patterns) {
        const match = line.match(pattern.regex);
        if (match) {
          const functionName = match[pattern.nameGroup] || 'anonymous';

          // Check if already has documentation
          const hasExistingDoc = this.checkExistingDocumentation(lines, i);

          elements.push({
            name: functionName,
            startLine: i + 1,
            endLine: i + 1, // Simplified - just the declaration line
            content: line,
            hasExistingDoc: hasExistingDoc.hasDoc,
            existingDocType: hasExistingDoc.type,
          });
        }
      }
    }

    return elements;
  }

  /**
   * Get regex patterns for different languages
   */
  private getPatterns(
    language: string
  ): Array<{ regex: RegExp; nameGroup: number }> {
    const patterns = [];

    switch (language) {
      case 'javascript':
      case 'typescript':
        patterns.push(
          { regex: /^(export\s+)?(async\s+)?function\s+(\w+)/, nameGroup: 3 },
          {
            regex: /^(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(/,
            nameGroup: 3,
          },
          { regex: /^(export\s+)?(class\s+)(\w+)/, nameGroup: 3 },
          { regex: /^\s*(async\s+)?(\w+)\s*\([^)]*\)\s*\{/, nameGroup: 2 }
        );
        break;

      case 'python':
        patterns.push(
          { regex: /^(async\s+)?def\s+(\w+)/, nameGroup: 2 },
          { regex: /^class\s+(\w+)/, nameGroup: 1 }
        );
        break;

      case 'java':
        patterns.push(
          {
            regex:
              /^(public|private|protected)?\s*(static\s+)?(void|[\w<>]+)\s+(\w+)\s*\(/,
            nameGroup: 4,
          },
          {
            regex: /^(public|private|protected)?\s*(class|interface)\s+(\w+)/,
            nameGroup: 3,
          }
        );
        break;

      default:
        // Generic patterns
        patterns.push(
          { regex: /function\s+(\w+)/, nameGroup: 1 },
          { regex: /class\s+(\w+)/, nameGroup: 1 }
        );
    }

    return patterns;
  }

  /**
   * Check if a function already has documentation
   */
  private checkExistingDocumentation(
    lines: string[],
    functionLineIndex: number
  ): { hasDoc: boolean; type?: 'nopro' | 'pro' | 'forai' } {
    // Look backwards from the function line to find documentation
    for (let i = functionLineIndex - 1; i >= 0; i--) {
      const line = lines[i].trim();

      // Stop if we hit another function or non-comment line
      if (
        line &&
        !line.startsWith('//') &&
        !line.startsWith('/*') &&
        !line.startsWith('*')
      ) {
        break;
      }

      // Check for human-friendly documentation
      if (line.includes('Explain-for-humans:')) {
        return { hasDoc: true, type: 'nopro' };
      }

      // Check for technical documentation (JSDoc/TSDoc)
      if (
        line.includes('@param') ||
        line.includes('@returns') ||
        line.includes('/**')
      ) {
        return { hasDoc: true, type: 'pro' };
      }

      // Check for ForAI-optimized documentation (woaru_context header)
      if (line.includes(`${APP_CONFIG.DOCUMENTATION.CONTEXT_HEADER_KEY}:`)) {
        return { hasDoc: true, type: 'forai' };
      }
    }

    return { hasDoc: false };
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
    };

    return languageMap[ext] || 'unknown';
  }

  /**
   * Check if file is a code file that should be documented
   */
  private isCodeFile(language: string): boolean {
    const supportedLanguages = [
      'javascript',
      'typescript',
      'python',
      'java',
      'cpp',
      'c',
      'csharp',
      'go',
      'rust',
      'php',
      'ruby',
    ];

    return supportedLanguages.includes(language);
  }
}
