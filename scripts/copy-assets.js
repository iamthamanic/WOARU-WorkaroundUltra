import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function copyAssets() {
  const distDir = path.join(__dirname, '..', 'dist');
  
  try {
    // Copy locales directory
    await fs.copy(
      path.join(__dirname, '..', 'locales'),
      path.join(distDir, 'locales')
    );
    console.log('✓ Copied locales directory');
    
    // Copy docs directory
    await fs.copy(
      path.join(__dirname, '..', 'docs'),
      path.join(distDir, 'docs')
    );
    console.log('✓ Copied docs directory');
    
  } catch (error) {
    console.error('Error copying assets:', error);
    process.exit(1);
  }
}

copyAssets();