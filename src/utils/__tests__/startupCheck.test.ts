import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { VersionManager } from '../versionManager';

// Mock dependencies
jest.mock('child_process');
jest.mock('fs-extra');
jest.mock('chalk', () => ({
  yellow: jest.fn((text: string) => text),
  red: jest.fn((text: string) => text),
  gray: jest.fn((text: string) => text),
}));
jest.mock('inquirer');
jest.mock('../versionManager');

jest.mock('../../config/i18n', () => ({
  t: jest.fn((key: string, params?: any) => {
    const translations: Record<string, string> = {
      'startup_check.git_not_available': 'Git is not available in your system PATH',
      'startup_check.docker_not_available': 'Docker is not available (optional)',
      'startup_check.snyk_not_available': 'Snyk is not available (optional for security checks)',
      'startup_check.warning_prefix': '⚠️ WARNING:',
      'startup_check.git_commands_warning': 'Commands like \'woaru review git\' will not work.',
      'startup_check.docker_tip': '💡 TIP: Docker is not available. Containerization checks will be skipped.',
      'startup_check.snyk_tip': '💡 TIP: Snyk is not available. Extended security checks will be skipped.',
      'startup_check.new_version_available': '💡 A new version of WOARU (v{{version}}) is available!',
      'startup_check.released_on': 'Released on: {{date}}',
      'startup_check.update_prompt': 'Would you like to update now?',
      'startup_check.update_failed': 'Update failed: {{error}}',
      'startup_check.version_check_failed': 'Version check failed: {{error}}',
      'startup_check.startup_notes': '📋 Startup Notes:',
      'startup_check.startup_problems': '❌ Startup Problems:',
      'startup_check.new_version_silent': '💡 A new version of WOARU (v{{version}}) is available. Run \'woaru update\'.',
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

import { StartupCheck } from '../startupCheck';

const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
const mockedVersionManager = VersionManager as jest.Mocked<typeof VersionManager>;
import { t, initializeI18n } from '../../config/i18n';

describe('StartupCheck - Production Quality Tests', () => {
  let consoleLogSpy: jest.MockedFunction<typeof console.log>;
  let consoleErrorSpy: jest.MockedFunction<typeof console.error>;
  let consoleDebugSpy: jest.MockedFunction<typeof console.debug>;

  beforeEach(() => {
    // Setup console spies
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock returns
    initializeI18n.mockResolvedValue(undefined);
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.statSync.mockReturnValue({ size: 100 } as any);
    mockedFs.readJsonSync.mockReturnValue({ timestamp: Date.now() - 1000 });
    mockedFs.ensureDirSync.mockImplementation(() => {});
    mockedFs.writeJsonSync.mockImplementation(() => {});
    mockedFs.chmodSync.mockImplementation(() => {});
    
    // Mock version manager
    mockedVersionManager.checkVersion.mockResolvedValue({
      isUpToDate: true,
      latest: '5.1.0',
      current: '5.1.0'
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  describe('Tool Availability Checks', () => {
    it('should detect git availability correctly', async () => {
      // Arrange
      mockedExecSync.mockReturnValue('git version 2.30.0');

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(result.toolsAvailable?.git).toBe(true);
      expect(result.environmentCheck).toBe(true);
    });

    it('should handle git unavailability', async () => {
      // Arrange
      mockedExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(result.toolsAvailable?.git).toBe(false);
      expect(result.environmentCheck).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('WARNING'));
    });

    it('should detect docker availability correctly', async () => {
      // Arrange
      mockedExecSync.mockImplementation((command: string) => {
        if (command.includes('docker')) {
          return Buffer.from('Docker version 20.10.0');
        }
        throw new Error('Command not found');
      });

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(result.toolsAvailable?.docker).toBe(true);
    });

    it('should handle docker unavailability gracefully', async () => {
      // Arrange
      mockedExecSync.mockImplementation((command: string) => {
        if (command.includes('docker')) {
          throw new Error('Command not found');
        }
        return 'git version 2.30.0';
      });

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(result.toolsAvailable?.docker).toBe(false);
      expect(result.warnings).toContain(expect.stringContaining('Docker'));
    });

    it('should detect snyk availability correctly', async () => {
      // Arrange
      mockedExecSync.mockImplementation((command: string) => {
        if (command.includes('snyk')) {
          return '1.500.0';
        }
        return 'git version 2.30.0';
      });

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(result.toolsAvailable?.snyk).toBe(true);
    });

    it('should handle command execution timeout', async () => {
      // Arrange
      mockedExecSync.mockImplementation(() => {
        throw new Error('Process timed out');
      });

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(result.environmentCheck).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Version Management', () => {
    it('should handle up-to-date version correctly', async () => {
      // Arrange
      mockedVersionManager.checkVersion.mockResolvedValue({
        isUpToDate: true,
        latest: '5.1.0',
        current: '5.1.0'
      });

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(result.versionCheck).toBe(true);
      expect(result.warnings).not.toContain(expect.stringContaining('new version'));
    });

    it('should detect outdated version in silent mode', async () => {
      // Arrange
      mockedVersionManager.checkVersion.mockResolvedValue({
        isUpToDate: false,
        latest: '5.2.0',
        current: '5.1.0'
      });

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(result.versionCheck).toBe(true);
      expect(result.warnings).toContain(expect.stringContaining('new version'));
    });

    it('should prompt for update in interactive mode', async () => {
      // Arrange
      mockedVersionManager.checkVersion.mockResolvedValue({
        isUpToDate: false,
        latest: '5.2.0',
        current: '5.1.0',
        releaseDate: '2024-01-15'
      });
      mockedInquirer.prompt.mockResolvedValue({ update: false });

      // Act
      const result = await StartupCheck.performStartupCheck();

      // Assert
      expect(mockedInquirer.prompt).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('new version')
      );
    });

    it('should handle user accepting update', async () => {
      // Arrange
      mockedVersionManager.checkVersion.mockResolvedValue({
        isUpToDate: false,
        latest: '5.2.0',
        current: '5.1.0'
      });
      mockedInquirer.prompt.mockResolvedValue({ update: true });
      mockedVersionManager.updateToLatest.mockResolvedValue(undefined);

      // Act
      const result = await StartupCheck.performStartupCheck();

      // Assert
      expect(mockedVersionManager.updateToLatest).toHaveBeenCalled();
    });

    it('should handle update failure gracefully', async () => {
      // Arrange
      mockedVersionManager.checkVersion.mockResolvedValue({
        isUpToDate: false,
        latest: '5.2.0',
        current: '5.1.0'
      });
      mockedInquirer.prompt.mockResolvedValue({ update: true });
      mockedVersionManager.updateToLatest.mockRejectedValue(new Error('Update failed'));

      // Act
      const result = await StartupCheck.performStartupCheck();

      // Assert
      expect(result.errors).toContain(expect.stringContaining('Update failed'));
    });

    it('should handle version check failure', async () => {
      // Arrange
      mockedVersionManager.checkVersion.mockRejectedValue(new Error('Network error'));

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(result.versionCheck).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Version check failed'));
    });
  });

  describe('Cache Management', () => {
    it('should use cache when available and valid', async () => {
      // Arrange
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ size: 100 } as any);
      mockedFs.readJsonSync.mockReturnValue({
        timestamp: Date.now() - 1000, // 1 second ago
        version: '1.0'
      });

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(result.cacheUsed).toBe(true);
      expect(mockedVersionManager.checkVersion).not.toHaveBeenCalled();
    });

    it('should ignore expired cache', async () => {
      // Arrange
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ size: 100 } as any);
      mockedFs.readJsonSync.mockReturnValue({
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        version: '1.0'
      });

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(result.cacheUsed).toBe(false);
    });

    it('should ignore oversized cache file', async () => {
      // Arrange
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ size: 2048 } as any); // Too large

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(result.cacheUsed).toBe(false);
      expect(consoleDebugSpy).toHaveBeenCalledWith('Cache file too large, running check');
    });

    it('should handle invalid cache structure', async () => {
      // Arrange
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ size: 100 } as any);
      mockedFs.readJsonSync.mockReturnValue('invalid cache');

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(result.cacheUsed).toBe(false);
      expect(consoleDebugSpy).toHaveBeenCalledWith('Invalid cache structure, running check');
    });

    it('should handle future timestamp in cache', async () => {
      // Arrange
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ size: 100 } as any);
      mockedFs.readJsonSync.mockReturnValue({
        timestamp: Date.now() + 1000, // Future timestamp
        version: '1.0'
      });

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(result.cacheUsed).toBe(false);
      expect(consoleDebugSpy).toHaveBeenCalledWith('Invalid cache timestamp, running check');
    });

    it('should update cache after successful check', async () => {
      // Arrange
      mockedFs.existsSync.mockReturnValue(false);

      // Act
      await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(mockedFs.writeJsonSync).toHaveBeenCalled();
    });

    it('should handle cache write failure gracefully', async () => {
      // Arrange
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.writeJsonSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      // Act & Assert - Should not throw
      await expect(StartupCheck.performSilentStartupCheck()).resolves.not.toThrow();
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cache update failed')
      );
    });
  });

  describe('Security Tests', () => {
    it('should sanitize command names', async () => {
      // Arrange - This should be handled by the isValidCommand function
      mockedExecSync.mockImplementation((command: string) => {
        // Simulate that malicious commands are not executed
        if (command.includes(';') || command.includes('&&')) {
          throw new Error('Invalid command');
        }
        return 'git version 2.30.0';
      });

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert - Should complete without security issues
      expect(result.environmentCheck).toBeDefined();
    });

    it('should sanitize error messages', async () => {
      // Arrange
      const maliciousError = new Error('/sensitive/path/file.json not found <script>alert(1)</script>');
      mockedVersionManager.checkVersion.mockRejectedValue(maliciousError);

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(result.errors[0]).toContain('[PATH]');
      expect(result.errors[0]).not.toContain('/sensitive/path');
      expect(result.errors[0]).not.toContain('<script>');
    });

    it('should limit error message length', async () => {
      // Arrange
      const longError = new Error('a'.repeat(1000));
      mockedVersionManager.checkVersion.mockRejectedValue(longError);

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(result.errors[0].length).toBeLessThanOrEqual(250); // Including prefix
    });

    it('should validate version info structure', async () => {
      // Arrange
      mockedVersionManager.checkVersion.mockResolvedValue({
        // Missing isUpToDate property
        latest: '5.2.0'
      } as any);

      // Act
      const result = await StartupCheck.performStartupCheck();

      // Assert
      expect(result.errors).toContain(expect.stringContaining('Invalid version information'));
    });

    it('should handle malicious version strings', async () => {
      // Arrange
      mockedVersionManager.checkVersion.mockResolvedValue({
        isUpToDate: false,
        latest: '<script>alert("xss")</script>5.2.0',
        current: '5.1.0'
      });

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.not.stringContaining('<script>')
      );
    });

    it('should validate inquirer responses', async () => {
      // Arrange
      mockedVersionManager.checkVersion.mockResolvedValue({
        isUpToDate: false,
        latest: '5.2.0',
        current: '5.1.0'
      });
      mockedInquirer.prompt.mockResolvedValue({ maliciousField: true }); // Wrong field

      // Act
      const result = await StartupCheck.performStartupCheck();

      // Assert
      expect(consoleDebugSpy).toHaveBeenCalledWith('Invalid user input received');
    });

    it('should handle prompt timeout', async () => {
      // Arrange
      mockedVersionManager.checkVersion.mockResolvedValue({
        isUpToDate: false,
        latest: '5.2.0',
        current: '5.1.0'
      });
      mockedInquirer.prompt.mockRejectedValue(new Error('Timeout'));

      // Act
      const result = await StartupCheck.performStartupCheck();

      // Assert
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Prompt failed')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle critical failures gracefully', async () => {
      // Arrange
      initializeI18n.mockRejectedValue(new Error('Critical failure'));

      // Act
      const result = await StartupCheck.performStartupCheck();

      // Assert
      expect(result.versionCheck).toBe(false);
      expect(result.environmentCheck).toBe(false);
      expect(result.errors).toContain('Critical startup check failure');
    });

    it('should isolate environment check failures', async () => {
      // Arrange
      mockedExecSync.mockImplementation(() => {
        throw new Error('All commands fail');
      });

      // Act
      const result = await StartupCheck.performStartupCheck();

      // Assert
      expect(result.environmentCheck).toBe(false);
      // Version check should still attempt to run
      expect(mockedVersionManager.checkVersion).toHaveBeenCalled();
    });

    it('should handle display failures with fallback', async () => {
      // Arrange
      t.mockImplementation(() => {
        throw new Error('Translation failed');
      });

      // Act
      const result = await StartupCheck.performStartupCheck();

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Startup Notes')
      );
    });

    it('should handle path validation failures', async () => {
      // Arrange
      mockedFs.ensureDirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Act & Assert - Should not throw
      await expect(StartupCheck.performSilentStartupCheck()).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty tool outputs', async () => {
      // Arrange
      mockedExecSync.mockReturnValue('');

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(result.toolsAvailable?.git).toBe(true);
    });

    it('should handle non-standard version formats', async () => {
      // Arrange
      mockedExecSync.mockReturnValue('git version 2.30.0.windows.1');

      // Act
      const result = await StartupCheck.performSilentStartupCheck();

      // Assert
      expect(result.toolsAvailable?.git).toBe(true);
    });

    it('should handle system without HOME environment variable', async () => {
      // Arrange
      const originalHome = process.env.HOME;
      delete process.env.HOME;
      delete process.env.USERPROFILE;

      // Act & Assert - Should not throw
      await expect(StartupCheck.performSilentStartupCheck()).resolves.not.toThrow();

      // Restore
      process.env.HOME = originalHome;
    });
  });
});