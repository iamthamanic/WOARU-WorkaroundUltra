export interface CodeSmellFinding {
  type: CodeSmellType;
  message: string;
  severity: 'error' | 'warning' | 'info';
  line: number;
  column: number;
  rule?: string;
  suggestion?: string;
}

export type CodeSmellType =
  | 'complexity'
  | 'var-keyword'
  | 'weak-equality'
  | 'console-log'
  | 'function-length'
  | 'parameter-count'
  | 'nested-depth'
  | 'magic-number'
  | 'duplicate-code'
  | 'dead-code';

export interface ComplexityMetric {
  functionName: string;
  complexity: number;
  line: number;
  column: number;
}

export interface CodeMetrics {
  complexity: ComplexityMetric[];
  functionLength: Array<{
    functionName: string;
    length: number;
    line: number;
    column: number;
  }>;
  parameterCount: Array<{
    functionName: string;
    parameterCount: number;
    line: number;
    column: number;
  }>;
}
