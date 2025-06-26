import { BasePlugin } from './BasePlugin';
import {
  ProjectAnalysis,
  SetupRecommendation,
  RefactorSuggestion,
} from '../types';

export class GoPlugin extends BasePlugin {
  name = 'Go';
  frameworks = ['go', 'gin', 'echo', 'fiber'];

  canHandle(analysis: ProjectAnalysis): boolean {
    return (
      analysis.language === 'Go' ||
      analysis.configFiles.some(
        file => file.includes('go.mod') || file.includes('go.sum')
      )
    );
  }

  getRecommendations(analysis: ProjectAnalysis): SetupRecommendation[] {
    const recommendations: SetupRecommendation[] = [];

    // golangci-lint for comprehensive linting
    recommendations.push({
      tool: 'golangci-lint',
      category: 'linting',
      reason: 'Comprehensive Go linting with 40+ linters in one tool',
      packages: [],
      configFiles: ['.golangci.yml'],
      priority: 'high',
    });

    // gofmt is built-in, but recommend goimports
    recommendations.push({
      tool: 'goimports',
      category: 'formatting',
      reason: 'Automatically format Go code and manage imports',
      packages: [],
      configFiles: [],
      priority: 'high',
    });

    // Pre-commit hooks for Go
    if (!this.hasConfigFile(analysis, '.pre-commit-config.yaml')) {
      recommendations.push({
        tool: 'pre-commit-go',
        category: 'git-hooks',
        reason: 'Ensure code quality with Go-specific pre-commit hooks',
        packages: [],
        configFiles: ['.pre-commit-config.yaml'],
        priority: 'medium',
      });
    }

    // Go testing tools
    recommendations.push({
      tool: 'testify',
      category: 'testing',
      reason: 'Comprehensive testing toolkit with assertions and mocks',
      packages: ['github.com/stretchr/testify'],
      configFiles: [],
      priority: 'medium',
    });

    // Security scanning
    recommendations.push({
      tool: 'gosec',
      category: 'security',
      reason: 'Scan Go code for security vulnerabilities',
      packages: [],
      configFiles: [],
      priority: 'medium',
    });

    // Dependency vulnerability scanning
    recommendations.push({
      tool: 'govulncheck',
      category: 'security',
      reason: 'Check for known vulnerabilities in Go dependencies',
      packages: [],
      configFiles: [],
      priority: 'low',
    });

    return recommendations;
  }

  getRefactorSuggestions(analysis: ProjectAnalysis): RefactorSuggestion[] {
    const suggestions: RefactorSuggestion[] = [];

    const goFiles = analysis.structure.filter(file => file.endsWith('.go'));

    goFiles.forEach(file => {
      // Web framework specific suggestions
      if (analysis.framework.includes('gin')) {
        if (file.includes('handler') || file.includes('controller')) {
          suggestions.push({
            filename: file,
            suggestion:
              'Use gin.Context.ShouldBindJSON() instead of manual JSON parsing',
            type: 'best-practice',
          });
        }
      }

      if (analysis.framework.includes('echo')) {
        if (file.includes('handler')) {
          suggestions.push({
            filename: file,
            suggestion: 'Use echo.Context.Bind() for automatic request binding',
            type: 'best-practice',
          });
        }
      }

      // General Go suggestions
      if (file.includes('_test.go')) {
        suggestions.push({
          filename: file,
          suggestion: 'Use table-driven tests for testing multiple scenarios',
          type: 'maintainability',
        });
        suggestions.push({
          filename: file,
          suggestion:
            'Consider using testify/assert for better test assertions',
          type: 'maintainability',
        });
      }

      // Main file suggestions
      if (file === 'main.go') {
        suggestions.push({
          filename: file,
          suggestion:
            'Keep main.go minimal - move business logic to separate packages',
          type: 'maintainability',
        });
      }

      // Error handling
      if (file.includes('error') || file.includes('err')) {
        suggestions.push({
          filename: file,
          suggestion:
            'Use errors.Is() and errors.As() for error comparison in Go 1.13+',
          type: 'best-practice',
        });
      }
    });

    return suggestions;
  }

  getSpecificPackages(): string[] {
    return [
      'github.com/stretchr/testify',
      'github.com/gin-gonic/gin',
      'github.com/labstack/echo/v4',
      'github.com/gofiber/fiber/v2',
      'github.com/gorilla/mux',
      'github.com/sirupsen/logrus',
      'github.com/spf13/cobra',
      'github.com/spf13/viper',
    ];
  }
}
