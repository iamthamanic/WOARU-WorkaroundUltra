import { z } from 'zod';

/**
 * 🛡️ WOARU Schema Validation - KI-freundliche Regelwelt
 *
 * Zod Schema Definitions für alle WOARU Konfigurationsdateien
 * Teil der "KI-freundlichen Regelwelt" - strikte Typen für AI-Assistenten
 */

// =============================================================================
// TOOLS DATABASE SCHEMAS
// =============================================================================

/**
 * 🔧 Tools Database Package Configuration Schema
 */
export const ToolPackageSchema = z.object({
  description: z.string().min(1, 'Tool-Beschreibung darf nicht leer sein'),
  packages: z
    .array(z.string().min(1, 'Package-Name darf nicht leer sein'))
    .min(1, 'Mindestens ein Package muss angegeben werden'),
  configs: z
    .record(z.string(), z.array(z.string()))
    .optional()
    .describe('Optionale Konfigurationsvarianten'),
  configFiles: z
    .array(z.string())
    .optional()
    .describe('Mögliche Konfigurationsdateien'),
  metadata: z
    .object({
      priority: z.number().min(1).max(10).optional(),
      compatibility: z.array(z.string()).optional(),
      lastUpdated: z.string().optional(),
    })
    .optional(),
});

/**
 * 🏗️ Framework Configuration Schema
 */
export const FrameworkSchema = z.object({
  name: z.string().min(1, 'Framework-Name darf nicht leer sein'),
  detectionFiles: z.array(z.string()).optional(),
  detectionPackages: z.array(z.string()).optional(),
  recommendedTools: z.record(z.string(), z.array(z.string())),
  specificPackages: z.array(z.string()).optional(),
  metadata: z
    .object({
      version: z.string().optional(),
      popularity: z.number().optional(),
      maintainedStatus: z
        .enum(['active', 'maintenance', 'deprecated'])
        .optional(),
    })
    .optional(),
});

/**
 * 📊 Tools Database Metadata Schema
 */
export const ToolsDatabaseMetadataSchema = z.object({
  updateFrequency: z.enum(['daily', 'weekly', 'monthly']),
  sources: z
    .array(
      z.object({
        name: z.string().min(1, 'Quelle-Name darf nicht leer sein'),
        url: z.string().url('Ungültige URL für Quelle'),
        type: z.enum(['npm', 'github', 'pypi', 'nuget', 'maven', 'other']),
      })
    )
    .optional(),
  lastDataUpdate: z.string().optional(),
  totalTools: z.number().optional(),
});

/**
 * 🗄️ Complete Tools Database Schema
 */
export const ToolsDatabaseSchema = z.object({
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version muss im Format x.y.z sein'),
  lastUpdated: z.string().min(1, 'Letztes Update-Datum muss angegeben werden'),
  categories: z
    .record(z.string(), z.record(z.string(), ToolPackageSchema))
    .refine(data => Object.keys(data).length > 0, {
      message: 'Mindestens eine Tool-Kategorie muss definiert sein',
    }),
  frameworks: z
    .record(z.string(), FrameworkSchema)
    .refine(data => Object.keys(data).length > 0, {
      message: 'Mindestens ein Framework muss definiert sein',
    }),
  metadata: ToolsDatabaseMetadataSchema.optional(),
});

/**
 * 👤 User Configuration Schema
 */
export const UserConfigSchema = z.object({
  language: z.enum(['de', 'en']).optional(),
  preferences: z
    .object({
      theme: z.enum(['dark', 'light', 'auto']).optional(),
      verbosity: z.enum(['quiet', 'normal', 'verbose']).optional(),
      autoUpdate: z.boolean().optional(),
      telemetry: z.boolean().optional(),
    })
    .optional(),
  lastModified: z.string().optional(),
  version: z.string().optional(),
});

/**
 * 📄 Template Configuration Schema
 */
export const TemplateConfigSchema = z.object({
  name: z.string().min(1, 'Template-Name darf nicht leer sein'),
  description: z.string().min(1, 'Template-Beschreibung darf nicht leer sein'),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version muss im Format x.y.z sein'),
  author: z.string().optional(),
  files: z
    .array(
      z.object({
        path: z.string().min(1, 'Dateipfad darf nicht leer sein'),
        content: z.string(),
        executable: z.boolean().optional(),
      })
    )
    .min(1, 'Mindestens eine Template-Datei muss definiert sein'),
  variables: z
    .record(
      z.string(),
      z.object({
        description: z.string(),
        default: z.string().or(z.number()).or(z.boolean()).optional(),
        required: z.boolean().optional(),
        type: z.enum(['string', 'number', 'boolean']).optional(),
      })
    )
    .optional(),
  metadata: z
    .object({
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      license: z.string().optional(),
    })
    .optional(),
});

// =============================================================================
// AI CONFIGURATION SCHEMAS
// =============================================================================

/**
 * 🛡️ WOARU AI Configuration Schema (Zod)
 *
 * Diese Schemas validieren die Struktur der ai_config.json und stellen sicher,
 * dass alle Konfigurationen den definierten Regeln entsprechen.
 *
 * Teil der "KI-freundlichen Regelwelt" - garantiert konsistente Datenstrukturen.
 */

// Base Provider Types Schema
export const ProviderTypeSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'custom-ollama',
  'azure-openai',
]);

// LLM Provider Configuration Schema
export const LLMProviderConfigSchema = z.object({
  id: z
    .string()
    .min(1, 'Provider ID darf nicht leer sein')
    .regex(
      /^[a-z0-9-]+$/,
      'Provider ID darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten'
    ),

  providerType: ProviderTypeSchema,

  apiKeyEnvVar: z
    .string()
    .min(1, 'API Key Environment Variable darf nicht leer sein')
    .regex(
      /^[A-Z_]+$/,
      'API Key Env Var muss Großbuchstaben und Unterstriche verwenden'
    ),

  baseUrl: z.string().url('Base URL muss eine gültige URL sein'),

  model: z.string().min(1, 'Model Name darf nicht leer sein'),

  headers: z.record(z.string(), z.string()).optional(),

  bodyTemplate: z
    .string()
    .min(1, 'Body Template darf nicht leer sein')
    .refine(
      template => template.includes('{prompt}') && template.includes('{code}'),
      'Body Template muss {prompt} und {code} Platzhalter enthalten'
    ),

  timeout: z
    .number()
    .int('Timeout muss eine ganze Zahl sein')
    .min(1000, 'Timeout muss mindestens 1000ms sein')
    .max(300000, 'Timeout darf maximal 300000ms (5 Minuten) sein')
    .optional(),

  maxTokens: z
    .number()
    .int('MaxTokens muss eine ganze Zahl sein')
    .min(1, 'MaxTokens muss mindestens 1 sein')
    .max(200000, 'MaxTokens darf maximal 200000 sein')
    .optional(),

  temperature: z
    .number()
    .min(0, 'Temperature muss zwischen 0 und 2 liegen')
    .max(2, 'Temperature muss zwischen 0 und 2 liegen')
    .optional(),

  enabled: z.boolean(),
});

// AI Review Configuration Schema
export const AIReviewConfigSchema = z.object({
  providers: z
    .array(LLMProviderConfigSchema)
    .min(1, 'Mindestens ein Provider muss konfiguriert sein'),

  parallelRequests: z.boolean(),

  consensusMode: z.boolean(),

  minConsensusCount: z
    .number()
    .int('MinConsensusCount muss eine ganze Zahl sein')
    .min(1, 'MinConsensusCount muss mindestens 1 sein'),

  tokenLimit: z
    .number()
    .int('TokenLimit muss eine ganze Zahl sein')
    .min(100, 'TokenLimit muss mindestens 100 sein')
    .max(200000, 'TokenLimit darf maximal 200000 sein'),

  costThreshold: z
    .number()
    .min(0.01, 'CostThreshold muss mindestens 0.01 USD sein')
    .max(100, 'CostThreshold darf maximal 100 USD sein'),
});

// Metadata Schema für ai_config.json
export const ConfigMetadataSchema = z.object({
  created: z
    .string()
    .datetime('Created muss ein gültiges ISO DateTime Format haben'),
  description: z.string().min(1, 'Description darf nicht leer sein'),
  lastModified: z
    .string()
    .datetime('LastModified muss ein gültiges ISO DateTime Format haben')
    .optional(),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version muss im Format x.y.z sein')
    .optional(),
});

// Complete AI Config File Schema
export const AIConfigFileSchema = z
  .object({
    _metadata: ConfigMetadataSchema,

    multi_ai_review_enabled: z.boolean(),

    primary_review_provider_id: z.string().min(1).nullable(),

    // Dynamic provider configurations
    // Die eigentlichen Provider werden als dynamische Keys gespeichert
  })
  .catchall(
    z.union([
      LLMProviderConfigSchema,
      z.unknown(), // Für andere Metadaten-Keys
    ])
  );

// Schema für die Tools-Datenbank
export const ToolConfigSchema = z.object({
  name: z.string().min(1, 'Tool Name darf nicht leer sein'),
  description: z.string().min(1, 'Tool Description darf nicht leer sein'),
  category: z.string().min(1, 'Tool Category darf nicht leer sein'),
  language: z.string().min(1, 'Tool Language darf nicht leer sein'),
  homepage: z.string().url('Homepage muss eine gültige URL sein').optional(),
  installation: z
    .object({
      npm: z.string().optional(),
      pip: z.string().optional(),
      cargo: z.string().optional(),
      go: z.string().optional(),
      manual: z.string().optional(),
    })
    .optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
  filePatterns: z.array(z.string()).optional(),
  commands: z.record(z.string(), z.string()).optional(),
  priority: z
    .number()
    .int('Priority muss eine ganze Zahl sein')
    .min(1, 'Priority muss mindestens 1 sein')
    .max(10, 'Priority darf maximal 10 sein')
    .optional(),
  enabled: z.boolean().optional(),
});

export const LegacyToolsDatabaseSchema = z.record(z.string(), ToolConfigSchema);

// Type exports - TypeScript Interfaces aus den Schemas ableiten
export type LLMProviderConfig = z.infer<typeof LLMProviderConfigSchema>;
export type AIReviewConfig = z.infer<typeof AIReviewConfigSchema>;
export type ConfigMetadata = z.infer<typeof ConfigMetadataSchema>;
export type AIConfigFile = z.infer<typeof AIConfigFileSchema>;
export type ToolConfig = z.infer<typeof ToolConfigSchema>;
export type SchemaToolsDatabase = z.infer<typeof LegacyToolsDatabaseSchema>;

// New type exports for expanded schemas
export type ToolPackage = z.infer<typeof ToolPackageSchema>;
export type Framework = z.infer<typeof FrameworkSchema>;
export type ToolsDatabaseMetadata = z.infer<typeof ToolsDatabaseMetadataSchema>;
export type CompleteToolsDatabase = z.infer<typeof ToolsDatabaseSchema>;
export type UserConfig = z.infer<typeof UserConfigSchema>;
export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;

/**
 * 🎯 Schema Validation Utilities
 */

export class SchemaValidator {
  /**
   * Validiert eine AI-Konfigurationsdatei gegen das Schema
   */
  static validateAIConfig(data: unknown): {
    success: boolean;
    data?: AIConfigFile;
    errors?: string[];
  } {
    try {
      const validatedData = AIConfigFileSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map(
          (err: any) => `${err.path.join('.')}: ${err.message}`
        );
        return { success: false, errors };
      }
      return { success: false, errors: [String(error)] };
    }
  }

  /**
   * Validiert eine Tools-Datenbank gegen das Schema (Legacy)
   */
  static validateToolsDatabase(data: unknown): {
    success: boolean;
    data?: SchemaToolsDatabase;
    errors?: string[];
  } {
    try {
      const validatedData = LegacyToolsDatabaseSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map(
          (err: any) => `${err.path.join('.')}: ${err.message}`
        );
        return { success: false, errors };
      }
      return { success: false, errors: [String(error)] };
    }
  }

  /**
   * 🗄️ Validiert die vollständige Tools-Datenbank (Neue Struktur)
   */
  static validateCompleteToolsDatabase(data: unknown): {
    success: boolean;
    data?: CompleteToolsDatabase;
    errors?: string[];
  } {
    try {
      const validatedData = ToolsDatabaseSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map(
          (err: any) => `${err.path.join('.')}: ${err.message}`
        );
        return { success: false, errors };
      }
      return { success: false, errors: [String(error)] };
    }
  }

  /**
   * 👤 Validiert User-Konfiguration
   */
  static validateUserConfig(data: unknown): {
    success: boolean;
    data?: UserConfig;
    errors?: string[];
  } {
    try {
      const validatedData = UserConfigSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map(
          (err: any) => `${err.path.join('.')}: ${err.message}`
        );
        return { success: false, errors };
      }
      return { success: false, errors: [String(error)] };
    }
  }

  /**
   * 📄 Validiert Template-Konfiguration
   */
  static validateTemplateConfig(data: unknown): {
    success: boolean;
    data?: TemplateConfig;
    errors?: string[];
  } {
    try {
      const validatedData = TemplateConfigSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map(
          (err: any) => `${err.path.join('.')}: ${err.message}`
        );
        return { success: false, errors };
      }
      return { success: false, errors: [String(error)] };
    }
  }

  /**
   * 🔧 Validiert einzelnes Tool-Package
   */
  static validateToolPackage(data: unknown): {
    success: boolean;
    data?: ToolPackage;
    errors?: string[];
  } {
    try {
      const validatedData = ToolPackageSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map(
          (err: any) => `${err.path.join('.')}: ${err.message}`
        );
        return { success: false, errors };
      }
      return { success: false, errors: [String(error)] };
    }
  }

  /**
   * 🏗️ Validiert Framework-Konfiguration
   */
  static validateFramework(data: unknown): {
    success: boolean;
    data?: Framework;
    errors?: string[];
  } {
    try {
      const validatedData = FrameworkSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map(
          (err: any) => `${err.path.join('.')}: ${err.message}`
        );
        return { success: false, errors };
      }
      return { success: false, errors: [String(error)] };
    }
  }

  /**
   * Validiert eine einzelne Provider-Konfiguration
   */
  static validateProviderConfig(data: unknown): {
    success: boolean;
    data?: LLMProviderConfig;
    errors?: string[];
  } {
    try {
      const validatedData = LLMProviderConfigSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map(
          (err: any) => `${err.path.join('.')}: ${err.message}`
        );
        return { success: false, errors };
      }
      return { success: false, errors: [String(error)] };
    }
  }
}
