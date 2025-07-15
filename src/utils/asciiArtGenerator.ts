/**
 * ASCII Art Generator for WOARU Splash Screen
 * Dynamically generates ASCII art from PNG logo files using image-to-ascii
 */

import * as path from 'path';
import * as fs from 'fs';

interface AsciiArtOptions {
  size?: {
    height?: number;
    width?: number;
  };
  size_options?: {
    screen_size?: {
      width?: number;
      height?: number;
    };
  };
  stringify?: boolean;
  colored?: boolean;
  bg?: boolean;
  fg?: boolean;
  white_bg?: boolean;
  px?: string;
  reverse?: boolean;
  concat?: boolean;
}

/**
 * Generates ASCII art from the WOARU logo PNG file
 * @param logoPath - Path to the logo PNG file
 * @param options - Configuration options for ASCII generation
 * @returns Promise<string> - The generated ASCII art as a string
 */
export async function generateLogoAsciiArt(
  logoPath?: string,
  options: AsciiArtOptions = {}
): Promise<string> {
  try {
    // Default logo path
    const defaultLogoPath = path.resolve(__dirname, '../../woaru logo 3.png');
    const imagePath = logoPath || defaultLogoPath;
    
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      console.warn(`Logo file not found: ${imagePath}`);
      return generateFallbackAsciiArt();
    }

    // Dynamic import for image-to-ascii (CommonJS module)
    let imageToAscii;
    try {
      imageToAscii = require('image-to-ascii');
    } catch (error) {
      console.warn('image-to-ascii not installed, falling back to simple ASCII art');
      return generateFallbackAsciiArt();
    }
    
    // Default options optimized for terminal display
    const defaultOptions: AsciiArtOptions = {
      size: {
        height: 8,
        width: 60
      },
      size_options: {
        screen_size: {
          width: 80,
          height: 24
        }
      },
      stringify: true,
      colored: true,
      bg: false,
      fg: true,
      white_bg: false,
      px: '▓',
      reverse: false,
      concat: true
    };

    const finalOptions = { ...defaultOptions, ...options };

    // Generate ASCII art
    return new Promise((resolve, reject) => {
      imageToAscii(imagePath, finalOptions, (err: Error | null, converted: string) => {
        if (err) {
          console.error('Failed to generate ASCII art:', err);
          resolve(generateFallbackAsciiArt());
        } else {
          resolve(converted);
        }
      });
    });
  } catch (error) {
    console.error('Error in generateLogoAsciiArt:', error);
    return generateFallbackAsciiArt();
  }
}

/**
 * Generates a simple fallback ASCII art when image conversion fails
 * @returns string - Simple ASCII art representation
 */
function generateFallbackAsciiArt(): string {
  return `
\x1b[36m╔════════════════════════════════════════════════════════════════╗
\x1b[36m║  \x1b[33m🤖\x1b[36m \x1b[37m●●●\x1b[36m \x1b[32m✓✓✓\x1b[36m   \x1b[1m\x1b[33mWOARU\x1b[0m\x1b[36m - Tech Lead in a Box   \x1b[33m📦\x1b[36m     ║
\x1b[36m╚════════════════════════════════════════════════════════════════╝\x1b[0m
`;
}

/**
 * Generates ASCII art with specific terminal-optimized settings
 * @param logoPath - Path to the logo PNG file
 * @returns Promise<string> - Terminal-optimized ASCII art
 */
export async function generateTerminalOptimizedAsciiArt(logoPath?: string): Promise<string> {
  const terminalOptions: AsciiArtOptions = {
    size: {
      height: 10,
      width: 70
    },
    size_options: {
      screen_size: {
        width: 120,
        height: 30
      }
    },
    stringify: true,
    colored: true,
    bg: true,
    fg: true,
    white_bg: false,
    px: '█',
    reverse: false,
    concat: true
  };

  return generateLogoAsciiArt(logoPath, terminalOptions);
}

/**
 * Generates compact ASCII art for smaller terminals
 * @param logoPath - Path to the logo PNG file
 * @returns Promise<string> - Compact ASCII art
 */
export async function generateCompactAsciiArt(logoPath?: string): Promise<string> {
  const compactOptions: AsciiArtOptions = {
    size: {
      height: 6,
      width: 40
    },
    size_options: {
      screen_size: {
        width: 80,
        height: 24
      }
    },
    stringify: true,
    colored: false,
    bg: false,
    fg: true,
    white_bg: false,
    px: '▓',
    reverse: false,
    concat: true
  };

  return generateLogoAsciiArt(logoPath, compactOptions);
}