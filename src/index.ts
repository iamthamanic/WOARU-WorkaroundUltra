export { WAUEngine } from './core/WAUEngine';
export { ProjectAnalyzer } from './analyzer/ProjectAnalyzer';
export { LanguageDetector } from './analyzer/LanguageDetector';
export { CodeAnalyzer } from './analyzer/CodeAnalyzer';
export { DatabaseManager } from './database/DatabaseManager';
export { PluginManager } from './plugins/PluginManager';
export { ActionManager } from './actions/ActionManager';

// Supervisor exports
export { WAUSupervisor } from './supervisor/WAUSupervisor';
export { StateManager } from './supervisor/StateManager';
export { FileWatcher } from './supervisor/FileWatcher';
export { NotificationManager } from './supervisor/NotificationManager';
export { ToolRecommendationEngine } from './supervisor/ToolRecommendationEngine';

export * from './types';
export * from './supervisor/types';

// Re-export plugins
export { BasePlugin } from './plugins/BasePlugin';
export { NextJsPlugin } from './plugins/NextJsPlugin';

// Re-export actions
export { BaseAction } from './actions/BaseAction';
export { PrettierAction } from './actions/PrettierAction';
export { EslintAction } from './actions/EslintAction';
export { HuskyAction } from './actions/HuskyAction';