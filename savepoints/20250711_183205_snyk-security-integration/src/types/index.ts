export interface ToolConfig {
  description: string;
  packages: string[];
  configs?: Record<string, string[]>;
  configFiles?: string[];
  metadata?: {
    popularity: number;
    lastChecked: string;
    npmDownloads?: number;
    githubStars?: number;
    alternatives?: string[];
    deprecated?: boolean;
    successor?: string;
  };
  [key: string]: any;
}

export interface CategoryTools {
  [toolName: string]: ToolConfig;
}

export interface FrameworkConfig {
  name: string;
  detectionFiles?: string[];
  detectionPackages?: string[];
  recommendedTools: Record<string, string[]>;
  specificPackages?: string[];
}

export interface ToolsDatabase {
  version: string;
  lastUpdated: string;
  categories: Record<string, CategoryTools>;
  frameworks: Record<string, FrameworkConfig>;
}

export interface ProjectAnalysis {
  language: string;
  framework: string[];
  packageManager:
    | 'npm'
    | 'yarn'
    | 'pnpm'
    | 'pip'
    | 'poetry'
    | 'cargo'
    | 'maven'
    | 'gradle'
    | 'dotnet'
    | 'go'
    | 'composer'
    | 'gem';
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  configFiles: string[];
  structure: string[];
  detectedLanguages?: string[];
  projectPath?: string;
}

export interface SetupRecommendation {
  tool: string;
  category: string;
  reason: string;
  packages: string[];
  configFiles: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface RefactorSuggestion {
  filename: string;
  suggestion: string;
  type: 'performance' | 'maintainability' | 'security' | 'best-practice';
}

export interface AnalysisResult {
  setup_recommendations: string[];
  tool_suggestions: string[];
  framework_specific_tools: string[];
  refactor_suggestions: RefactorSuggestion[];
  installed_tools_detected: string[];
  claude_automations?: string[];
  code_insights?: Array<{
    tool: string;
    reason: string;
    evidence: string[];
    severity: string;
  }>;
  production_audits?: Array<{
    category: string;
    check: string;
    priority: string;
    message: string;
    recommendation: string;
    packages?: string[];
    files?: string[];
  }>;
  security_summary?: {
    total_issues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    health_score: number;
  };
}

export interface SetupOptions {
  dryRun?: boolean;
  force?: boolean;
  skipBackup?: boolean;
  interactive?: boolean;
}

export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
}
