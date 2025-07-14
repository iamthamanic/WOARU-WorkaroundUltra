/**
 * SOLID Principles Type Definitions for WOARU
 * Definiert alle Typen für SOLID-Prinzipien-Analyse
 */

export type SOLIDPrinciple = 'SRP' | 'OCP' | 'LSP' | 'ISP' | 'DIP';

export interface SOLIDViolation {
  principle: SOLIDPrinciple;
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line?: number;
  column?: number;
  class?: string;
  method?: string;
  description: string;
  explanation: string;      // Warum ist das ein SOLID-Verstoß?
  impact: string;          // Was sind die Konsequenzen?
  suggestion: string;      // Wie kann es behoben werden?
  metrics?: {
    complexity?: number;
    methodCount?: number;
    dependencies?: number;
    parameters?: number;
    linesOfCode?: number;
    importConcerns?: string[];
  };
}

export interface SOLIDCheckResult {
  filePath: string;
  language: string;
  violations: SOLIDViolation[];
  metrics: {
    classCount: number;
    methodCount: number;
    avgComplexity: number;
    maxComplexity: number;
    solidScore: number;      // 0-100 SOLID compliance score
    concernDiversity: number; // Number of different concerns detected
  };
  suggestions: string[];
}

export interface ProjectSOLIDResult {
  totalFiles: number;
  totalViolations: number;
  overallSOLIDScore: number;
  principleBreakdown: {
    SRP: { violations: number; score: number };
    OCP: { violations: number; score: number };
    LSP: { violations: number; score: number };
    ISP: { violations: number; score: number };
    DIP: { violations: number; score: number };
  };
  srpViolations: SOLIDViolation[];
  ocpViolations: SOLIDViolation[];
  ispViolations: SOLIDViolation[];
  dipViolations: SOLIDViolation[];
  lspViolations: SOLIDViolation[];
  recommendations: string[];
}

export interface ClassAnalysis {
  name: string;
  line: number;
  methods: MethodAnalysis[];
  imports: string[];
  complexity: number;
  linesOfCode: number;
  concerns: string[];
}

export interface MethodAnalysis {
  name: string;
  line: number;
  parameters: number;
  complexity: number;
  linesOfCode: number;
}

export interface ImportConcern {
  type: 'database' | 'http' | 'filesystem' | 'email' | 'validation' | 'ui' | 'business' | 'utility';
  evidence: string[];
  confidence: number; // 0-1
}

export interface SOLIDToolConfig {
  name: string;
  command: string;
  outputFormat: 'json' | 'xml' | 'text';
  supportedLanguages: string[];
  supportedPrinciples: SOLIDPrinciple[];
  parser: string; // Parser function name
}