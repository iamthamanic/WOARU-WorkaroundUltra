import {
  ProjectAnalysis,
  SetupRecommendation,
  RefactorSuggestion,
} from '../types';

export abstract class BasePlugin {
  abstract name: string;
  abstract frameworks: string[];

  abstract canHandle(analysis: ProjectAnalysis): boolean;
  abstract getRecommendations(analysis: ProjectAnalysis): SetupRecommendation[];
  abstract getRefactorSuggestions(
    analysis: ProjectAnalysis
  ): RefactorSuggestion[];
  abstract getSpecificPackages(): string[];

  protected hasPackage(
    analysis: ProjectAnalysis,
    packageName: string
  ): boolean {
    return (
      analysis.dependencies.includes(packageName) ||
      analysis.devDependencies.includes(packageName)
    );
  }

  protected hasConfigFile(
    analysis: ProjectAnalysis,
    fileName: string
  ): boolean {
    return analysis.configFiles.some(file => file.includes(fileName));
  }

  protected hasScript(analysis: ProjectAnalysis, scriptName: string): boolean {
    return Object.keys(analysis.scripts).includes(scriptName);
  }
}
