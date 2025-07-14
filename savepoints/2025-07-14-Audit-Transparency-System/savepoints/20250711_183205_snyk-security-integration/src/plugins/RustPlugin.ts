import { BasePlugin } from './BasePlugin';
import {
  ProjectAnalysis,
  SetupRecommendation,
  RefactorSuggestion,
} from '../types';

export class RustPlugin extends BasePlugin {
  name = 'Rust';
  frameworks = ['rust', 'actix', 'rocket', 'tokio'];

  canHandle(analysis: ProjectAnalysis): boolean {
    return (
      analysis.language === 'Rust' ||
      analysis.configFiles.some(
        file => file.includes('Cargo.toml') || file.includes('Cargo.lock')
      )
    );
  }

  getRecommendations(analysis: ProjectAnalysis): SetupRecommendation[] {
    const recommendations: SetupRecommendation[] = [];

    // Clippy for linting (comes with Rust)
    recommendations.push({
      tool: 'clippy',
      category: 'linting',
      reason: "Rust's official linter with hundreds of helpful suggestions",
      packages: [],
      configFiles: ['clippy.toml'],
      priority: 'high',
    });

    // rustfmt for formatting (comes with Rust)
    recommendations.push({
      tool: 'rustfmt',
      category: 'formatting',
      reason: 'Official Rust code formatter for consistent style',
      packages: [],
      configFiles: ['rustfmt.toml'],
      priority: 'high',
    });

    // Pre-commit hooks
    if (!this.hasConfigFile(analysis, '.pre-commit-config.yaml')) {
      recommendations.push({
        tool: 'pre-commit-rust',
        category: 'git-hooks',
        reason: 'Run Rust checks before committing code',
        packages: [],
        configFiles: ['.pre-commit-config.yaml'],
        priority: 'medium',
      });
    }

    // cargo-audit for security
    recommendations.push({
      tool: 'cargo-audit',
      category: 'security',
      reason: 'Audit Cargo.lock for crates with security vulnerabilities',
      packages: [],
      configFiles: [],
      priority: 'high',
    });

    // cargo-deny for dependency management
    recommendations.push({
      tool: 'cargo-deny',
      category: 'dependency-management',
      reason: 'Lint your dependencies for licenses, duplicates, and security',
      packages: [],
      configFiles: ['deny.toml'],
      priority: 'medium',
    });

    // cargo-tarpaulin for test coverage
    if (!this.hasPackage(analysis, 'tarpaulin')) {
      recommendations.push({
        tool: 'cargo-tarpaulin',
        category: 'test-coverage',
        reason: 'Code coverage reporting tool for Rust',
        packages: [],
        configFiles: [],
        priority: 'medium',
      });
    }

    // cargo-watch for development
    recommendations.push({
      tool: 'cargo-watch',
      category: 'development',
      reason: 'Watch for changes and automatically run cargo commands',
      packages: [],
      configFiles: [],
      priority: 'low',
    });

    return recommendations;
  }

  getRefactorSuggestions(analysis: ProjectAnalysis): RefactorSuggestion[] {
    const suggestions: RefactorSuggestion[] = [];

    const rustFiles = analysis.structure.filter(file => file.endsWith('.rs'));

    rustFiles.forEach(file => {
      // Web framework specific suggestions
      if (analysis.framework.includes('actix')) {
        if (file.includes('handler') || file.includes('route')) {
          suggestions.push({
            filename: file,
            suggestion: 'Use actix-web extractors for clean request handling',
            type: 'best-practice',
          });
        }
      }

      if (analysis.framework.includes('rocket')) {
        if (file.includes('route')) {
          suggestions.push({
            filename: file,
            suggestion: "Use Rocket's request guards for validation and auth",
            type: 'best-practice',
          });
        }
      }

      // Async suggestions
      if (analysis.framework.includes('tokio')) {
        suggestions.push({
          filename: file,
          suggestion:
            'Use async/await syntax consistently throughout async functions',
          type: 'performance',
        });
      }

      // Test suggestions
      if (file.includes('test') || file.includes('tests')) {
        suggestions.push({
          filename: file,
          suggestion:
            'Use #[tokio::test] for async tests in tokio applications',
          type: 'best-practice',
        });
      }

      // Main file suggestions
      if (file === 'main.rs') {
        suggestions.push({
          filename: file,
          suggestion: 'Consider using #[tokio::main] for async main functions',
          type: 'best-practice',
        });
      }

      // Error handling suggestions
      if (file.includes('error') || file.includes('err')) {
        suggestions.push({
          filename: file,
          suggestion: 'Use the ? operator for clean error propagation',
          type: 'best-practice',
        });
        suggestions.push({
          filename: file,
          suggestion:
            'Consider using thiserror or anyhow for better error handling',
          type: 'maintainability',
        });
      }
    });

    return suggestions;
  }

  getSpecificPackages(): string[] {
    return [
      'serde',
      'tokio',
      'actix-web',
      'rocket',
      'clap',
      'log',
      'env_logger',
      'anyhow',
      'thiserror',
      'reqwest',
      'sqlx',
      'diesel',
    ];
  }
}
