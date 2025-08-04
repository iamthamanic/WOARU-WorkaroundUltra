/**
 * Type definitions for the WOARU init command system
 */

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'desktop';
  language: string;
  frameworks: string[];
  packageManager: PackageManager;
  structure: ProjectStructure;
  dependencies: DependencyConfig;
  configuration: ConfigurationFiles;
  features: FeatureDefinition[];
}

export interface ProjectStructure {
  directories: DirectoryDefinition[];
  files: FileDefinition[];
  templates: TemplateReference[];
}

export interface DirectoryDefinition {
  path: string;
  description?: string;
  conditional?: ConditionalRule;
}

export interface FileDefinition {
  source: string;
  destination: string;
  template?: boolean;
  executable?: boolean;
  conditional?: ConditionalRule;
}

export interface TemplateReference {
  source: string;
  destination: string;
  variables: TemplateVariables;
  conditional?: ConditionalRule;
}

export interface ConditionalRule {
  feature?: string;
  features?: string[];
  condition?: string;
}

export interface TemplateVariables {
  [key: string]: string | boolean | number | TemplateVariables;
}

export interface DependencyConfig {
  runtime: string[];
  development: string[];
  peer?: string[];
  optional?: string[];
}

export interface ConfigurationFiles {
  [filename: string]: ConfigurationContent;
}

export interface ConfigurationContent {
  template?: string;
  content?: Record<string, unknown>;
  conditional?: ConditionalRule;
}

export interface FeatureDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  default?: boolean;
  dependencies?: string[];
  conflicts?: string[];
  configurations?: ConfigurationPatch[];
  additionalDeps?: DependencyConfig;
}

export interface ConfigurationPatch {
  file: string;
  operation: 'merge' | 'replace' | 'append';
  content: Record<string, unknown>;
}

export type PackageManager =
  | 'npm'
  | 'yarn'
  | 'pnpm'
  | 'pip'
  | 'poetry'
  | 'pipenv';

export interface ProjectConfig {
  name: string;
  description?: string;
  author?: string;
  email?: string;
  license?: string;
  version?: string;
  template: ProjectTemplate;
  features: string[];
  directory: string;
  packageManager: PackageManager;
  gitInit?: boolean;
  installDeps?: boolean;
  variables: TemplateVariables;
}

export interface InitOptions {
  template?: string;
  directory?: string;
  skipInstall?: boolean;
  features?: string;
  interactive?: boolean;
  dryRun?: boolean;
}

export interface GeneratedProject {
  config: ProjectConfig;
  files: GeneratedFile[];
  directories: string[];
  summary: ProjectSummary;
}

export interface GeneratedFile {
  path: string;
  content: string;
  executable?: boolean;
}

export interface ProjectSummary {
  totalFiles: number;
  totalDirectories: number;
  dependencies: {
    runtime: number;
    development: number;
  };
  features: string[];
  nextSteps: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface ValidationWarning {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

// Template Registry
export interface TemplateRegistry {
  templates: Map<string, ProjectTemplate>;
  categories: Map<string, ProjectTemplate[]>;

  register(template: ProjectTemplate): void;
  get(id: string): ProjectTemplate | undefined;
  getByCategory(category: string): ProjectTemplate[];
  list(): ProjectTemplate[];
  validate(template: ProjectTemplate): ValidationResult;
}

// Interactive Selector Types
export interface ProjectTypeSelection {
  template: ProjectTemplate;
  features: string[];
  config: Partial<ProjectConfig>;
}

export interface InteractivePrompts {
  selectProjectType(): Promise<ProjectTemplate>;
  selectFeatures(template: ProjectTemplate): Promise<string[]>;
  configureProject(
    template: ProjectTemplate,
    features: string[]
  ): Promise<ProjectConfig>;
  confirmGeneration(config: ProjectConfig): Promise<boolean>;
}
