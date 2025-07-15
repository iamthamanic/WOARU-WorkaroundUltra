// Test script for ASCII art generation
const path = require('path');
const fs = require('fs');

// Mock the asciiArtGenerator functions for testing
async function generateFallbackAsciiArt() {
  return `
\x1b[36m╔════════════════════════════════════════════════════════════════╗
\x1b[36m║  \x1b[33m🤖\x1b[36m \x1b[37m●●●\x1b[36m \x1b[32m✓✓✓\x1b[36m   \x1b[1m\x1b[33mWOARU\x1b[0m\x1b[36m - Tech Lead in a Box   \x1b[33m📦\x1b[36m     ║
\x1b[36m╚════════════════════════════════════════════════════════════════╝\x1b[0m
`;
}

async function generateTerminalOptimizedAsciiArt() {
  // Try to use image-to-ascii if available
  try {
    const imageToAscii = require('image-to-ascii');
    const logoPath = path.resolve(__dirname, 'woaru logo 3.png');
    
    if (!fs.existsSync(logoPath)) {
      console.log('Logo file not found, using fallback');
      return generateFallbackAsciiArt();
    }
    
    return new Promise((resolve, reject) => {
      const options = {
        size: { height: 8, width: 60 },
        colored: true,
        stringify: true,
        px: '█'
      };
      
      imageToAscii(logoPath, options, (err, converted) => {
        if (err) {
          console.log('ASCII conversion failed, using fallback');
          resolve(generateFallbackAsciiArt());
        } else {
          resolve(converted);
        }
      });
    });
  } catch (error) {
    console.log('image-to-ascii not available, using fallback');
    return generateFallbackAsciiArt();
  }
}

async function testSplashScreen() {
  console.log('Testing WOARU Splash Screen...');
  
  try {
    const asciiArt = await generateTerminalOptimizedAsciiArt();
    process.stdout.write(asciiArt);
    process.stdout.write('\n');
    
    console.log('\x1b[36m🤖 WOARU - YOUR TECH LEAD IN A BOX\x1b[0m');
    console.log('\x1b[90m   Version 4.3.1\x1b[0m');
    console.log();
    console.log('Quick Commands:');
    console.log('\x1b[90m  • woaru analyze        - Comprehensive project analysis\x1b[0m');
    console.log('\x1b[90m  • woaru watch          - Start continuous monitoring\x1b[0m');
    console.log('\x1b[90m  • woaru review         - Code review and analysis\x1b[0m');
    console.log('\x1b[90m  • woaru setup          - Setup development tools\x1b[0m');
    console.log('\x1b[90m  • woaru commands       - Show all available commands\x1b[0m');
    console.log();
    console.log('\x1b[33m💡 Run "woaru commands" for detailed help\x1b[0m');
    console.log();
    
  } catch (error) {
    console.error('Error testing splash screen:', error);
  }
}

testSplashScreen();