import { BasePlugin } from './BasePlugin';
import { ProjectAnalysis, SetupRecommendation, RefactorSuggestion } from '../types';

export class JavaPlugin extends BasePlugin {
  name = 'Java';
  frameworks = ['java', 'spring', 'springboot'];

  canHandle(analysis: ProjectAnalysis): boolean {
    return analysis.language === 'Java' || 
           analysis.configFiles.some(file => 
             file.includes('pom.xml') || 
             file.includes('build.gradle') ||
             file.endsWith('.java')
           );
  }

  getRecommendations(analysis: ProjectAnalysis): SetupRecommendation[] {
    const recommendations: SetupRecommendation[] = [];

    // Checkstyle for code style
    if (!this.hasPackage(analysis, 'checkstyle')) {
      recommendations.push({
        tool: 'checkstyle',
        category: 'code-style',
        reason: 'Enforce consistent Java coding standards and catch style violations',
        packages: ['checkstyle'],
        configFiles: ['checkstyle.xml'],
        priority: 'high'
      });
    }

    // SpotBugs for static analysis
    if (!this.hasPackage(analysis, 'spotbugs')) {
      recommendations.push({
        tool: 'spotbugs',
        category: 'static-analysis',
        reason: 'Find bugs and potential issues in Java bytecode',
        packages: ['spotbugs-maven-plugin', 'spotbugs-gradle-plugin'],
        configFiles: [],
        priority: 'high'
      });
    }

    // JUnit for testing
    if (!this.hasPackage(analysis, 'junit')) {
      recommendations.push({
        tool: 'junit',
        category: 'testing',
        reason: 'Industry standard testing framework for Java',
        packages: ['junit-jupiter', 'junit-jupiter-engine'],
        configFiles: [],
        priority: 'medium'
      });
    }

    // Jacoco for test coverage
    if (!this.hasPackage(analysis, 'jacoco')) {
      recommendations.push({
        tool: 'jacoco',
        category: 'test-coverage',
        reason: 'Measure and report test coverage for Java applications',
        packages: ['jacoco-maven-plugin'],
        configFiles: [],
        priority: 'medium'
      });
    }

    // Maven Enforcer or Gradle equivalent
    if (analysis.packageManager === 'maven') {
      recommendations.push({
        tool: 'maven-enforcer',
        category: 'dependency-management',
        reason: 'Enforce dependency convergence and version consistency',
        packages: ['maven-enforcer-plugin'],
        configFiles: ['pom.xml'],
        priority: 'low'
      });
    }

    return recommendations;
  }

  getRefactorSuggestions(analysis: ProjectAnalysis): RefactorSuggestion[] {
    const suggestions: RefactorSuggestion[] = [];

    const javaFiles = analysis.structure.filter(file => file.endsWith('.java'));

    javaFiles.forEach(file => {
      // Spring specific suggestions
      if (analysis.framework.includes('spring') || analysis.framework.includes('springboot')) {
        if (file.includes('Controller.java')) {
          suggestions.push({
            filename: file,
            suggestion: 'Use @RestController instead of @Controller + @ResponseBody for REST APIs',
            type: 'best-practice'
          });
        }

        if (file.includes('Service.java')) {
          suggestions.push({
            filename: file,
            suggestion: 'Consider using @Transactional for methods that modify data',
            type: 'best-practice'
          });
        }

        if (file.includes('Repository.java')) {
          suggestions.push({
            filename: file,
            suggestion: 'Extend JpaRepository for better query capabilities',
            type: 'performance'
          });
        }
      }

      // General Java suggestions
      if (file.includes('Test.java') || file.includes('Tests.java')) {
        suggestions.push({
          filename: file,
          suggestion: 'Use @ParameterizedTest for testing multiple inputs efficiently',
          type: 'maintainability'
        });
      }

      // Main class suggestions
      if (file.includes('Main.java') || file.includes('Application.java')) {
        suggestions.push({
          filename: file,
          suggestion: 'Consider using dependency injection instead of static dependencies',
          type: 'maintainability'
        });
      }
    });

    return suggestions;
  }

  getSpecificPackages(): string[] {
    return [
      'checkstyle',
      'spotbugs',
      'junit-jupiter',
      'mockito',
      'assertj-core',
      'jacoco-maven-plugin',
      'maven-surefire-plugin',
      'lombok'
    ];
  }
}