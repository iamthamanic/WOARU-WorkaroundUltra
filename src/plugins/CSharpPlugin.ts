import { BasePlugin } from './BasePlugin';
import { ProjectAnalysis, SetupRecommendation, RefactorSuggestion } from '../types';

export class CSharpPlugin extends BasePlugin {
  name = 'C#';
  frameworks = ['csharp', 'dotnet'];

  canHandle(analysis: ProjectAnalysis): boolean {
    return analysis.language === 'C#' || 
           analysis.configFiles.some(file => 
             file.endsWith('.csproj') || 
             file.endsWith('.sln')
           );
  }

  getRecommendations(analysis: ProjectAnalysis): SetupRecommendation[] {
    const recommendations: SetupRecommendation[] = [];

    // StyleCop Analyzers
    if (!analysis.configFiles.includes('.editorconfig')) {
      recommendations.push({
        tool: 'editorconfig',
        category: 'formatting',
        reason: 'Maintain consistent coding styles across different editors',
        packages: [],
        configFiles: ['.editorconfig'],
        priority: 'high'
      });
    }

    // Code analysis
    recommendations.push({
      tool: 'dotnet-format',
      category: 'formatting',
      reason: 'Code formatter for .NET projects',
      packages: [],
      configFiles: [],
      priority: 'high'
    });

    // xUnit for testing
    if (!this.hasPackage(analysis, 'xunit')) {
      recommendations.push({
        tool: 'xunit',
        category: 'testing',
        reason: 'Modern testing framework for .NET',
        packages: ['xunit', 'xunit.runner.visualstudio'],
        configFiles: [],
        priority: 'medium'
      });
    }

    // SonarAnalyzer
    recommendations.push({
      tool: 'sonaranalyzer',
      category: 'code-quality',
      reason: 'Code quality and security analysis for C#',
      packages: ['SonarAnalyzer.CSharp'],
      configFiles: [],
      priority: 'medium'
    });

    // Husky.Net for git hooks
    recommendations.push({
      tool: 'husky.net',
      category: 'git-hooks',
      reason: '.NET version of Husky for git hooks',
      packages: ['Husky'],
      configFiles: ['.husky/task-runner.json'],
      priority: 'low'
    });

    return recommendations;
  }

  getRefactorSuggestions(analysis: ProjectAnalysis): RefactorSuggestion[] {
    const suggestions: RefactorSuggestion[] = [];

    const csharpFiles = analysis.structure.filter(file => file.endsWith('.cs'));

    csharpFiles.forEach(file => {
      // ASP.NET specific
      if (analysis.framework.includes('aspnet')) {
        if (file.includes('Controller.cs')) {
          suggestions.push({
            filename: file,
            suggestion: 'Consider using async/await for all database operations',
            type: 'performance'
          });
          suggestions.push({
            filename: file,
            suggestion: 'Use dependency injection for services instead of static calls',
            type: 'best-practice'
          });
        }
      }

      // Entity Framework
      if (file.includes('DbContext') || file.includes('Context.cs')) {
        suggestions.push({
          filename: file,
          suggestion: 'Use IQueryable for better query performance with Entity Framework',
          type: 'performance'
        });
      }

      // General C# patterns
      if (file.includes('Service.cs') || file.includes('Repository.cs')) {
        suggestions.push({
          filename: file,
          suggestion: 'Implement interfaces for better testability and loose coupling',
          type: 'maintainability'
        });
      }

      // Test files
      if (file.includes('Test.cs') || file.includes('Tests.cs')) {
        suggestions.push({
          filename: file,
          suggestion: 'Use AAA pattern (Arrange, Act, Assert) for test organization',
          type: 'best-practice'
        });
      }
    });

    return suggestions;
  }

  getSpecificPackages(): string[] {
    return [
      'StyleCop.Analyzers',
      'SonarAnalyzer.CSharp',
      'xunit',
      'Moq',
      'FluentAssertions',
      'Serilog',
      'AutoMapper',
      'FluentValidation'
    ];
  }
}