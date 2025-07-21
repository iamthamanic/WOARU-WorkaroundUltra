/**
 * HybridBasePlugin - Base class for the new hybrid architecture
 *
 * Combines secure core plugin logic with dynamic configuration from tools.json
 */
export abstract class HybridBasePlugin {
  /**
   * Get the plugin name (matches plugin_class in tools.json core_tools)
   */
  abstract getName(): string;

  /**
   * Get supported file extensions for this plugin
   */
  abstract getSupportedExtensions(): string[];

  /**
   * Check if this plugin can handle the given file
   */
  abstract canHandleFile(filePath: string): Promise<boolean>;

  /**
   * Run the core tool with dynamic configuration
   */
  abstract runLinter(
    filePath: string,
    options?: Record<string, unknown>
  ): Promise<{
    success: boolean;
    output: string;
    hasErrors: boolean;
    hasWarnings: boolean;
  }>;

  /**
   * Get framework-specific configuration
   */
  abstract getFrameworkSpecificConfig(
    framework: string
  ): Promise<Record<string, unknown>>;

  /**
   * Check for deprecation warnings
   */
  abstract checkDeprecationWarnings(): Promise<{
    isDeprecated: boolean;
    warning?: string;
    successor?: string;
    migrationGuide?: string;
  }>;

  /**
   * Get recommended packages for installation
   */
  abstract getRecommendedPackages(
    projectContext: Record<string, unknown>
  ): Promise<string[]>;

  // ========== UTILITY METHODS ==========

  /**
   * Check if a file exists
   */
  protected async fileExists(filePath: string): Promise<boolean> {
    try {
      const fs = await import('fs-extra');
      return await fs.pathExists(filePath);
    } catch {
      return false;
    }
  }

  /**
   * Read JSON file safely
   */
  protected async readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      const fs = await import('fs-extra');
      return (await fs.readJson(filePath)) as T;
    } catch {
      return null;
    }
  }

  /**
   * Get file extension
   */
  protected async getFileExtension(filePath: string): Promise<string> {
    const pathModule = await import('path');
    const path = pathModule.default || pathModule;
    return path.extname(filePath);
  }

  /**
   * Check if file has specific extension
   */
  protected async hasExtension(
    filePath: string,
    extensions: string[]
  ): Promise<boolean> {
    const ext = await this.getFileExtension(filePath);
    return extensions.includes(ext);
  }

  /**
   * Sanitize command arguments for security
   */
  protected sanitizeArgs(args: string[]): string[] {
    return args.filter(arg => {
      // Remove potentially dangerous arguments
      if (arg.includes('&&') || arg.includes('||') || arg.includes(';')) {
        return false;
      }
      if (arg.includes('`') || arg.includes('$(')) {
        return false;
      }
      return true;
    });
  }

  /**
   * Validate file path for security
   */
  protected async isValidFilePath(filePath: string): Promise<boolean> {
    // Basic path traversal protection
    if (filePath.includes('..') || filePath.includes('~')) {
      return false;
    }

    // Must be a reasonable file extension
    const ext = await this.getFileExtension(filePath);
    const allowedExtensions = [
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.py',
      '.rs',
      '.go',
      '.java',
      '.cs',
      '.php',
      '.rb',
      '.vue',
      '.svelte',
    ];

    return allowedExtensions.includes(ext);
  }
}
