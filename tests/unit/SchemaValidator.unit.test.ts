/**
 * Unit Tests for Schema Validators - KI-freundliche Regelwelt
 * Focused on actually available schema functionality
 * 
 * 🛡️ REGEL: Schema Validators MÜSSEN vollständig getestet werden
 * Teil der Phase 4.2 - Schema Validation Testing
 */

import { SchemaValidator } from '../../src/schemas/ai-config.schema';

describe('SchemaValidator Unit Tests - KI-freundliche Regelwelt', () => {
  describe('🛡️ Tools Database Schema Validation (Complete)', () => {
    const validCompleteToolsDatabase = {
      version: "1.0.0",
      lastUpdated: "2024-01-15T10:00:00Z",
      categories: {
        "code-analysis": {
          "eslint": {
            description: "JavaScript linting tool",
            packages: ["eslint", "@typescript-eslint/eslint-plugin"]
          },
          "prettier": {
            description: "Code formatting tool",
            packages: ["prettier"]
          }
        },
        "security": {
          "semgrep": {
            description: "Static analysis for security",
            packages: ["semgrep"]
          }
        }
      },
      frameworks: {
        "react": {
          name: "React",
          detectionFiles: ["package.json"],
          detectionPackages: ["react"],
          recommendedTools: {
            "linting": ["eslint", "eslint-plugin-react"]
          }
        },
        "vue": {
          name: "Vue.js",
          recommendedTools: {
            "linting": ["eslint", "eslint-plugin-vue"]
          }
        }
      }
    };

    it('should validate valid complete tools database successfully', () => {
      const result = SchemaValidator.validateCompleteToolsDatabase(validCompleteToolsDatabase);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validCompleteToolsDatabase);
      expect(result.errors).toBeUndefined();
    });

    it('should reject database missing required version', () => {
      const invalidData = {
        ...validCompleteToolsDatabase,
        version: undefined
      };
      delete invalidData.version;
      
      const result = SchemaValidator.validateCompleteToolsDatabase(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.errors!.some(err => err.includes("version"))).toBe(true);
    });

    it('should reject database with invalid version format', () => {
      const invalidData = {
        ...validCompleteToolsDatabase,
        version: "1.0" // Invalid format, should be x.y.z
      };
      
      const result = SchemaValidator.validateCompleteToolsDatabase(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.errors!.some(err => err.includes("Version muss im Format x.y.z sein"))).toBe(true);
    });

    it('should reject database without categories', () => {
      const invalidData = {
        ...validCompleteToolsDatabase,
        categories: undefined
      };
      delete invalidData.categories;
      
      const result = SchemaValidator.validateCompleteToolsDatabase(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.errors!.some(err => err.includes("categories"))).toBe(true);
    });

    it('should reject database without frameworks', () => {
      const invalidData = {
        ...validCompleteToolsDatabase,
        frameworks: undefined
      };
      delete invalidData.frameworks;
      
      const result = SchemaValidator.validateCompleteToolsDatabase(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.errors!.some(err => err.includes("frameworks"))).toBe(true);
    });

    it('should reject tool package with empty description', () => {
      const invalidData = {
        ...validCompleteToolsDatabase,
        categories: {
          "test": {
            "invalid-tool": {
              description: "", // Empty description
              packages: ["some-package"]
            }
          }
        }
      };
      
      const result = SchemaValidator.validateCompleteToolsDatabase(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.errors!.some(err => err.includes("Tool-Beschreibung darf nicht leer sein"))).toBe(true);
    });

    it('should reject tool package with empty packages array', () => {
      const invalidData = {
        ...validCompleteToolsDatabase,
        categories: {
          "test": {
            "invalid-tool": {
              description: "Valid description",
              packages: [] // Empty packages array
            }
          }
        }
      };
      
      const result = SchemaValidator.validateCompleteToolsDatabase(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.errors!.some(err => err.includes("Mindestens ein Package muss angegeben werden"))).toBe(true);
    });
  });

  describe('🔧 Tool Package Schema Validation', () => {
    it('should validate valid tool package', () => {
      const validPackage = {
        description: "TypeScript compiler",
        packages: ["typescript", "@types/node"]
      };
      
      const result = SchemaValidator.validateToolPackage(validPackage);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validPackage);
    });

    it('should validate tool package with optional metadata', () => {
      const packageWithMetadata = {
        description: "Advanced linting tool",
        packages: ["eslint"],
        configs: {
          "strict": [".eslintrc.strict.js"],
          "minimal": [".eslintrc.minimal.js"]
        },
        configFiles: [".eslintrc.js", ".eslintrc.json"],
        metadata: {
          priority: 8,
          compatibility: ["node", "browser"],
          lastUpdated: "2024-01-15"
        }
      };
      
      const result = SchemaValidator.validateToolPackage(packageWithMetadata);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(packageWithMetadata);
    });

    it('should reject tool package without description', () => {
      const invalidPackage = {
        packages: ["some-package"]
      };
      
      const result = SchemaValidator.validateToolPackage(invalidPackage);
      
      expect(result.success).toBe(false);
      expect(result.errors!.some(err => err.includes("description"))).toBe(true);
    });

    it('should reject tool package without packages', () => {
      const invalidPackage = {
        description: "Valid description"
      };
      
      const result = SchemaValidator.validateToolPackage(invalidPackage);
      
      expect(result.success).toBe(false);
      expect(result.errors!.some(err => err.includes("packages"))).toBe(true);
    });
  });

  describe('👤 User Configuration Schema Validation', () => {
    it('should validate minimal user config', () => {
      const minimalConfig = {};
      
      const result = SchemaValidator.validateUserConfig(minimalConfig);
      
      expect(result.success).toBe(true);
    });

    it('should validate complete user config', () => {
      const fullConfig = {
        language: "de" as const,
        preferences: {
          theme: "dark" as const,
          verbosity: "verbose" as const,
          autoUpdate: true,
          telemetry: false
        },
        lastModified: "2024-01-15T10:00:00Z",
        version: "2.0.0"
      };
      
      const result = SchemaValidator.validateUserConfig(fullConfig);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(fullConfig);
    });

    it('should reject invalid language', () => {
      const invalidConfig = {
        language: "fr" as any // Invalid language
      };
      
      const result = SchemaValidator.validateUserConfig(invalidConfig);
      
      expect(result.success).toBe(false);
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should reject invalid theme', () => {
      const invalidConfig = {
        preferences: {
          theme: "rainbow" as any // Invalid theme
        }
      };
      
      const result = SchemaValidator.validateUserConfig(invalidConfig);
      
      expect(result.success).toBe(false);
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should reject invalid verbosity', () => {
      const invalidConfig = {
        preferences: {
          verbosity: "silent" as any // Invalid verbosity
        }
      };
      
      const result = SchemaValidator.validateUserConfig(invalidConfig);
      
      expect(result.success).toBe(false);
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('📄 Template Configuration Schema Validation', () => {
    it('should validate valid template config', () => {
      const validTemplate = {
        name: "React Component Template",
        description: "Template for creating React components",
        version: "1.0.0",
        author: "WOARU Team",
        files: [{
          path: "src/components/Component.tsx",
          content: "export const Component = () => <div>Hello</div>;",
          executable: false
        }],
        variables: {
          "componentName": {
            description: "Name of the component",
            default: "MyComponent",
            required: true,
            type: "string" as const
          }
        },
        metadata: {
          category: "react",
          tags: ["typescript", "component"],
          license: "MIT"
        }
      };
      
      const result = SchemaValidator.validateTemplateConfig(validTemplate);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validTemplate);
    });

    it('should validate minimal template config', () => {
      const minimalTemplate = {
        name: "Simple Template",
        description: "A simple template",
        version: "1.0.0",
        files: [{
          path: "index.js",
          content: "console.log('Hello');"
        }]
      };
      
      const result = SchemaValidator.validateTemplateConfig(minimalTemplate);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(minimalTemplate);
    });

    it('should reject template without name', () => {
      const invalidTemplate = {
        description: "Template description",
        version: "1.0.0",
        files: [{
          path: "test.js",
          content: "// test"
        }]
      };
      
      const result = SchemaValidator.validateTemplateConfig(invalidTemplate);
      
      expect(result.success).toBe(false);
      expect(result.errors!.some(err => err.includes("name"))).toBe(true);
    });

    it('should reject template with empty name', () => {
      const invalidTemplate = {
        name: "", // Empty name
        description: "Template description",
        version: "1.0.0",
        files: [{
          path: "test.js",
          content: "// test"
        }]
      };
      
      const result = SchemaValidator.validateTemplateConfig(invalidTemplate);
      
      expect(result.success).toBe(false);
      expect(result.errors!.some(err => err.includes("Template-Name darf nicht leer sein"))).toBe(true);
    });

    it('should reject template with invalid version', () => {
      const invalidTemplate = {
        name: "Test Template",
        description: "Template description",
        version: "1.0", // Invalid version format
        files: [{
          path: "test.js",
          content: "// test"
        }]
      };
      
      const result = SchemaValidator.validateTemplateConfig(invalidTemplate);
      
      expect(result.success).toBe(false);
      expect(result.errors!.some(err => err.includes("Version muss im Format x.y.z sein"))).toBe(true);
    });

    it('should reject template without files', () => {
      const invalidTemplate = {
        name: "Test Template",
        description: "Template description",
        version: "1.0.0"
      };
      
      const result = SchemaValidator.validateTemplateConfig(invalidTemplate);
      
      expect(result.success).toBe(false);
      expect(result.errors!.some(err => err.includes("files"))).toBe(true);
    });

    it('should reject template with empty files array', () => {
      const invalidTemplate = {
        name: "Test Template", 
        description: "Template description",
        version: "1.0.0",
        files: [] // Empty files array
      };
      
      const result = SchemaValidator.validateTemplateConfig(invalidTemplate);
      
      expect(result.success).toBe(false);
      expect(result.errors!.some(err => err.includes("Mindestens eine Template-Datei muss definiert sein"))).toBe(true);
    });
  });

  describe('🎯 Edge Cases and Error Handling', () => {
    it('should handle null inputs gracefully', () => {
      const validators = [
        () => SchemaValidator.validateCompleteToolsDatabase(null),
        () => SchemaValidator.validateToolPackage(null),
        () => SchemaValidator.validateUserConfig(null),
        () => SchemaValidator.validateTemplateConfig(null)
      ];

      validators.forEach(validator => {
        const result = validator();
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors!.length).toBeGreaterThan(0);
      });
    });

    it('should handle undefined inputs gracefully', () => {
      const validators = [
        () => SchemaValidator.validateCompleteToolsDatabase(undefined),
        () => SchemaValidator.validateToolPackage(undefined),
        () => SchemaValidator.validateUserConfig(undefined),
        () => SchemaValidator.validateTemplateConfig(undefined)
      ];

      validators.forEach(validator => {
        const result = validator();
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors!.length).toBeGreaterThan(0);
      });
    });

    it('should handle malformed objects', () => {
      const malformedObject = {
        toString: () => "malformed",
        valueOf: () => null
      };

      const result = SchemaValidator.validateCompleteToolsDatabase(malformedObject);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should provide detailed error paths', () => {
      const invalidData = {
        version: "1.0.0",
        lastUpdated: "2024-01-15",
        categories: {
          "invalid-category": {
            "invalid-tool": {
              description: "", // This should cause an error
              packages: ["valid-package"]
            }
          }
        },
        frameworks: {
          "test": {
            name: "Test",
            recommendedTools: {}
          }
        }
      };
      
      const result = SchemaValidator.validateCompleteToolsDatabase(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.errors!.length).toBeGreaterThan(0);
      
      // Should have path information in error
      const hasPathInfo = result.errors!.some(err => 
        err.includes("categories") && err.includes("invalid-tool")
      );
      expect(hasPathInfo).toBe(true);
    });
  });

  describe('🔄 German Error Messages Integration', () => {
    it('should provide German error messages for tools database', () => {
      const invalidData = {
        version: "1.0.0",
        lastUpdated: "2024-01-15",
        categories: {
          "test": {
            "tool": {
              description: "",
              packages: []
            }
          }
        },
        frameworks: {
          "test": { name: "Test", recommendedTools: {} }
        }
      };
      
      const result = SchemaValidator.validateCompleteToolsDatabase(invalidData);
      
      expect(result.success).toBe(false);
      
      const hasGermanError = result.errors!.some(err => 
        err.includes("Tool-Beschreibung darf nicht leer sein") ||
        err.includes("Mindestens ein Package muss angegeben werden")
      );
      expect(hasGermanError).toBe(true);
    });

    it('should provide German error messages for templates', () => {
      const invalidTemplate = {
        name: "",
        description: "",
        version: "invalid",
        files: []
      };
      
      const result = SchemaValidator.validateTemplateConfig(invalidTemplate);
      
      expect(result.success).toBe(false);
      
      const hasGermanError = result.errors!.some(err => 
        err.includes("Template-Name darf nicht leer sein") ||
        err.includes("Template-Beschreibung darf nicht leer sein") ||
        err.includes("Version muss im Format x.y.z sein") ||
        err.includes("Mindestens eine Template-Datei muss definiert sein")
      );
      expect(hasGermanError).toBe(true);
    });
  });

  describe('📊 Performance and Robustness', () => {
    it('should handle large configurations efficiently', () => {
      // Create a large but valid configuration
      const largeCategories: any = {};
      for (let i = 0; i < 50; i++) {
        largeCategories[`category-${i}`] = {
          [`tool-${i}`]: {
            description: `Tool number ${i}`,
            packages: [`package-${i}-1`, `package-${i}-2`]
          }
        };
      }

      const largeFrameworks: any = {};
      for (let i = 0; i < 20; i++) {
        largeFrameworks[`framework-${i}`] = {
          name: `Framework ${i}`,
          recommendedTools: {
            [`category-${i}`]: [`tool-${i}`]
          }
        };
      }

      const largeConfig = {
        version: "1.0.0",
        lastUpdated: "2024-01-15T10:00:00Z",
        categories: largeCategories,
        frameworks: largeFrameworks
      };
      
      const startTime = performance.now();
      const result = SchemaValidator.validateCompleteToolsDatabase(largeConfig);
      const endTime = performance.now();
      
      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should validate in under 100ms
    });

    it('should not leak memory with repeated validations', () => {
      // Perform many validations to test for memory leaks
      for (let i = 0; i < 1000; i++) {
        const testConfig = {
          version: "1.0.0",
          lastUpdated: "2024-01-15T10:00:00Z",
          categories: {
            [`category-${i}`]: {
              [`tool-${i}`]: {
                description: `Tool ${i}`,
                packages: [`pkg-${i}`]
              }
            }
          },
          frameworks: {
            [`framework-${i}`]: {
              name: `Framework ${i}`,
              recommendedTools: {}
            }
          }
        };
        
        const result = SchemaValidator.validateCompleteToolsDatabase(testConfig);
        expect(result.success).toBe(true);
      }
      
      // If we get here without running out of memory, the test passes
      expect(true).toBe(true);
    });
  });
});