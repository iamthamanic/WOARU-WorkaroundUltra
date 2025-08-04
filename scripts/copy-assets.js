import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function copyAssets() {
  const distDir = path.join(__dirname, '..', 'dist');
  const rootDir = path.join(__dirname, '..');
  
  try {
    // Copy locales directory
    await fs.copy(
      path.join(rootDir, 'locales'),
      path.join(distDir, 'locales')
    );
    console.log('✓ Copied locales directory');
    
    // Copy docs directory
    await fs.copy(
      path.join(rootDir, 'docs'),
      path.join(distDir, 'docs')
    );
    console.log('✓ Copied docs directory');
    
    // Copy tools directory - CRITICAL FOR SUPERVISOR
    await fs.copy(
      path.join(rootDir, 'tools'),
      path.join(distDir, 'tools')
    );
    console.log('✓ Copied tools directory');
    
    // Copy templates directory - CRITICAL FOR AI PROMPTS
    await fs.copy(
      path.join(rootDir, 'templates'),
      path.join(distDir, 'templates')
    );
    console.log('✓ Copied templates directory');
    
    // Copy ai-models.json - CRITICAL FOR AI SETUP
    await fs.copy(
      path.join(rootDir, 'ai-models.json'),
      path.join(distDir, 'ai-models.json')
    );
    console.log('✓ Copied ai-models.json');
    
    // Copy database files - CRITICAL FOR TOOLS DETECTION
    await fs.ensureDir(path.join(distDir, 'database'));
    await fs.copy(
      path.join(rootDir, 'src/database/tools-db.json'),
      path.join(distDir, 'database/tools-db.json')
    );
    await fs.copy(
      path.join(rootDir, 'src/database/tools-db-schema.json'),
      path.join(distDir, 'database/tools-db-schema.json')
    );
    console.log('✓ Copied database files');
    
  } catch (error) {
    console.error('Error copying assets:', error);
    process.exit(1);
  }
}

copyAssets();