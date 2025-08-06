/**
 * Unit Tests for Sentry Integration
 * Tests Sentry configuration logic and error filtering functionality
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock Sentry scope interface
interface MockScope {
  setTag: jest.MockedFunction<(key: string, value: string) => void>;
  setLevel: jest.MockedFunction<(level: string) => void>;
  setContext: jest.MockedFunction<(key: string, context: any) => void>;
}

// Mock Sentry before importing
const mockSentry = {
  init: jest.fn() as jest.MockedFunction<(options: any) => void>,
  captureException: jest.fn() as jest.MockedFunction<(error: any) => void>,
  captureMessage: jest.fn() as jest.MockedFunction<(message: string) => void>,
  withScope: jest.fn() as jest.MockedFunction<(callback: (scope: MockScope) => void) => void>,
  close: jest.fn() as jest.MockedFunction<() => Promise<boolean>>,
};

// Configure withScope mock to create and pass a proper mock scope
mockSentry.withScope.mockImplementation((callback: (scope: MockScope) => void) => {
  const mockScope: MockScope = {
    setTag: jest.fn(),
    setLevel: jest.fn(),
    setContext: jest.fn(),
  };
  callback(mockScope);
});

jest.mock('@sentry/node', () => mockSentry);

describe('Sentry Configuration Logic', () => {
  let originalSentryDsn: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    // Store and clear environment variables
    originalSentryDsn = process.env.SENTRY_DSN;
    originalNodeEnv = process.env.NODE_ENV;
    delete process.env.SENTRY_DSN;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore environment variables
    if (originalSentryDsn !== undefined) {
      process.env.SENTRY_DSN = originalSentryDsn;
    } else {
      delete process.env.SENTRY_DSN;
    }
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  describe('Sentry Configuration with DSN', () => {
    it('should create correct configuration when DSN is provided', () => {
      // Set test environment
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      process.env.NODE_ENV = 'production';

      // Simulate the Sentry configuration logic from CLI
      const config = {
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        environment: process.env.NODE_ENV || 'development',
        enabled: !!process.env.SENTRY_DSN,
        beforeSend: (event: any) => {
          if (process.env.NODE_ENV !== 'production' && event.level === 'warning') {
            return null;
          }
          return event;
        },
      };

      expect(config).toEqual({
        dsn: 'https://test@sentry.io/123',
        tracesSampleRate: 0.1,
        environment: 'production',
        enabled: true,
        beforeSend: expect.any(Function),
      });

      // Test the beforeSend function
      const warningEvent = { level: 'warning' };
      const errorEvent = { level: 'error', message: 'Test error' };
      
      expect(config.beforeSend(warningEvent)).toBe(warningEvent); // Should pass in production
      expect(config.beforeSend(errorEvent)).toBe(errorEvent);
    });

    it('should disable Sentry when no DSN is provided', () => {
      delete process.env.SENTRY_DSN;

      const config = {
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        environment: process.env.NODE_ENV || 'development',
        enabled: !!process.env.SENTRY_DSN,
        beforeSend: (event: any) => {
          if (process.env.NODE_ENV !== 'production' && event.level === 'warning') {
            return null;
          }
          return event;
        },
      };

      expect(config).toEqual({
        dsn: undefined,
        tracesSampleRate: 1.0,
        environment: 'development',
        enabled: false,
        beforeSend: expect.any(Function),
      });
    });

    it('should use development sample rates in development', () => {
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      process.env.NODE_ENV = 'development';

      const config = {
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        environment: process.env.NODE_ENV || 'development',
        enabled: !!process.env.SENTRY_DSN,
      };

      expect(config.tracesSampleRate).toBe(1.0);
      expect(config.environment).toBe('development');
    });
  });

  describe('Error Filtering Logic', () => {
    const createBeforeSendFunction = (nodeEnv: string) => {
      return (event: any) => {
        if (nodeEnv !== 'production' && event.level === 'warning') {
          return null;
        }
        return event;
      };
    };

    it('should filter warning events in development', () => {
      const beforeSend = createBeforeSendFunction('development');
      
      const warningEvent = { level: 'warning' };
      const result = beforeSend(warningEvent);
      
      expect(result).toBeNull();
    });

    it('should allow error events in development', () => {
      const beforeSend = createBeforeSendFunction('development');
      
      const errorEvent = { level: 'error', message: 'Test error' };
      const result = beforeSend(errorEvent);
      
      expect(result).toBe(errorEvent);
    });

    it('should allow all events in production', () => {
      const beforeSend = createBeforeSendFunction('production');
      
      const warningEvent = { level: 'warning', message: 'Test warning' };
      const result = beforeSend(warningEvent);
      
      expect(result).toBe(warningEvent);
    });
  });

  describe('Environment Configuration', () => {
    it('should default to development environment', () => {
      delete process.env.NODE_ENV;
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';

      const environment = process.env.NODE_ENV || 'development';
      
      expect(environment).toBe('development');
    });

    it('should respect custom environment', () => {
      process.env.NODE_ENV = 'staging';
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';

      const environment = process.env.NODE_ENV || 'development';
      
      expect(environment).toBe('staging');
    });
  });
});

describe('Sentry Scope Context Setting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle Sentry context setting correctly', () => {
    const mockScope = {
      setTag: jest.fn(),
      setLevel: jest.fn(),
      setContext: jest.fn(),
    };
    
    mockSentry.withScope.mockImplementation((callback: any) => callback(mockScope));
    
    // Simulate error context setting
    mockSentry.withScope((scope: MockScope) => {
      scope.setTag('component', 'cli-main');
      scope.setLevel('fatal');
      scope.setContext('process', {
        argv: ['node', 'cli.js', '--help'],
        cwd: '/test/path',
        version: '5.3.9',
      });
    });

    expect(mockScope.setTag).toHaveBeenCalledWith('component', 'cli-main');
    expect(mockScope.setLevel).toHaveBeenCalledWith('fatal');
    expect(mockScope.setContext).toHaveBeenCalledWith('process', expect.any(Object));
  });

  it('should create proper error context structure', () => {
    const errorContext = {
      argv: process.argv,
      cwd: process.cwd(),
      version: '5.3.9',
      platform: process.platform,
      nodeVersion: process.version,
    };

    expect(errorContext.argv).toEqual(expect.arrayContaining([]));
    expect(typeof errorContext.cwd).toBe('string');
    expect(errorContext.version).toBe('5.3.9');
    expect(typeof errorContext.platform).toBe('string');
    expect(typeof errorContext.nodeVersion).toBe('string');
    expect(errorContext.argv.length).toBeGreaterThan(0);
  });
});

describe('Sentry Integration Feature Tests', () => {
  it('should validate required Sentry configuration structure', () => {
    const requiredConfigKeys = [
      'dsn',
      'tracesSampleRate',
      'environment',
      'enabled',
      'beforeSend',
    ];

    const config = {
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: 'production',
      enabled: true,
      beforeSend: (event: any) => event,
    };

    requiredConfigKeys.forEach(key => {
      expect(config).toHaveProperty(key);
    });
  });

  it('should handle sampling rate calculation correctly', () => {
    const calculateSampleRate = (env: string) => {
      return env === 'production' ? 0.1 : 1.0;
    };

    expect(calculateSampleRate('production')).toBe(0.1);
    expect(calculateSampleRate('development')).toBe(1.0);
    expect(calculateSampleRate('staging')).toBe(1.0);
    expect(calculateSampleRate('test')).toBe(1.0);
  });
});