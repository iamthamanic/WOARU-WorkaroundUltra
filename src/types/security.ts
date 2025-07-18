/**
 * Security-related types for WOARU Security Integration
 */

export interface SecurityFinding {
  tool: 'snyk' | 'gitleaks' | 'trufflehog' | 'trivy' | 'semgrep' | 'woaru-security';
  type: 'vulnerability' | 'secret' | 'misconfiguration';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  file?: string;
  line?: number;
  column?: number;
  package?: string;
  version?: string;
  fixedIn?: string;
  cve?: string;
  cwe?: string[];
  exploitMaturity?: string;
  recommendation?: string;
  references?: string[];
}

export interface SecurityScanResult {
  tool: string;
  scanTime: Date;
  findings: SecurityFinding[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  error?: string;
}

export interface SnykVulnerability {
  id: string;
  title: string;
  severity: string;
  packageName: string;
  version: string;
  fixedIn?: string[];
  exploit?: string;
  CVSSv3?: string;
  CWE?: string[];
  semver?: {
    vulnerable: string[];
  };
  references?: Array<{
    title: string;
    url: string;
  }>;
}

export interface SnykTestResult {
  ok: boolean;
  vulnerabilities: SnykVulnerability[];
  dependencyCount: number;
  packageManager?: string;
  summary?: string;
}

export interface GitleaksResult {
  Description: string;
  StartLine: number;
  EndLine: number;
  StartColumn: number;
  EndColumn: number;
  Match: string;
  Secret: string;
  File: string;
  Commit: string;
  Entropy: number;
  Author: string;
  Email: string;
  Date: string;
  Message: string;
  Tags: string[];
  RuleID: string;
  Fingerprint: string;
}

export interface SecurityCheckOptions {
  includeDevDependencies?: boolean;
  severityThreshold?: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number;
  quiet?: boolean;
}
