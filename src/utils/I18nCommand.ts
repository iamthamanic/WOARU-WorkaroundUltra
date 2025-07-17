import { Command } from 'commander';
import { t } from '../config/i18n';

/**
 * Extended Command class with i18n support for Just-in-Time translation
 */
export class I18nCommand extends Command {
  private i18nKeys: {
    description?: string;
    purpose?: string;
    helpText?: string;
  } = {};

  /**
   * Set i18n translation keys for this command
   */
  setI18nKeys(keys: {
    description?: string;
    purpose?: string;
    helpText?: string;
  }): this {
    this.i18nKeys = { ...this.i18nKeys, ...keys };
    return this;
  }

  /**
   * Get the translated description
   */
  getTranslatedDescription(): string {
    if (this.i18nKeys.description) {
      return t(this.i18nKeys.description);
    }
    return this.description() || '';
  }

  /**
   * Get the translated purpose
   */
  getTranslatedPurpose(): string {
    if (this.i18nKeys.purpose) {
      return t(this.i18nKeys.purpose);
    }
    return '';
  }

  /**
   * Get the translated help text
   */
  getTranslatedHelpText(): string {
    if (this.i18nKeys.helpText) {
      return t(this.i18nKeys.helpText);
    }
    return '';
  }

  /**
   * Get all i18n keys for this command
   */
  getI18nKeys(): typeof this.i18nKeys {
    return this.i18nKeys;
  }

  /**
   * Override createCommand to return I18nCommand instances
   */
  createCommand(name?: string): I18nCommand {
    return new I18nCommand(name);
  }
}

/**
 * Create a new i18n-enabled command
 */
export function createI18nCommand(name?: string): I18nCommand {
  return new I18nCommand(name);
}