import { BasePlugin } from './BasePlugin';
import {
  ProjectAnalysis,
  SetupRecommendation,
  RefactorSuggestion,
} from '../types';

export class NextJsPlugin extends BasePlugin {
  name = 'Next.js';
  frameworks = ['nextjs'];

  canHandle(analysis: ProjectAnalysis): boolean {
    return (
      this.hasPackage(analysis, 'next') ||
      analysis.configFiles.some(file => file.includes('next.config'))
    );
  }

  getRecommendations(analysis: ProjectAnalysis): SetupRecommendation[] {
    const recommendations: SetupRecommendation[] = [];

    // ESLint for Next.js
    if (
      !this.hasPackage(analysis, 'eslint') ||
      !this.hasPackage(analysis, 'eslint-config-next')
    ) {
      recommendations.push({
        tool: 'eslint',
        category: 'linting',
        reason:
          'Next.js has official ESLint configuration with React and Next.js specific rules',
        packages: ['eslint', 'eslint-config-next'],
        configFiles: ['.eslintrc.json'],
        priority: 'high',
      });
    }

    // Prettier
    if (!this.hasPackage(analysis, 'prettier')) {
      const packages = ['prettier'];
      if (this.hasPackage(analysis, 'tailwindcss')) {
        packages.push('prettier-plugin-tailwindcss');
      }

      recommendations.push({
        tool: 'prettier',
        category: 'formatting',
        reason: 'Code formatting for consistent style across the team',
        packages,
        configFiles: ['.prettierrc'],
        priority: 'high',
      });
    }

    // Husky + Lint-Staged
    if (!this.hasPackage(analysis, 'husky')) {
      recommendations.push({
        tool: 'husky',
        category: 'git-hooks',
        reason: 'Pre-commit hooks to ensure code quality before commits',
        packages: ['husky', 'lint-staged'],
        configFiles: ['.husky/pre-commit', 'package.json'],
        priority: 'medium',
      });
    }

    // TypeScript strict mode
    if (
      this.hasPackage(analysis, 'typescript') &&
      analysis.language === 'TypeScript'
    ) {
      recommendations.push({
        tool: 'typescript-strict',
        category: 'type-checking',
        reason: 'Enable strict TypeScript checking for better type safety',
        packages: [],
        configFiles: ['tsconfig.json'],
        priority: 'medium',
      });
    }

    // Next.js Bundle Analyzer
    if (!this.hasPackage(analysis, '@next/bundle-analyzer')) {
      recommendations.push({
        tool: '@next/bundle-analyzer',
        category: 'optimization',
        reason: 'Analyze bundle size and optimize for performance',
        packages: ['@next/bundle-analyzer'],
        configFiles: ['next.config.js'],
        priority: 'low',
      });
    }

    return recommendations;
  }

  getRefactorSuggestions(analysis: ProjectAnalysis): RefactorSuggestion[] {
    const suggestions: RefactorSuggestion[] = [];

    // Look for common Next.js patterns that could be improved
    const hookFiles = analysis.structure.filter(
      file =>
        (file.includes('/hooks/') && file.endsWith('.ts')) ||
        file.endsWith('.tsx')
    );

    hookFiles.forEach(file => {
      suggestions.push({
        filename: file,
        suggestion:
          'Use useCallback for event handlers to prevent unnecessary re-renders',
        type: 'performance',
      });
    });

    // Component suggestions
    const componentFiles = analysis.structure.filter(
      file =>
        file.includes('/components/') &&
        (file.endsWith('.tsx') || file.endsWith('.jsx'))
    );

    componentFiles.forEach(file => {
      if (
        file.toLowerCase().includes('todo') ||
        file.toLowerCase().includes('item')
      ) {
        suggestions.push({
          filename: file,
          suggestion:
            'Consider using React.memo for components that receive props to optimize re-renders',
          type: 'performance',
        });
      }
    });

    // Next.js specific suggestions
    if (
      analysis.structure.some(
        file => file.includes('pages/') || file.includes('app/')
      )
    ) {
      suggestions.push({
        filename: 'pages/index.tsx',
        suggestion:
          'Consider using getStaticProps or getServerSideProps for data fetching optimization',
        type: 'performance',
      });
    }

    return suggestions;
  }

  getSpecificPackages(): string[] {
    return [
      'next-seo',
      '@next/bundle-analyzer',
      'next-auth',
      '@vercel/analytics',
    ];
  }
}
