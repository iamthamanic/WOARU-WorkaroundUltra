import { BasePlugin } from './BasePlugin';
import {
  ProjectAnalysis,
  SetupRecommendation,
  RefactorSuggestion,
} from '../types';

export class PythonPlugin extends BasePlugin {
  name = 'Python';
  frameworks = ['python'];

  canHandle(analysis: ProjectAnalysis): boolean {
    return (
      analysis.language === 'Python' ||
      analysis.configFiles.some(
        file =>
          file.includes('requirements.txt') ||
          file.includes('setup.py') ||
          file.includes('pyproject.toml')
      )
    );
  }

  getRecommendations(analysis: ProjectAnalysis): SetupRecommendation[] {
    const recommendations: SetupRecommendation[] = [];

    // Black formatter
    if (!this.hasPackage(analysis, 'black')) {
      recommendations.push({
        tool: 'black',
        category: 'formatting',
        reason: 'The uncompromising Python code formatter',
        packages: ['black'],
        configFiles: ['pyproject.toml'],
        priority: 'high',
      });
    }

    // Flake8 or Ruff linter
    if (
      !this.hasPackage(analysis, 'flake8') &&
      !this.hasPackage(analysis, 'ruff')
    ) {
      recommendations.push({
        tool: 'ruff',
        category: 'linting',
        reason: 'Extremely fast Python linter, written in Rust',
        packages: ['ruff'],
        configFiles: ['pyproject.toml', '.ruff.toml'],
        priority: 'high',
      });
    }

    // pytest
    if (!this.hasPackage(analysis, 'pytest')) {
      recommendations.push({
        tool: 'pytest',
        category: 'testing',
        reason: 'Simple powerful testing with Python',
        packages: ['pytest', 'pytest-cov'],
        configFiles: ['pytest.ini', 'pyproject.toml'],
        priority: 'medium',
      });
    }

    // mypy for type checking
    if (!this.hasPackage(analysis, 'mypy')) {
      recommendations.push({
        tool: 'mypy',
        category: 'type-checking',
        reason: 'Static type checker for Python',
        packages: ['mypy'],
        configFiles: ['mypy.ini', 'pyproject.toml'],
        priority: 'medium',
      });
    }

    // pre-commit
    if (!this.hasConfigFile(analysis, '.pre-commit-config.yaml')) {
      recommendations.push({
        tool: 'pre-commit',
        category: 'git-hooks',
        reason: 'Git hook scripts for identifying issues before submission',
        packages: ['pre-commit'],
        configFiles: ['.pre-commit-config.yaml'],
        priority: 'medium',
      });
    }

    // Poetry for dependency management
    if (
      !this.hasConfigFile(analysis, 'poetry.lock') &&
      !this.hasConfigFile(analysis, 'Pipfile')
    ) {
      recommendations.push({
        tool: 'poetry',
        category: 'dependency-management',
        reason: 'Modern dependency management for Python',
        packages: [],
        configFiles: ['pyproject.toml', 'poetry.lock'],
        priority: 'low',
      });
    }

    return recommendations;
  }

  getRefactorSuggestions(analysis: ProjectAnalysis): RefactorSuggestion[] {
    const suggestions: RefactorSuggestion[] = [];

    // Look for Python files
    const pythonFiles = analysis.structure.filter(file => file.endsWith('.py'));

    pythonFiles.forEach(file => {
      // Django specific
      if (analysis.framework.includes('django')) {
        if (file.includes('views.py')) {
          suggestions.push({
            filename: file,
            suggestion:
              'Consider using Django class-based views for better code reuse',
            type: 'maintainability',
          });
        }
        if (file.includes('models.py')) {
          suggestions.push({
            filename: file,
            suggestion:
              'Add proper __str__ methods to models for better debugging',
            type: 'maintainability',
          });
        }
      }

      // Flask specific
      if (analysis.framework.includes('flask')) {
        if (file.includes('app.py') || file.includes('__init__.py')) {
          suggestions.push({
            filename: file,
            suggestion: 'Consider using Flask blueprints for better modularity',
            type: 'maintainability',
          });
        }
      }

      // General Python suggestions
      if (file.includes('test_') || file.includes('_test.py')) {
        suggestions.push({
          filename: file,
          suggestion:
            'Use pytest fixtures for better test organization and reuse',
          type: 'best-practice',
        });
      }

      // Main files
      if (file.endsWith('__main__.py') || file === 'main.py') {
        suggestions.push({
          filename: file,
          suggestion:
            'Add if __name__ == "__main__": guard for better modularity',
          type: 'best-practice',
        });
      }
    });

    return suggestions;
  }

  getSpecificPackages(): string[] {
    return [
      'black',
      'ruff',
      'pytest',
      'pytest-cov',
      'mypy',
      'pre-commit',
      'poetry',
      'ipython',
      'jupyter',
    ];
  }
}
