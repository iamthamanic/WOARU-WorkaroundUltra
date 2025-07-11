export interface ProjectState {
  projectPath: string;
  language: string;
  frameworks: string[];
  detectedTools: Set<string>;
  missingTools: Set<string>;
  codeIssues: Map<string, CodeIssue[]>;
  lastAnalysis: Date;
  healthScore: number;
  fileCount: number;
  watchedFiles: Set<string>;
}

export interface CodeIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line?: number;
  message: string;
  tool?: string;
  autoFixable: boolean;
}

export interface ToolRecommendation {
  tool: string;
  reason: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  evidence: CodeEvidence[];
  autoFixable: boolean;
  setupCommand?: string;
  category: 'linter' | 'formatter' | 'test' | 'build' | 'git-hook';
}

export interface CodeEvidence {
  file: string;
  line?: number;
  snippet?: string;
  pattern: string;
}

export interface SupervisorConfig {
  autoFix: boolean;
  autoSetup: boolean;
  notifications: {
    terminal: boolean;
    desktop: boolean;
    webhook?: string;
  };
  ignoreTools: string[];
  watchPatterns: string[];
  ignorePatterns: string[];
  dashboard: boolean;
}

export interface FileChange {
  type: 'add' | 'change' | 'unlink';
  path: string;
  timestamp: Date;
}

export interface WatcherEvent {
  type: 'file_changed' | 'tool_detected' | 'issue_found' | 'recommendation';
  data: unknown;
  timestamp: Date;
}
