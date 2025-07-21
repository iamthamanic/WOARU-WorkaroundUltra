/**
 * Safe JSON Parser Utility
 * Provides secure JSON parsing with validation and error handling
 */

export interface SafeJsonOptions {
  maxSize?: number;
  allowedKeys?: string[];
  prohibitedKeys?: string[];
  validateFunction?: (obj: any) => boolean;
}

/**
 * Safely parse JSON with size limits and validation
 */
export function safeJsonParse<T = any>(
  jsonString: string,
  options: SafeJsonOptions = {}
): T | null {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default limit
    allowedKeys,
    prohibitedKeys = ['__proto__', 'constructor', 'prototype'],
    validateFunction,
  } = options;

  // Size check to prevent DoS
  if (jsonString.length > maxSize) {
    throw new Error(
      `JSON string too large: ${jsonString.length} bytes > ${maxSize} bytes`
    );
  }

  try {
    // Parse with a replacer to prevent prototype pollution
    const parsed = JSON.parse(jsonString, (key, value) => {
      // Block dangerous keys that could lead to prototype pollution
      if (prohibitedKeys.includes(key)) {
        return undefined;
      }

      // If allowedKeys is specified, only allow those keys
      if (allowedKeys && key !== '' && !allowedKeys.includes(key)) {
        return undefined;
      }

      return value;
    });

    // Additional validation if provided
    if (validateFunction && !validateFunction(parsed)) {
      throw new Error('JSON validation failed');
    }

    return parsed;
  } catch (error) {
    console.error('JSON parsing failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      jsonLength: jsonString.length,
      preview:
        jsonString.substring(0, 100) + (jsonString.length > 100 ? '...' : ''),
    });
    return null;
  }
}

/**
 * Safely stringify JSON with size limits
 */
export function safeJsonStringify(
  obj: any,
  options: { maxSize?: number; space?: number } = {}
): string {
  const { maxSize = 10 * 1024 * 1024, space } = options;

  try {
    const jsonString = JSON.stringify(obj, null, space);

    if (jsonString.length > maxSize) {
      throw new Error(
        `JSON output too large: ${jsonString.length} bytes > ${maxSize} bytes`
      );
    }

    return jsonString;
  } catch (error) {
    throw new Error(
      `JSON stringify failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate that an object has expected structure
 */
export function validateJsonStructure<T>(
  obj: any,
  expectedKeys: (keyof T)[],
  requiredKeys?: (keyof T)[]
): obj is T {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  // Check required keys
  if (requiredKeys) {
    for (const key of requiredKeys) {
      if (!(String(key) in obj)) {
        return false;
      }
    }
  }

  // Check that all keys are expected
  const objKeys = Object.keys(obj);
  for (const key of objKeys) {
    if (!expectedKeys.includes(key as keyof T)) {
      return false;
    }
  }

  return true;
}

/**
 * Create a JSON parser with predefined validation rules
 */
export function createJsonValidator<T>(
  expectedKeys: (keyof T)[],
  requiredKeys?: (keyof T)[]
) {
  return (jsonString: string): T | null => {
    const parsed = safeJsonParse(jsonString, {
      validateFunction: obj =>
        validateJsonStructure<T>(obj, expectedKeys, requiredKeys),
    });

    return parsed;
  };
}
