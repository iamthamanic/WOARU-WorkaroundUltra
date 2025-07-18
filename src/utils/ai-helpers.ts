import chalk from 'chalk';
import { ConfigManager } from '../config/ConfigManager';

/**
 * Zentrale Hilfsfunktion für AI Pre-Condition Checks
 * Prüft, ob mindestens ein AI-Provider konfiguriert und aktiv ist
 */
export async function ensureAiIsConfigured(): Promise<void> {
  try {
    const configManager = ConfigManager.getInstance();
    const aiConfig = await configManager.loadAiConfig();
    
    // Prüfe ob AI-Konfiguration existiert
    if (!aiConfig || Object.keys(aiConfig).length <= 1) {
      showAiConfigurationError();
      process.exit(1);
    }
    
    // Prüfe ob mindestens ein Provider aktiviert ist
    const enabledProviders = Object.entries(aiConfig)
      .filter(([key, value]: [string, any]) => 
        key !== 'lastDataUpdate' && 
        value && 
        value.enabled === true
      );
    
    if (enabledProviders.length === 0) {
      showAiConfigurationError();
      process.exit(1);
    }
    
    // Prüfe ob mindestens ein aktivierter Provider einen API-Key hat (in .env)
    let hasValidApiKey = false;
    
    for (const [providerId, provider] of enabledProviders) {
      if (provider && await configManager.hasApiKey(providerId)) {
        hasValidApiKey = true;
        break;
      }
    }
    
    if (!hasValidApiKey) {
      showAiConfigurationError();
      process.exit(1);
    }
    
    // Alle Checks bestanden - AI ist konfiguriert
    return;
    
  } catch (error) {
    console.error(chalk.red('❌ Fehler beim Prüfen der AI-Konfiguration:'), error);
    showAiConfigurationError();
    process.exit(1);
  }
}

/**
 * Zeigt die standardisierte Fehlermeldung für fehlende AI-Konfiguration
 */
function showAiConfigurationError(): void {
  console.error(chalk.red('❌ Fehler: Dieses Feature erfordert eine aktive und korrekt konfigurierte AI.'));
  console.error(chalk.cyan('💡 Bitte richte zuerst einen AI-Provider ein mit dem Befehl: woaru ai setup'));
}

/**
 * Hilfsfunktion zur Validierung eines einzelnen AI-Providers
 */
export async function validateAiProvider(providerId: string, provider: any): Promise<boolean> {
  if (!provider || provider.enabled !== true) {
    return false;
  }
  
  const configManager = ConfigManager.getInstance();
  return await configManager.hasApiKey(providerId);
}

/**
 * Hilfsfunktion um alle aktiven AI-Provider zu erhalten
 */
export async function getActiveAiProviders(): Promise<Array<{id: string, provider: any}>> {
  try {
    const configManager = ConfigManager.getInstance();
    const aiConfig = await configManager.loadAiConfig();
    
    if (!aiConfig) {
      return [];
    }
    
    const activeProviders: Array<{id: string, provider: any}> = [];
    
    for (const [id, provider] of Object.entries(aiConfig)) {
      if (id !== 'lastDataUpdate' && await validateAiProvider(id, provider)) {
        activeProviders.push({ id, provider });
      }
    }
    
    return activeProviders;
      
  } catch (error) {
    console.warn(chalk.yellow('⚠️ Warnung: Fehler beim Laden der AI-Provider:', error));
    return [];
  }
}