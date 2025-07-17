import { Command } from 'commander';
import { t } from '../config/i18n';
import { I18nCommand } from './I18nCommand';

/**
 * Command mapping for i18n translation keys
 */
export const COMMAND_I18N_KEYS: Record<string, { description: string; purpose: string }> = {
  // Main commands
  'quick-analyze': { description: 'commands.quick_analyze.description', purpose: 'commands.quick_analyze.purpose' },
  'setup': { description: 'commands.setup.description', purpose: 'commands.setup.purpose' },
  'tools': { description: 'commands.setup_tools.description', purpose: 'commands.setup_tools.purpose' },
  'ai': { description: 'commands.ai.description', purpose: 'commands.ai.purpose' },
  'ai setup': { description: 'commands.ai_setup.description', purpose: 'commands.ai_setup.purpose' },
  'ai (legacy)': { description: 'commands.ai_legacy.description', purpose: 'commands.ai_legacy.purpose' },
  'llm': { description: 'commands.llm.description', purpose: 'commands.llm.purpose' },
  'update-db': { description: 'commands.update_db.description', purpose: 'commands.update_db.purpose' },
  'watch': { description: 'commands.watch.description', purpose: 'commands.watch.purpose' },
  'status': { description: 'commands.status.description', purpose: 'commands.status.purpose' },
  'update': { description: 'commands.update.description', purpose: 'commands.update.purpose' },
  'stop': { description: 'commands.stop.description', purpose: 'commands.stop.purpose' },
  'logs': { description: 'commands.logs.description', purpose: 'commands.logs.purpose' },
  'recommendations': { description: 'commands.recommendations.description', purpose: 'commands.recommendations.purpose' },
  'helpers': { description: 'commands.helpers.description', purpose: 'commands.helpers.purpose' },
  
  // Documentation commands
  'docu': { description: 'commands.docu.description', purpose: 'commands.docu.purpose' },
  'docu nopro': { description: 'commands.docu_nopro.description', purpose: 'commands.docu_nopro.purpose' },
  'docu pro': { description: 'commands.docu_pro.description', purpose: 'commands.docu_pro.purpose' },
  'docu ai': { description: 'commands.docu_ai.description', purpose: 'commands.docu_ai.purpose' },
  
  'ignore': { description: 'commands.ignore.description', purpose: 'commands.ignore.purpose' },
  
  // Review commands
  'review': { description: 'commands.review.description', purpose: 'commands.review.purpose' },
  'review git': { description: 'commands.review_git.description', purpose: 'commands.review_git.purpose' },
  'review git ai': { description: 'commands.review_git_ai.description', purpose: 'commands.review_git_ai.purpose' },
  'review local': { description: 'commands.review_local.description', purpose: 'commands.review_local.purpose' },
  'review local git': { description: 'commands.review_local_git.description', purpose: 'commands.review_local_git.purpose' },
  'review local ai': { description: 'commands.review_local_ai.description', purpose: 'commands.review_local_ai.purpose' },
  'review path': { description: 'commands.review_path.description', purpose: 'commands.review_path.purpose' },
  'review path ai': { description: 'commands.review_path_ai.description', purpose: 'commands.review_path_ai.purpose' },
  
  // Analysis commands
  'analyze': { description: 'commands.analyze.description', purpose: 'commands.analyze.purpose' },
  'analyze ai': { description: 'commands.analyze_ai.description', purpose: 'commands.analyze_ai.purpose' },
  
  'rollback': { description: 'commands.rollback.description', purpose: 'commands.rollback.purpose' },
  'commands': { description: 'commands.commands.description', purpose: 'commands.commands.purpose' },
  'wiki': { description: 'commands.wiki.description', purpose: 'commands.wiki.purpose' },
  
  // Message commands
  'message': { description: 'commands.message.description', purpose: 'commands.message.purpose' },
  'message all': { description: 'commands.message_all.description', purpose: 'commands.message_all.purpose' },
  'message latest': { description: 'commands.message_latest.description', purpose: 'commands.message_latest.purpose' },
  
  // Logs commands
  'logs main': { description: 'commands.logs_main.description', purpose: 'commands.logs_main.purpose' },
  'logs clear': { description: 'commands.logs_clear.description', purpose: 'commands.logs_clear.purpose' },
  'logs stats': { description: 'commands.logs_stats.description', purpose: 'commands.logs_stats.purpose' },
  
  // Version & config commands
  'version': { description: 'commands.version.description', purpose: 'commands.version.purpose' },
  'check': { description: 'commands.check.description', purpose: 'commands.check.purpose' },
  'update main': { description: 'commands.update_main.description', purpose: 'commands.update_main.purpose' },
  'config': { description: 'commands.config.description', purpose: 'commands.config.purpose' },
  'language': { description: 'commands.language.description', purpose: 'commands.language.purpose' }
};

/**
 * Get all commands from the program recursively
 */
export function getAllCommands(program: Command): Command[] {
  const commands: Command[] = [];
  
  function collectCommands(cmd: Command) {
    commands.push(cmd);
    
    // Get subcommands
    if (cmd.commands && cmd.commands.length > 0) {
      cmd.commands.forEach(subCmd => {
        collectCommands(subCmd);
      });
    }
  }
  
  collectCommands(program);
  return commands;
}

/**
 * Get the command path (e.g., "review git" for nested commands)
 */
export function getCommandPath(cmd: Command): string {
  const parts: string[] = [];
  let current = cmd;
  
  while (current && current.name()) {
    parts.unshift(current.name());
    current = current.parent as Command;
  }
  
  // Remove root program name if it exists
  if (parts.length > 1 && parts[0] === 'woaru') {
    parts.shift();
  }
  
  return parts.join(' ');
}

/**
 * Get translated description for a command
 */
export function getTranslatedDescription(cmd: Command): string {
  const commandPath = getCommandPath(cmd);
  const i18nKeys = COMMAND_I18N_KEYS[commandPath];
  
  if (i18nKeys && i18nKeys.description) {
    return t(i18nKeys.description);
  }
  
  // Fallback to original description
  return cmd.description() || '';
}

/**
 * Get translated purpose for a command
 */
export function getTranslatedPurpose(cmd: Command): string {
  const commandPath = getCommandPath(cmd);
  const i18nKeys = COMMAND_I18N_KEYS[commandPath];
  
  if (i18nKeys && i18nKeys.purpose) {
    return t(i18nKeys.purpose);
  }
  
  return '';
}

/**
 * Generate translated commands output
 */
export function generateTranslatedCommandsOutput(program: Command): string {
  const commands = getAllCommands(program);
  const mainCommands = commands.filter(cmd => 
    cmd.parent === program && cmd.name() !== 'help'
  );
  
  let output = '';
  
  // Main program description
  output += `${t('commands.main.description')}\n\n`;
  output += `${t('commands.main.purpose')}\n\n`;
  
  // Available commands
  output += `📋 ${t('ui.available_commands')}:\n\n`;
  
  for (const cmd of mainCommands) {
    const translatedDesc = getTranslatedDescription(cmd);
    const translatedPurpose = getTranslatedPurpose(cmd);
    
    output += `🔧 ${cmd.name()}\n`;
    output += `   ${translatedDesc}\n`;
    if (translatedPurpose) {
      output += `   💡 ${translatedPurpose}\n`;
    }
    
    // Add subcommands if any
    if (cmd.commands && cmd.commands.length > 0) {
      for (const subCmd of cmd.commands) {
        const subPath = `${cmd.name()} ${subCmd.name()}`;
        const subI18nKeys = COMMAND_I18N_KEYS[subPath];
        
        if (subI18nKeys) {
          output += `   └─ ${subCmd.name()}: ${t(subI18nKeys.description)}\n`;
        } else {
          output += `   └─ ${subCmd.name()}: ${subCmd.description() || ''}\n`;
        }
      }
    }
    
    output += '\n';
  }
  
  return output;
}