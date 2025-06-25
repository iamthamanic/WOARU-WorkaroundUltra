import { BasePlugin } from './BasePlugin';
import { NextJsPlugin } from './NextJsPlugin';
import { PythonPlugin } from './PythonPlugin';
import { CSharpPlugin } from './CSharpPlugin';
import { JavaPlugin } from './JavaPlugin';
import { GoPlugin } from './GoPlugin';
import { RustPlugin } from './RustPlugin';
import { ProjectAnalysis, SetupRecommendation, RefactorSuggestion } from '../types';

export class PluginManager {
  private plugins: BasePlugin[] = [];

  constructor() {
    this.registerPlugin(new NextJsPlugin());
    this.registerPlugin(new PythonPlugin());
    this.registerPlugin(new CSharpPlugin());
    this.registerPlugin(new JavaPlugin());
    this.registerPlugin(new GoPlugin());
    this.registerPlugin(new RustPlugin());
    // Add more plugins here as they're created
  }

  private registerPlugin(plugin: BasePlugin): void {
    this.plugins.push(plugin);
  }

  getApplicablePlugins(analysis: ProjectAnalysis): BasePlugin[] {
    return this.plugins.filter(plugin => plugin.canHandle(analysis));
  }

  getAllRecommendations(analysis: ProjectAnalysis): SetupRecommendation[] {
    const applicablePlugins = this.getApplicablePlugins(analysis);
    const allRecommendations: SetupRecommendation[] = [];

    applicablePlugins.forEach(plugin => {
      const recommendations = plugin.getRecommendations(analysis);
      allRecommendations.push(...recommendations);
    });

    // Remove duplicates based on tool name
    const uniqueRecommendations = allRecommendations.filter((rec, index, self) => 
      index === self.findIndex(r => r.tool === rec.tool)
    );

    // Sort by priority
    return uniqueRecommendations.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  getAllRefactorSuggestions(analysis: ProjectAnalysis): RefactorSuggestion[] {
    const applicablePlugins = this.getApplicablePlugins(analysis);
    const allSuggestions: RefactorSuggestion[] = [];

    applicablePlugins.forEach(plugin => {
      const suggestions = plugin.getRefactorSuggestions(analysis);
      allSuggestions.push(...suggestions);
    });

    return allSuggestions;
  }

  getAllSpecificPackages(analysis: ProjectAnalysis): string[] {
    const applicablePlugins = this.getApplicablePlugins(analysis);
    const allPackages: string[] = [];

    applicablePlugins.forEach(plugin => {
      const packages = plugin.getSpecificPackages();
      allPackages.push(...packages);
    });

    return [...new Set(allPackages)]; // Remove duplicates
  }
}