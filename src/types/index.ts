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
  [key: string]: unknown;
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
  evidence?: string;
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
    recommendations?: string[];
  };
  detailed_security?: {
    dependency_vulnerabilities?: SecurityVulnerability[];
    infrastructure_security?: InfrastructureSecurityResult;
    configuration_audits?: ConfigurationAudit[];
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

export interface SecurityVulnerability {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  packageName: string;
  vulnerableVersions: string;
  patchedVersions?: string;
  recommendation: string;
}

export interface InfrastructureSecurityResult {
  tool: string;
  scanTime: Date;
  findings: InfrastructureFinding[];
  summary: SecuritySummary;
  targets_scanned: number;
}

export interface InfrastructureFinding {
  tool: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  file: string;
  recommendation: string;
  references: string[];
}

export interface ConfigurationAudit {
  category: string;
  check: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  recommendation: string;
  packages?: string[];
  files?: string[];
}

export interface DependencyVulnerability {
  id: string;
  title: string;
  severity: string;
  description: string;
  file?: string;
  line?: number;
  recommendation: string;
  cve?: string;
  packageName: string;
  vulnerableVersions: string;
  package?: string;
  version?: string;
  fixedIn?: string;
}

export interface ConfigSummary {
  languages: Record<string, unknown>;
  frameworks: Record<string, unknown>;
  packageManager: string;
  buildTools: Record<string, unknown>;
  linting: Record<string, unknown>;
  testing: Record<string, unknown>;
  infrastructure: Record<string, unknown>;
}

export interface SecuritySummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info?: number;
}

export interface SecurityCombinedFindings {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  secrets: number;
  vulnerabilities: number;
}

export interface TrivyResult {
  Results: TrivyResultItem[];
}

export interface TrivyResultItem {
  Misconfigurations?: TrivyMisconfiguration[];
}

export interface TrivyMisconfiguration {
  Severity?: string;
  Title: string;
  Description: string;
  Resolution: string;
  References: string[];
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface CliOptions {
  verbose?: boolean;
  quiet?: boolean;
  format?: 'json' | 'table' | 'plain';
  output?: string;
  filter?: string[];
  exclude?: string[];
  maxResults?: number;
  force?: boolean;
  skipValidation?: boolean;
}

export interface SecurityFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  recommendation: string;
}

export interface UsageStatistics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime?: Date;
}

export interface CodeInsight {
  tool: string;
  reason: string;
  evidence: string[];
  severity: string;
}

// Forward reference - actual type is imported from ai-review.ts
export interface AIAnalysisResult {
  results: Array<{
    llmId: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    message: string;
    [key: string]: unknown;
  }>;
}

export interface AIAnalysisResults {
  results: AIAnalysisResult[];
}

export interface InquirerAnswers {
  model?: string;
  [key: string]: unknown;
}

export interface SnykVulnerability {
  severity: string;
  title: string;
  packageName: string;
  version: string;
  id: string;
  type?: string;
  [key: string]: unknown;
}

export interface SnykResult {
  tool: string;
  totalVulnerabilities: number;
  findings: SecurityFinding[];
  summary: SecuritySummary;
}

export interface GitleaksResult {
  runs: Array<{
    results: Array<{
      ruleId: string;
      level: string;
      message: { text: string };
      locations: Array<{
        physicalLocation: {
          artifactLocation: { uri: string };
          region: { startLine: number; startColumn: number };
        };
      }>;
      [key: string]: unknown;
    }>;
  }>;
}
