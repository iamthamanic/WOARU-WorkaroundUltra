/**
 * ASCII Art Generator for WOARU Splash Screen
 * Pure JavaScript implementation using jimp for cross-platform compatibility
 */

import * as path from 'path';
import * as fs from 'fs';
import { Jimp } from 'jimp';

interface AsciiArtOptions {
  width?: number;
  height?: number;
  colored?: boolean;
  chars?: string[];
}

/**
 * Converts RGB values to ANSI-256 color code
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns ANSI-256 color code
 */
function rgbToAnsi256(r: number, g: number, b: number): number {
  // Convert to 6x6x6 color cube
  if (r === g && g === b) {
    // Grayscale
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 24) + 232;
  }

  const red = Math.round((r / 255) * 5);
  const green = Math.round((g / 255) * 5);
  const blue = Math.round((b / 255) * 5);

  return 16 + 36 * red + 6 * green + blue;
}

/**
 * Converts integer color to RGBA object
 * @param color - Integer color value
 * @returns RGBA object
 */
function intToRGBA(color: number): {
  r: number;
  g: number;
  b: number;
  a: number;
} {
  return {
    r: (color >>> 24) & 0xff,
    g: (color >>> 16) & 0xff,
    b: (color >>> 8) & 0xff,
    a: color & 0xff,
  };
}

/**
 * Gets brightness of a pixel for character selection
 * @param r - Red component
 * @param g - Green component
 * @param b - Blue component
 * @param a - Alpha component
 * @returns Brightness value (0-1)
 */
function getBrightness(r: number, g: number, b: number, a: number): number {
  const alpha = a / 255;
  const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return brightness * alpha;
}

/**
 * Generates ASCII art from the WOARU logo PNG file using jimp
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

    // Default options
    const defaultOptions: AsciiArtOptions = {
      width: 60,
      height: 15,
      colored: true,
      chars: [' ', '░', '▒', '▓', '█'],
    };

    const finalOptions = { ...defaultOptions, ...options };

    // Load and process image with jimp
    const image = await Jimp.read(imagePath);

    // Calculate aspect ratio and resize
    const aspectRatio = image.width / image.height;
    const targetWidth = finalOptions.width!;
    const targetHeight = Math.round(targetWidth / aspectRatio / 2); // Divide by 2 for terminal character aspect ratio

    image.resize({ w: targetWidth, h: targetHeight });

    let asciiArt = '';
    const chars = finalOptions.chars!;

    // Process each row
    for (let y = 0; y < targetHeight; y++) {
      let line = '';

      for (let x = 0; x < targetWidth; x++) {
        const pixelColor = image.getPixelColor(x, y);
        const color = intToRGBA(pixelColor);
        const brightness = getBrightness(color.r, color.g, color.b, color.a);

        // Select character based on brightness
        const charIndex = Math.floor(brightness * (chars.length - 1));
        const char = chars[charIndex];

        if (finalOptions.colored && brightness > 0.1) {
          // Add ANSI color codes
          const ansiColor = rgbToAnsi256(color.r, color.g, color.b);
          line += `\x1b[38;5;${ansiColor}m${char}\x1b[0m`;
        } else {
          line += char;
        }
      }

      asciiArt += line + '\n';
    }

    return asciiArt;
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
export async function generateTerminalOptimizedAsciiArt(
  logoPath?: string
): Promise<string> {
  const terminalOptions: AsciiArtOptions = {
    width: 70,
    height: 20,
    colored: true,
    chars: [' ', '░', '▒', '▓', '█'],
  };

  return generateLogoAsciiArt(logoPath, terminalOptions);
}

/**
 * Generates compact ASCII art for smaller terminals
 * @param logoPath - Path to the logo PNG file
 * @returns Promise<string> - Compact ASCII art
 */
export async function generateCompactAsciiArt(
  logoPath?: string
): Promise<string> {
  const compactOptions: AsciiArtOptions = {
    width: 40,
    height: 12,
    colored: false,
    chars: [' ', '.', ':', ';', '+', '*', '#', '@'],
  };

  return generateLogoAsciiArt(logoPath, compactOptions);
}

/**
 * Generates high-contrast ASCII art with block characters
 * @param logoPath - Path to the logo PNG file
 * @returns Promise<string> - High-contrast ASCII art
 */
export async function generateHighContrastAsciiArt(
  logoPath?: string
): Promise<string> {
  const highContrastOptions: AsciiArtOptions = {
    width: 50,
    height: 15,
    colored: true,
    chars: [' ', '▌', '█'],
  };

  return generateLogoAsciiArt(logoPath, highContrastOptions);
}
