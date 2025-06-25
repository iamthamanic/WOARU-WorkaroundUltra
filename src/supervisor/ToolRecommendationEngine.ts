import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ProjectState, ToolRecommendation, CodeEvidence } from './types';
import { CodeAnalyzer } from '../analyzer/CodeAnalyzer';

interface ToolDefinition {
  name: string;
  category: 'linter' | 'formatter' | 'test' | 'build' | 'git-hook';
  languages: string[];
  frameworks?: string[];
  detectPatterns: DetectionPattern[];
  setupInstructions: SetupInstruction[];
  alternatives?: string[];
  deprecated?: boolean;
  priority?: 'critical' | 'high' | 'medium' | 'low';
}

interface DetectionPattern {
  type: 'missing_config' | 'code_smell' | 'missing_dependency' | 'file_pattern';
  pattern: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  message?: string;
}

interface SetupInstruction {
  packageManager: string;
  command: string;
}

export class ToolRecommendationEngine extends EventEmitter {
  private toolDefinitions: Map<string, ToolDefinition> = new Map();
  private codeAnalyzer: CodeAnalyzer;
  private toolsPath: string;

  constructor() {
    super();
    this.codeAnalyzer = new CodeAnalyzer();
    this.toolsPath = path.join(__dirname, '../../tools');
  }

  async initialize(): Promise<void> {
    await this.loadToolDefinitions();
  }

  private async loadToolDefinitions(): Promise<void> {
    const toolFiles = await fs.readdir(this.toolsPath);
    
    for (const file of toolFiles) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        try {
          const content = await fs.readFile(path.join(this.toolsPath, file), 'utf-8');
          const definitions = yaml.load(content) as { tools: Record<string, ToolDefinition> };
          
          Object.entries(definitions.tools).forEach(([name, def]) => {
            this.toolDefinitions.set(name, { ...def, name });
          });
        } catch (error) {
          console.error(`Failed to load tool definitions from ${file}:`, error);
        }
      }
    }
  }

  async getRecommendations(state: ProjectState): Promise<ToolRecommendation[]> {
    const recommendations: ToolRecommendation[] = [];
    
    // Get language and framework specific tools
    const relevantTools = this.getRelevantTools(state.language, state.frameworks);
    
    // Check each tool
    for (const tool of relevantTools) {
      if (state.detectedTools.has(tool.name)) {
        continue; // Tool already installed
      }

      const recommendation = await this.evaluateTool(tool, state);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    // Sort by priority
    return this.prioritizeRecommendations(recommendations);
  }

  private getRelevantTools(language: string, frameworks: string[]): ToolDefinition[] {
    const relevant: ToolDefinition[] = [];
    
    this.toolDefinitions.forEach(tool => {
      // Check language match
      const langMatch = tool.languages.includes(language) || 
                       tool.languages.includes('*');
      
      // Check framework match
      const frameworkMatch = !tool.frameworks || 
                            tool.frameworks.some(f => frameworks.includes(f));
      
      if (langMatch && frameworkMatch && !tool.deprecated) {
        relevant.push(tool);
      }
    });

    return relevant;
  }

  private async evaluateTool(
    tool: ToolDefinition, 
    state: ProjectState
  ): Promise<ToolRecommendation | null> {
    const evidence: CodeEvidence[] = [];
    let highestPriority: 'critical' | 'high' | 'medium' | 'low' = 'low';
    let reason = '';

    // Check detection patterns
    for (const pattern of tool.detectPatterns) {
      const detected = await this.checkPattern(pattern, state);
      
      if (detected.found) {
        evidence.push(...detected.evidence);
        
        // Update priority
        const patternPriority = pattern.severity || 'medium';
        if (this.comparePriority(patternPriority, highestPriority) > 0) {
          highestPriority = patternPriority;
        }

        // Build reason
        if (pattern.message) {
          reason = pattern.message;
        } else {
          reason = this.buildReasonFromPattern(pattern, detected.evidence);
        }
      }
    }

    if (evidence.length === 0) {
      return null;
    }

    // Get setup command for current package manager
    const setupCommand = this.getSetupCommand(tool, state.projectPath);

    return {
      tool: tool.name,
      reason,
      priority: tool.priority || highestPriority,
      evidence,
      autoFixable: !!setupCommand,
      setupCommand,
      category: tool.category
    };
  }

  private async checkPattern(
    pattern: DetectionPattern,
    state: ProjectState
  ): Promise<{ found: boolean; evidence: CodeEvidence[] }> {
    const evidence: CodeEvidence[] = [];

    switch (pattern.type) {
      case 'missing_config':
        const configPath = path.join(state.projectPath, pattern.pattern);
        const exists = await fs.pathExists(configPath);
        if (!exists) {
          evidence.push({
            file: pattern.pattern,
            pattern: 'missing_config'
          });
        }
        break;

      case 'code_smell':
        // Use code analyzer to find patterns
        const insights = await this.codeAnalyzer.analyzeCodebase(
          state.projectPath, 
          state.language
        );
        
        // Check if this tool would help with found issues
        insights.forEach((insight, toolName) => {
          if (toolName === pattern.pattern || (insight.patterns && insight.patterns.includes(pattern.pattern))) {
            evidence.push(...insight.evidence.map(e => ({
              file: e.split(':')[0],
              line: parseInt(e.split(':')[1]) || undefined,
              snippet: e,
              pattern: pattern.pattern
            })));
          }
        });
        break;

      case 'missing_dependency':
        // Check if dependency is installed
        if (!state.detectedTools.has(pattern.pattern)) {
          evidence.push({
            file: 'package.json',
            pattern: `missing_dependency:${pattern.pattern}`
          });
        }
        break;

      case 'file_pattern':
        // Check for files matching pattern
        const files = await this.findFiles(state.projectPath, pattern.pattern);
        if (files.length > 0) {
          files.forEach(file => {
            evidence.push({
              file,
              pattern: pattern.pattern
            });
          });
        }
        break;
    }

    return { found: evidence.length > 0, evidence };
  }

  private buildReasonFromPattern(
    pattern: DetectionPattern,
    evidence: CodeEvidence[]
  ): string {
    switch (pattern.type) {
      case 'missing_config':
        return `Configuration file ${pattern.pattern} not found`;
      
      case 'code_smell':
        const count = evidence.length;
        return `Found ${count} ${pattern.pattern} patterns in your code`;
      
      case 'missing_dependency':
        return `Dependency ${pattern.pattern} is recommended but not installed`;
      
      case 'file_pattern':
        return `Found files matching ${pattern.pattern} that could benefit from this tool`;
      
      default:
        return `Detected pattern: ${pattern.pattern}`;
    }
  }

  private getSetupCommand(tool: ToolDefinition, projectPath: string): string | undefined {
    // Detect package manager
    const packageManager = this.detectPackageManager(projectPath);
    
    const instruction = tool.setupInstructions.find(
      inst => inst.packageManager === packageManager
    );

    return instruction?.command;
  }

  private detectPackageManager(projectPath: string): string {
    // Simple detection - could be enhanced
    if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(projectPath, 'package-lock.json'))) return 'npm';
    if (fs.existsSync(path.join(projectPath, 'requirements.txt'))) return 'pip';
    if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) return 'cargo';
    if (fs.existsSync(path.join(projectPath, 'go.mod'))) return 'go';
    return 'npm'; // default
  }

  private async findFiles(projectPath: string, pattern: string): Promise<string[]> {
    // Simplified file finding - would use glob in production
    const files: string[] = [];
    // Implementation would scan for files matching pattern
    return files;
  }

  private prioritizeRecommendations(
    recommendations: ToolRecommendation[]
  ): ToolRecommendation[] {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    
    return recommendations.sort((a, b) => {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private comparePriority(
    a: 'critical' | 'high' | 'medium' | 'low',
    b: 'critical' | 'high' | 'medium' | 'low'
  ): number {
    const priorityValue = { critical: 4, high: 3, medium: 2, low: 1 };
    return priorityValue[a] - priorityValue[b];
  }

  async checkSingleFile(
    filePath: string,
    state: ProjectState
  ): Promise<ToolRecommendation[]> {
    // Quick check for single file changes
    const recommendations: ToolRecommendation[] = [];
    
    // Check if this file triggers any tool recommendations
    const relevantTools = this.getRelevantTools(state.language, state.frameworks);
    
    for (const tool of relevantTools) {
      if (state.detectedTools.has(tool.name)) continue;
      
      // Quick pattern check for this file only
      for (const pattern of tool.detectPatterns) {
        if (pattern.type === 'code_smell') {
          // Analyze just this file
          const fileContent = await fs.readFile(filePath, 'utf-8');
          // Simple pattern matching - would be more sophisticated
          if (fileContent.includes(pattern.pattern)) {
            recommendations.push({
              tool: tool.name,
              reason: `Found ${pattern.pattern} in ${path.basename(filePath)}`,
              priority: pattern.severity || 'medium',
              evidence: [{
                file: filePath,
                pattern: pattern.pattern
              }],
              autoFixable: true,
              setupCommand: this.getSetupCommand(tool, state.projectPath),
              category: tool.category
            });
            break;
          }
        }
      }
    }

    return recommendations;
  }
}