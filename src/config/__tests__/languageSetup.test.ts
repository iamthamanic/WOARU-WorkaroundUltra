import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import chalk from 'chalk';
import inquirer from 'inquirer';

// Mock dependencies
jest.mock('inquirer');
jest.mock('chalk', () => ({
  cyan: jest.fn((text: string) => text),
  yellow: jest.fn((text: string) => text),
  green: jest.fn((text: string) => text),
  gray: jest.fn((text: string) => text),
  red: jest.fn((text: string) => text),
}));

jest.mock('../i18n', () => ({
  SupportedLanguage: jest.fn(),
  SUPPORTED_LANGUAGES: ['en', 'de'],
  LANGUAGE_NAMES: {
    en: '🇺🇸 English',
    de: '🇩🇪 Deutsch'
  },
  setUserLanguage: jest.fn(),
  isFirstRun: jest.fn(),
  t: jest.fn((key: string, params?: any) => {
    // Mock translation function with comprehensive key mapping
    const translations: Record<string, string> = {
      'language_setup.welcome_multilingual': '🌍 Welcome to WOARU',
      'language_setup.first_time_message': '🚀 First time running WOARU! Let\'s set up your language preference.',
      'language_setup.language_set_confirmation': '✅ Language set to {{language}}! WOARU is now ready.',
      'language_setup.change_language_hint': '💡 You can change your language anytime with: woaru config set language <en|de>',
      'language_setup.current_configuration': '🌍 Language Configuration:',
      'language_setup.current_language_display': 'Current: {{name}} ({{code}})',
      'language_setup.available_languages_display': 'Available: {{languages}}',
      'language_setup.change_command_hint': 'Change with: woaru config set language <{{options}}>',
      'language_selection.prompt': 'Please select your preferred language:',
    };
    
    let result = translations[key] || key;
    
    // Handle parameter interpolation
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        result = result.replace(`{{${paramKey}}}`, String(value));
      });
    }
    
    return result;
  }),
  initializeI18n: jest.fn(),
  getUserLanguage: jest.fn(),
}));

import {
  promptLanguageSelection,
  handleFirstTimeLanguageSetup,
  showLanguageStatus
} from '../languageSetup';

const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
import { setUserLanguage, isFirstRun, t, initializeI18n, getUserLanguage } from '../i18n';

describe('languageSetup - Production Quality Tests', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Setup console spies
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock returns
    initializeI18n.mockResolvedValue(undefined);
    setUserLanguage.mockResolvedValue(undefined);
    getUserLanguage.mockResolvedValue('en');
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('promptLanguageSelection', () => {
    it('should successfully prompt for language selection with valid input', async () => {
      // Arrange
      mockedInquirer.prompt.mockResolvedValue({ language: 'en' });

      // Act
      const result = await promptLanguageSelection();

      // Assert
      expect(result).toBe('en');
      expect(initializeI18n).toHaveBeenCalledTimes(1);
      expect(t).toHaveBeenCalledWith('language_setup.welcome_multilingual');
      expect(mockedInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'language',
          choices: [
            { name: '🇺🇸 English (en)', value: 'en' },
            { name: '🇩🇪 Deutsch (de)', value: 'de' }
          ],
          default: 'en'
        })
      ]);
    });

    it('should handle German language selection', async () => {
      // Arrange
      mockedInquirer.prompt.mockResolvedValue({ language: 'de' });

      // Act
      const result = await promptLanguageSelection();

      // Assert
      expect(result).toBe('de');
    });

    it('should throw error for invalid language selection', async () => {
      // Arrange
      mockedInquirer.prompt.mockResolvedValue({ language: 'invalid' });

      // Act & Assert
      await expect(promptLanguageSelection()).rejects.toThrow('Invalid language selection: invalid');
    });

    it('should sanitize malicious input', async () => {
      // Arrange
      const maliciousInput = '<script>alert("xss")</script>';
      mockedInquirer.prompt.mockResolvedValue({ language: maliciousInput });

      // Act & Assert
      await expect(promptLanguageSelection()).rejects.toThrow('Invalid language selection: scriptalert(xss)/script');
    });
  });

  describe('handleFirstTimeLanguageSetup', () => {
    it('should complete first-time setup successfully', async () => {
      // Arrange
      isFirstRun.mockResolvedValue(true);
      mockedInquirer.prompt.mockResolvedValue({ language: 'en' });

      // Act
      await handleFirstTimeLanguageSetup();

      // Assert
      expect(isFirstRun).toHaveBeenCalledTimes(1);
      expect(t).toHaveBeenCalledWith('language_setup.first_time_message');
      expect(setUserLanguage).toHaveBeenCalledWith('en');
      expect(t).toHaveBeenCalledWith('language_setup.language_set_confirmation', 
        { language: '🇺🇸 English' });
    });

    it('should skip setup if not first run', async () => {
      // Arrange
      isFirstRun.mockResolvedValue(false);

      // Act
      await handleFirstTimeLanguageSetup();

      // Assert
      expect(setUserLanguage).not.toHaveBeenCalled();
      expect(mockedInquirer.prompt).not.toHaveBeenCalled();
    });

    it('should handle language save errors gracefully', async () => {
      // Arrange
      isFirstRun.mockResolvedValue(true);
      mockedInquirer.prompt.mockResolvedValue({ language: 'en' });
      setUserLanguage.mockRejectedValue(new Error('Save failed'));

      // Act
      await handleFirstTimeLanguageSetup();

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save language preference:'),
        expect.any(Error)
      );
    });

    it('should fall back to English on critical errors', async () => {
      // Arrange
      isFirstRun.mockResolvedValue(true);
      mockedInquirer.prompt.mockRejectedValue(new Error('Critical failure'));

      // Act
      await handleFirstTimeLanguageSetup();

      // Assert
      expect(setUserLanguage).toHaveBeenCalledWith('en');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Falling back to English language...')
      );
    });
  });

  describe('showLanguageStatus', () => {
    it('should display current language status correctly', async () => {
      // Arrange
      getUserLanguage.mockResolvedValue('en');

      // Act
      await showLanguageStatus();

      // Assert
      expect(initializeI18n).toHaveBeenCalledTimes(1);
      expect(t).toHaveBeenCalledWith('language_setup.current_configuration');
      expect(t).toHaveBeenCalledWith('language_setup.current_language_display', {
        name: '🇺🇸 English',
        code: 'en'
      });
    });

    it('should handle invalid current language gracefully', async () => {
      // Arrange
      getUserLanguage.mockResolvedValue('invalid');

      // Act
      await showLanguageStatus();

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid current language: invalid')
      );
    });

    it('should provide fallback display on errors', async () => {
      // Arrange
      getUserLanguage.mockRejectedValue(new Error('Load failed'));

      // Act
      await showLanguageStatus();

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Language Configuration (Error - showing fallback)')
      );
    });
  });

  describe('Security Tests', () => {
    it('should sanitize all user inputs', async () => {
      // Arrange
      const dangerousInputs = [
        '<script>alert("xss")</script>',
        '"; DROP TABLE users; --',
        '{{constructor.constructor("alert(1)")()}}',
        '\u0000\u0001\u0002',
      ];

      for (const input of dangerousInputs) {
        mockedInquirer.prompt.mockResolvedValue({ language: input });

        // Act & Assert
        await expect(promptLanguageSelection()).rejects.toThrow();
      }
    });

    it('should validate language codes strictly', async () => {
      // Arrange
      const invalidLanguages = [null, undefined, 123, {}, [], '', 'fr', 'es'];

      for (const lang of invalidLanguages) {
        mockedInquirer.prompt.mockResolvedValue({ language: lang });

        // Act & Assert
        await expect(promptLanguageSelection()).rejects.toThrow();
      }
    });

    it('should limit input length to prevent buffer overflow', async () => {
      // Arrange
      const longInput = 'a'.repeat(1000);
      mockedInquirer.prompt.mockResolvedValue({ language: longInput });

      // Act & Assert
      await expect(promptLanguageSelection()).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle i18n initialization failure', async () => {
      // Arrange
      initializeI18n.mockRejectedValue(new Error('i18n init failed'));

      // Act & Assert
      await expect(promptLanguageSelection()).rejects.toThrow('i18n init failed');
    });

    it('should handle inquirer prompt cancellation', async () => {
      // Arrange
      mockedInquirer.prompt.mockRejectedValue(new Error('User cancelled'));

      // Act & Assert
      await expect(promptLanguageSelection()).rejects.toThrow('User cancelled');
    });
  });
});