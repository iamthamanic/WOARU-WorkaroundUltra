import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import chalk from 'chalk';
import fs from 'fs-extra';

// Mock dependencies
jest.mock('chalk', () => ({
  cyan: { bold: jest.fn((text: string) => text) },
  gray: jest.fn((text: string) => text),
  white: jest.fn((text: string) => text),
  yellow: jest.fn((text: string) => text),
}));

jest.mock('fs-extra', () => ({
  readJson: jest.fn(),
}));

jest.mock('../../config/i18n', () => ({
  t: jest.fn((key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      'splash_screen.main_title': '🤖 WOARU - HELPS YOU TO WRITE YOUR BEST CODE POSSIBLE',
      'splash_screen.version_display': 'Version {{version}}',
      'ui.quick_commands': 'Quick Commands',
      'ui.run_commands_help': 'Run "woaru commands" for detailed help',
      'commands.analyze.description': 'Analyze project for code quality and security',
      'commands.watch.description': 'Start continuous quality monitoring',
      'commands.review.description': 'Review code changes and provide feedback',
      'commands.setup.description': 'Configure tools and AI providers',
      'commands.commands.description': 'Show detailed command reference documentation',
    };
    
    let result = translations[key] || key;
    
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        result = result.replace(`{{${paramKey}}}`, String(value));
      });
    }
    
    return result;
  }),
  initializeI18n: jest.fn(),
}));

import { displaySplashScreen, WOARU_COMPACT_LOGO, WOARU_MINI_LOGO } from '../splash_logo';

const mockedFs = fs as jest.Mocked<typeof fs>;
const { t, initializeI18n } = require('../../config/i18n');

describe('splash_logo - Production Quality Tests', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    // Setup console spies
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock returns
    initializeI18n.mockResolvedValue(undefined);
    mockedFs.readJson.mockResolvedValue({
      name: 'woaru',
      version: '5.1.0',
      description: 'Development tool'
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  describe('displaySplashScreen', () => {
    it('should display complete splash screen with version', async () => {
      // Act
      await displaySplashScreen();

      // Assert
      expect(initializeI18n).toHaveBeenCalledTimes(1);
      expect(mockedFs.readJson).toHaveBeenCalled();
      expect(t).toHaveBeenCalledWith('splash_screen.main_title');
      expect(t).toHaveBeenCalledWith('splash_screen.version_display', { version: '5.1.0' });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🤖 WOARU - HELPS YOU TO WRITE YOUR BEST CODE POSSIBLE')
      );
    });

    it('should handle version display configuration', async () => {
      // Act
      await displaySplashScreen({ showVersion: false });

      // Assert
      expect(t).toHaveBeenCalledWith('splash_screen.main_title');
      expect(t).not.toHaveBeenCalledWith('splash_screen.version_display', expect.any(Object));
    });

    it('should handle commands display configuration', async () => {
      // Act
      await displaySplashScreen({ showCommands: false });

      // Assert
      expect(t).toHaveBeenCalledWith('splash_screen.main_title');
      expect(t).not.toHaveBeenCalledWith('ui.quick_commands');
    });

    it('should display fallback splash when i18n fails', async () => {
      // Arrange
      initializeI18n.mockRejectedValue(new Error('i18n failed'));

      // Act
      await displaySplashScreen();

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🤖 WOARU - HELPS YOU TO WRITE YOUR BEST CODE POSSIBLE')
      );
    });

    it('should handle package.json loading failure gracefully', async () => {
      // Arrange
      mockedFs.readJson.mockRejectedValue(new Error('File not found'));

      // Act
      await displaySplashScreen();

      // Assert
      expect(t).toHaveBeenCalledWith('splash_screen.version_display', { version: 'unknown' });
    });

    it('should sanitize version string from package.json', async () => {
      // Arrange
      mockedFs.readJson.mockResolvedValue({
        version: '5.1.0-beta.1+build.123'
      });

      // Act
      await displaySplashScreen();

      // Assert
      expect(t).toHaveBeenCalledWith('splash_screen.version_display', { version: '5.1.0-beta.1' });
    });
  });

  describe('Version Sanitization', () => {
    it('should handle malicious version strings', async () => {
      // Arrange
      const maliciousVersions = [
        '<script>alert("xss")</script>',
        '"; DROP TABLE users; --',
        '../../etc/passwd',
        'version; rm -rf /',
        null,
        undefined,
        123,
        {}
      ];

      for (const maliciousVersion of maliciousVersions) {
        mockedFs.readJson.mockResolvedValue({
          version: maliciousVersion
        });

        // Act
        await displaySplashScreen();

        // Assert
        expect(t).toHaveBeenCalledWith('splash_screen.version_display', { version: 'unknown' });
        
        // Reset for next iteration
        jest.clearAllMocks();
        initializeI18n.mockResolvedValue(undefined);
      }
    });

    it('should validate version format strictly', async () => {
      // Arrange
      const invalidVersions = [
        'not-a-version',
        'v1.0.0', // should not start with 'v'
        '1.0', // incomplete version
        'alpha.beta.gamma',
        '1.0.0.0.0', // too many parts
      ];

      for (const invalidVersion of invalidVersions) {
        mockedFs.readJson.mockResolvedValue({
          version: invalidVersion
        });

        // Act
        await displaySplashScreen();

        // Assert
        expect(t).toHaveBeenCalledWith('splash_screen.version_display', { version: 'unknown' });
        
        // Reset for next iteration
        jest.clearAllMocks();
        initializeI18n.mockResolvedValue(undefined);
      }
    });

    it('should limit version length to prevent buffer overflow', async () => {
      // Arrange
      const longVersion = '1.0.0-' + 'a'.repeat(1000);
      mockedFs.readJson.mockResolvedValue({
        version: longVersion
      });

      // Act
      await displaySplashScreen();

      // Assert
      expect(t).toHaveBeenCalledWith('splash_screen.version_display', { version: 'unknown' });
    });

    it('should handle valid semver versions correctly', async () => {
      // Arrange
      const validVersions = [
        '1.0.0',
        '2.1.3',
        '10.20.30',
        '1.0.0-alpha',
        '1.0.0-beta.1',
        '1.0.0-rc.1'
      ];

      for (const validVersion of validVersions) {
        mockedFs.readJson.mockResolvedValue({
          version: validVersion
        });

        // Act
        await displaySplashScreen();

        // Assert
        const expectedVersion = validVersion.replace(/[^\w.-]/g, '').substring(0, 20);
        expect(t).toHaveBeenCalledWith('splash_screen.version_display', { version: expectedVersion });
        
        // Reset for next iteration
        jest.clearAllMocks();
        initializeI18n.mockResolvedValue(undefined);
      }
    });
  });

  describe('Package.json Validation', () => {
    it('should handle invalid package.json structure', async () => {
      // Arrange
      const invalidPackageStructures = [
        null,
        undefined,
        'string',
        123,
        [],
        { name: 'test' }, // missing version
        { version: 123 }, // wrong version type
      ];

      for (const invalidStructure of invalidPackageStructures) {
        mockedFs.readJson.mockResolvedValue(invalidStructure);

        // Act
        await displaySplashScreen();

        // Assert
        expect(t).toHaveBeenCalledWith('splash_screen.version_display', { version: 'unknown' });
        
        // Reset for next iteration
        jest.clearAllMocks();
        initializeI18n.mockResolvedValue(undefined);
      }
    });

    it('should handle valid package.json without version', async () => {
      // Arrange
      mockedFs.readJson.mockResolvedValue({
        name: 'test-package',
        description: 'A test package'
      });

      // Act
      await displaySplashScreen();

      // Assert
      expect(t).toHaveBeenCalledWith('splash_screen.version_display', { version: 'unknown' });
    });
  });

  describe('Command Section Display', () => {
    it('should display all commands correctly', async () => {
      // Act
      await displaySplashScreen();

      // Assert
      expect(t).toHaveBeenCalledWith('ui.quick_commands');
      expect(t).toHaveBeenCalledWith('commands.analyze.description');
      expect(t).toHaveBeenCalledWith('commands.watch.description');
      expect(t).toHaveBeenCalledWith('commands.review.description');
      expect(t).toHaveBeenCalledWith('commands.setup.description');
      expect(t).toHaveBeenCalledWith('commands.commands.description');
      expect(t).toHaveBeenCalledWith('ui.run_commands_help');
    });

    it('should handle individual command translation failures', async () => {
      // Arrange
      t.mockImplementation((key: string) => {
        if (key === 'commands.analyze.description') {
          throw new Error('Translation failed');
        }
        return key;
      });

      // Act
      await displaySplashScreen();

      // Assert
      expect(consoleDebugSpy).toHaveBeenCalledWith('Command translation failed for: analyze');
      // Should continue with other commands
      expect(t).toHaveBeenCalledWith('commands.watch.description');
    });

    it('should display fallback commands when translation system fails', async () => {
      // Arrange
      t.mockImplementation(() => {
        throw new Error('Translation system failed');
      });

      // Act
      await displaySplashScreen();

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Quick Commands')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('woaru analyze')
      );
    });
  });

  describe('Error Handling', () => {
    it('should provide final fallback when all systems fail', async () => {
      // Arrange
      initializeI18n.mockRejectedValue(new Error('i18n failed'));
      mockedFs.readJson.mockRejectedValue(new Error('fs failed'));
      consoleLogSpy.mockImplementation(() => { throw new Error('console failed'); });

      // Act
      await displaySplashScreen();

      // Assert - Should not throw and provide minimal output
      expect(initializeI18n).toHaveBeenCalled();
    });

    it('should handle file system errors gracefully', async () => {
      // Arrange
      mockedFs.readJson.mockRejectedValue(new Error('ENOENT: file not found'));

      // Act
      await displaySplashScreen();

      // Assert
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Version loading failed')
      );
    });
  });

  describe('Static Logo Components', () => {
    it('should export static logo constants', () => {
      // Assert
      expect(WOARU_COMPACT_LOGO).toBeDefined();
      expect(typeof WOARU_COMPACT_LOGO).toBe('string');
      expect(WOARU_COMPACT_LOGO).toContain('WOARU');
      
      expect(WOARU_MINI_LOGO).toBeDefined();
      expect(typeof WOARU_MINI_LOGO).toBe('string');
      expect(WOARU_MINI_LOGO).toContain('WOARU');
    });

    it('should contain safe ANSI escape sequences', () => {
      // Assert - Check for basic ANSI color codes
      expect(WOARU_COMPACT_LOGO).toMatch(/\\x1b\[\d+m/);
      expect(WOARU_MINI_LOGO).toMatch(/\\x1b\[\d+m/);
      
      // Should not contain dangerous sequences
      expect(WOARU_COMPACT_LOGO).not.toContain('<script');
      expect(WOARU_MINI_LOGO).not.toContain('<script');
    });
  });

  describe('Security Tests', () => {
    it('should sanitize all file paths', async () => {
      // Arrange - Mock path.resolve to return dangerous path
      const originalPathResolve = require('path').resolve;
      require('path').resolve = jest.fn(() => '../../etc/passwd');

      // Act
      await displaySplashScreen();

      // Assert
      expect(consoleDebugSpy).toHaveBeenCalledWith('Invalid package.json path detected');
      
      // Restore
      require('path').resolve = originalPathResolve;
    });

    it('should prevent XSS in version display', async () => {
      // Arrange
      mockedFs.readJson.mockResolvedValue({
        version: '<img src=x onerror=alert(1)>'
      });

      // Act
      await displaySplashScreen();

      // Assert
      expect(t).toHaveBeenCalledWith('splash_screen.version_display', { version: 'unknown' });
    });

    it('should handle all edge cases for type safety', async () => {
      // Test various edge cases
      const edgeCases = [
        Symbol('test'),
        new Date(),
        new RegExp('test'),
        function() { return 'test'; },
        new Map(),
        new Set(),
      ];

      for (const edgeCase of edgeCases) {
        mockedFs.readJson.mockResolvedValue({
          version: edgeCase
        });

        // Act & Assert - Should not throw
        await expect(displaySplashScreen()).resolves.not.toThrow();
        
        // Reset
        jest.clearAllMocks();
        initializeI18n.mockResolvedValue(undefined);
      }
    });
  });
});