export interface LLMProviderConfig {
  id: string; // "openai-gpt4", "anthropic-claude", "google-gemini"
  providerType: 'openai' | 'anthropic' | 'google' | 'custom-ollama' | 'azure-openai';
  apiKeyEnvVar: string; // "OPENAI_API_KEY", "ANTHROPIC_API_KEY"
  baseUrl: string; // API endpoint URL
  model: string; // "gpt-4o", "claude-3-opus", "gemini-1.5-pro"
  headers?: Record<string, string>; // Additional HTTP headers
  bodyTemplate: string; // JSON template with {prompt} and {code} placeholders
  timeout?: number; // Request timeout in milliseconds
  maxTokens?: number; // Max tokens for response
  temperature?: number; // Creativity/randomness (0-1)
  enabled: boolean; // Whether this provider is active
}

export interface AIReviewConfig {
  providers: LLMProviderConfig[];
  parallelRequests: boolean; // Run LLM requests in parallel
  consensusMode: boolean; // Only report issues found by multiple LLMs
  minConsensusCount: number; // Minimum LLMs that need to agree
  tokenLimit: number; // Max tokens per code analysis request
  costThreshold: number; // Max estimated cost per analysis (USD)
}

export interface CodeContext {
  filePath: string;
  language: string;
  framework?: string;
  totalLines: number;
  changedLines?: number[];
  gitDiff?: string;
  projectContext?: {
    name: string;
    type: 'library' | 'application' | 'service';
    dependencies: string[];
  };
}

export interface AIReviewFinding {
  llmId: string; // Which LLM generated this finding
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'security' | 'performance' | 'maintainability' | 'architecture' | 'code-smell' | 'best-practice';
  message: string; // Brief description of the issue
  rationale: string; // Detailed explanation why this is a problem
  suggestion: string; // Concrete improvement suggestion
  filePath: string;
  lineNumber?: number;
  lineRange?: { start: number; end: number };
  codeSnippet?: string; // Relevant code that has the issue
  confidence: number; // LLM's confidence in this finding (0-1)
  tags: string[]; // Additional categorization tags
  estimatedFixTime?: string; // "5 minutes", "2 hours", "1 day"
  businessImpact?: 'low' | 'medium' | 'high'; // Impact on business goals
}

export interface MultiLLMReviewResult {
  codeContext: CodeContext;
  results: { [llmId: string]: AIReviewFinding[] };
  aggregation: {
    totalFindings: number;
    findingsBySeverity: { [severity: string]: number };
    findingsByCategory: { [category: string]: number };
    consensusFindings: AIReviewFinding[]; // Issues found by multiple LLMs
    uniqueFindings: { [llmId: string]: AIReviewFinding[] }; // LLM-specific findings
    llmAgreementScore: number; // How much LLMs agreed (0-1)
  };
  meta: {
    analysisStartTime: Date;
    analysisEndTime: Date;
    totalDuration: number; // milliseconds
    llmResponseTimes: { [llmId: string]: number };
    tokensUsed: { [llmId: string]: number };
    estimatedCost: { [llmId: string]: number }; // USD
    totalEstimatedCost: number;
    llmErrors: { [llmId: string]: string | null };
  };
}

export interface LLMResponse {
  success: boolean;
  findings: AIReviewFinding[];
  rawResponse?: string;
  tokensUsed?: number;
  responseTime: number;
  error?: string;
  estimatedCost?: number;
}

export interface PromptTemplate {
  systemPrompt: string;
  userPromptTemplate: string;
  contextInjection: {
    includeFileMetadata: boolean;
    includeProjectContext: boolean;
    includeGitDiff: boolean;
    maxCodeLength: number;
  };
}