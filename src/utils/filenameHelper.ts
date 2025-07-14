/**
 * WOARU Filename Helper for Standardized Report Filenames
 * Provides consistent, sortable timestamp-based naming conventions
 */

// Explain-for-humans: This class creates standardized file names for all WOARU reports, ensuring they can be sorted chronologically and follow a consistent naming pattern across all commands.
export class FilenameHelper {
  /**
   * Generates standardized report filename with sortable timestamp
   * Format: woaru_[befehl_typ]_report_[YYYY]-[MM]-[DD]_[HH]-[MM]-[SS]_[TZ].md
   * @param commandType - The type of command (e.g., 'analyze', 'review', 'git')
   * @returns Standardized filename with timestamp and timezone
   * @example
   * FilenameHelper.generateReportFilename('analyze')
   * // Returns: 'woaru_analyze_report_2024-07-14_15-30-45_+0200.md'
   */
  static generateReportFilename(commandType: string): string {
    // Input validation: ensure commandType is not empty
    if (!commandType || typeof commandType !== 'string') {
      throw new Error('Command type must be a non-empty string');
    }
    
    const now = new Date();
    
    // Get timezone offset in format +0200 or -0500
    const tzOffset = -now.getTimezoneOffset();
    const tzHours = Math.floor(Math.abs(tzOffset) / 60).toString().padStart(2, '0');
    const tzMinutes = (Math.abs(tzOffset) % 60).toString().padStart(2, '0');
    const tzSign = tzOffset >= 0 ? '+' : '-';
    const timezone = `${tzSign}${tzHours}${tzMinutes}`;
    
    // Format: YYYY-MM-DD_HH-MM-SS
    const timestamp = [
      now.getFullYear(),
      (now.getMonth() + 1).toString().padStart(2, '0'),
      now.getDate().toString().padStart(2, '0')
    ].join('-') + '_' + [
      now.getHours().toString().padStart(2, '0'),
      now.getMinutes().toString().padStart(2, '0'),
      now.getSeconds().toString().padStart(2, '0')
    ].join('-');
    
    // Clean command type (remove spaces, lowercase, replace special chars)
    // This ensures all command types are safe for filenames and consistent
    const cleanCommandType = commandType
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    return `woaru_${cleanCommandType}_report_${timestamp}_${timezone}.md`;
  }
  
  /**
   * Extracts timestamp from WOARU report filename for sorting purposes
   * @param filename - The filename to extract timestamp from
   * @returns Sortable timestamp string (YYYY-MM-DD_HH-MM-SS) or null if not found
   * @example
   * FilenameHelper.extractTimestampFromFilename('woaru_analyze_report_2024-07-14_15-30-45_+0200.md')
   * // Returns: '2024-07-14_15-30-45'
   */
  static extractTimestampFromFilename(filename: string): string | null {
    // Input validation
    if (!filename || typeof filename !== 'string') {
      return null;
    }
    
    // Match pattern: woaru_*_report_YYYY-MM-DD_HH-MM-SS_±HHMM.md
    const match = filename.match(/woaru_.*_report_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})_[+-]\d{4}\.md$/);
    return match ? match[1] : null;
  }
  
  /**
   * Sorts WOARU report files by timestamp (newest first)
   * @param filenames - Array of filenames to sort
   * @returns Array of filenames sorted by timestamp (newest first)
   */
  static sortReportsByTimestamp(filenames: string[]): string[] {
    // Input validation
    if (!Array.isArray(filenames)) {
      throw new Error('Filenames must be an array');
    }
    
    return filenames
      .filter(filename => filename.startsWith('woaru_') && filename.endsWith('_report_') || filename.includes('_report_'))
      .sort((a, b) => {
        const timestampA = this.extractTimestampFromFilename(a);
        const timestampB = this.extractTimestampFromFilename(b);
        
        if (!timestampA || !timestampB) return 0;
        
        // Sort newest first
        return timestampB.localeCompare(timestampA);
      });
  }
  
  /**
   * Gets the latest (newest) report filename from a list
   * @param filenames - Array of filenames to search
   * @returns The newest report filename or null if none found
   */
  static getLatestReport(filenames: string[]): string | null {
    const sorted = this.sortReportsByTimestamp(filenames);
    return sorted.length > 0 ? sorted[0] : null;
  }
  
  /**
   * Validates if filename follows WOARU report naming convention
   * @param filename - The filename to validate
   * @returns True if filename follows the standard WOARU report format
   */
  static isValidReportFilename(filename: string): boolean {
    // Input validation
    if (!filename || typeof filename !== 'string') {
      return false;
    }
    
    const pattern = /^woaru_[a-z0-9-]+_report_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_[+-]\d{4}\.md$/;
    return pattern.test(filename);
  }
  
  /**
   * Extracts command type from standardized WOARU filename
   * @param filename - The filename to extract command type from
   * @returns Command type (e.g., 'analyze', 'review') or null if not found
   */
  static extractCommandType(filename: string): string | null {
    // Input validation
    if (!filename || typeof filename !== 'string') {
      return null;
    }
    
    const match = filename.match(/^woaru_([a-z0-9-]+)_report_/);
    return match ? match[1] : null;
  }
}