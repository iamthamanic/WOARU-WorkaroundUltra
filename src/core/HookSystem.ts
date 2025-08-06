import { EventEmitter } from 'events';

/**
 * 🎣 WOARU Hook System - Event-basierte Erweiterbarkeit
 *
 * Das Hook-System macht den QualityRunner und andere Komponenten modularer
 * und ermöglicht die einfache Erweiterung der Analyse-Pipeline.
 *
 * Teil der "KI-freundlichen Regelwelt" - definierte Erweiterungspunkte.
 */

// Hook Event Types
export type HookEvent =
  | 'beforeAnalysis'
  | 'afterAnalysis'
  | 'beforeFileAnalysis'
  | 'afterFileAnalysis'
  | 'beforeToolExecution'
  | 'afterToolExecution'
  | 'onError'
  | 'onConfigLoad'
  | 'onReportGeneration';

// Hook Data Interfaces
export interface BeforeAnalysisData {
  files: string[];
  projectPath: string;
  config: any;
  timestamp: Date;
}

export interface AfterAnalysisData {
  files: string[];
  results: any[];
  duration: number;
  timestamp: Date;
  success: boolean;
}

export interface BeforeFileAnalysisData {
  filePath: string;
  language: string;
  fileSize: number;
  timestamp: Date;
}

export interface AfterFileAnalysisData {
  filePath: string;
  language: string;
  results: any[];
  duration: number;
  timestamp: Date;
  success: boolean;
}

export interface BeforeToolExecutionData {
  toolName: string;
  filePath: string;
  command: string;
  timestamp: Date;
}

export interface AfterToolExecutionData {
  toolName: string;
  filePath: string;
  command: string;
  output: string;
  exitCode: number;
  duration: number;
  timestamp: Date;
  success: boolean;
}

export interface ErrorHookData {
  error: Error;
  context: string;
  filePath?: string;
  toolName?: string;
  timestamp: Date;
}

export interface ConfigLoadHookData {
  configType: 'ai' | 'tools' | 'user';
  configPath: string;
  configData: any;
  timestamp: Date;
}

export interface ReportGenerationData {
  reportType: string;
  data: any;
  outputPath?: string;
  timestamp: Date;
}

// Union type for all hook data
export type HookData =
  | BeforeAnalysisData
  | AfterAnalysisData
  | BeforeFileAnalysisData
  | AfterFileAnalysisData
  | BeforeToolExecutionData
  | AfterToolExecutionData
  | ErrorHookData
  | ConfigLoadHookData
  | ReportGenerationData;

// Hook Handler Function Type
export type HookHandler<T extends HookData = HookData> = (
  data: T
) => Promise<void> | void;

/**
 * 🎣 WOARU Hook Manager
 *
 * Zentrale Verwaltung für alle Hook-Registrierungen und -Ausführungen.
 * Basiert auf Node.js EventEmitter für maximale Kompatibilität.
 */
export class HookManager extends EventEmitter {
  private static instance: HookManager;
  private hookStats: Map<HookEvent, number> = new Map();
  private debugMode: boolean = false;

  private constructor() {
    super();
    this.setMaxListeners(50); // Erlaube mehr Listeners für extensible architecture
  }

  static getInstance(): HookManager {
    if (!HookManager.instance) {
      HookManager.instance = new HookManager();
    }
    return HookManager.instance;
  }

  /**
   * 🔗 Hook registrieren
   *
   * @param event Hook-Event Name
   * @param handler Handler-Funktion
   * @param priority Priorität (höhere Zahl = frühere Ausführung)
   */
  registerHook<T extends HookData>(
    event: HookEvent,
    handler: HookHandler<T>,
    priority: number = 0
  ): void {
    const wrappedHandler = async (data: T) => {
      try {
        if (this.debugMode) {
          console.log(`🎣 Executing hook: ${event} (priority: ${priority})`);
        }
        await handler(data);
        this.incrementHookStats(event);
      } catch (error) {
        console.error(`❌ Hook execution failed for ${event}:`, error);
        // Emit error hook if it's not already an error hook to prevent loops
        if (event !== 'onError') {
          this.triggerHook('onError', {
            error: error as Error,
            context: `Hook execution: ${event}`,
            timestamp: new Date(),
          });
        }
      }
    };

    // Store priority for sorting
    (wrappedHandler as any).__priority = priority;

    this.on(event, wrappedHandler);

    if (this.debugMode) {
      console.log(`🎣 Registered hook: ${event} (priority: ${priority})`);
    }
  }

  /**
   * 🚀 Hook auslösen
   *
   * Alle registrierten Handler für das Event werden parallel ausgeführt,
   * sortiert nach Priorität (höchste zuerst).
   *
   * @param event Hook-Event Name
   * @param data Event-Daten
   */
  async triggerHook<T extends HookData>(
    event: HookEvent,
    data: T
  ): Promise<void> {
    if (this.debugMode) {
      console.log(`🎣 Triggering hook: ${event}`);
    }

    const listeners = this.listeners(event);

    if (listeners.length === 0) {
      if (this.debugMode) {
        console.log(`🎣 No handlers registered for: ${event}`);
      }
      return;
    }

    // Sort by priority (höchste zuerst)
    const sortedListeners = listeners.sort((a: any, b: any) => {
      const priorityA = a.__priority || 0;
      const priorityB = b.__priority || 0;
      return priorityB - priorityA;
    });

    // Execute all handlers in parallel
    const promises = sortedListeners.map(listener =>
      (listener as Function)(data)
    );

    try {
      await Promise.all(promises);
      if (this.debugMode) {
        console.log(
          `🎣 Hook completed: ${event} (${listeners.length} handlers)`
        );
      }
    } catch (error) {
      console.error(`❌ Hook execution error for ${event}:`, error);
      throw error;
    }
  }

  /**
   * 🗑️ Hook entfernen
   */
  unregisterHook(event: HookEvent, handler: HookHandler): void {
    this.removeListener(event, handler);
    if (this.debugMode) {
      console.log(`🎣 Unregistered hook: ${event}`);
    }
  }

  /**
   * 🧹 Alle Hooks eines Events entfernen
   */
  clearHooks(event?: HookEvent): void {
    if (event) {
      this.removeAllListeners(event);
      if (this.debugMode) {
        console.log(`🎣 Cleared all hooks for: ${event}`);
      }
    } else {
      this.removeAllListeners();
      this.hookStats.clear();
      if (this.debugMode) {
        console.log('🎣 Cleared all hooks');
      }
    }
  }

  /**
   * 📊 Hook-Statistiken
   */
  getHookStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [event, count] of this.hookStats.entries()) {
      stats[event] = count;
    }
    return stats;
  }

  /**
   * 📋 Registrierte Hooks auflisten
   */
  listRegisteredHooks(): Record<string, number> {
    const hooks: Record<string, number> = {};
    const events: HookEvent[] = [
      'beforeAnalysis',
      'afterAnalysis',
      'beforeFileAnalysis',
      'afterFileAnalysis',
      'beforeToolExecution',
      'afterToolExecution',
      'onError',
      'onConfigLoad',
      'onReportGeneration',
    ];

    for (const event of events) {
      hooks[event] = this.listenerCount(event);
    }

    return hooks;
  }

  /**
   * 🐛 Debug-Modus umschalten
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    console.log(`🎣 Hook debug mode: ${enabled ? 'enabled' : 'disabled'}`);
  }

  private incrementHookStats(event: HookEvent): void {
    const current = this.hookStats.get(event) || 0;
    this.hookStats.set(event, current + 1);
  }
}

/**
 * 🎯 Hook Utilities - Hilfs-Funktionen für häufige Hook-Patterns
 */
export class HookUtils {
  /**
   * Erstelle einen Hook-Handler mit automatischem Error-Handling
   */
  static createSafeHandler<T extends HookData>(
    handler: HookHandler<T>,
    context: string
  ): HookHandler<T> {
    return async (data: T) => {
      try {
        await handler(data);
      } catch (error) {
        console.error(`❌ Hook handler error in ${context}:`, error);
        // Don't re-throw to prevent breaking the entire hook chain
      }
    };
  }

  /**
   * Erstelle einen konditionalen Hook-Handler
   */
  static createConditionalHandler<T extends HookData>(
    condition: (data: T) => boolean,
    handler: HookHandler<T>
  ): HookHandler<T> {
    return async (data: T) => {
      if (condition(data)) {
        await handler(data);
      }
    };
  }

  /**
   * Erstelle einen Rate-Limited Hook-Handler
   */
  static createRateLimitedHandler<T extends HookData>(
    handler: HookHandler<T>,
    intervalMs: number
  ): HookHandler<T> {
    let lastExecuted = 0;

    return async (data: T) => {
      const now = Date.now();
      if (now - lastExecuted >= intervalMs) {
        lastExecuted = now;
        await handler(data);
      }
    };
  }
}

// Global Hook Manager Instance Export
export const hookManager = HookManager.getInstance();

// Convenience functions for common operations
export const registerHook = <T extends HookData>(
  event: HookEvent,
  handler: HookHandler<T>,
  priority?: number
) => hookManager.registerHook(event, handler, priority);

export const triggerHook = <T extends HookData>(event: HookEvent, data: T) =>
  hookManager.triggerHook(event, data);

export const unregisterHook = (event: HookEvent, handler: HookHandler) =>
  hookManager.unregisterHook(event, handler);

export const clearHooks = (event?: HookEvent) => hookManager.clearHooks(event);
