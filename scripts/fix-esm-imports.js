#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, '..', 'dist');

async function fixEsmImports() {
  console.log('🔧 Fixing ES module imports in compiled files...');
  
  const files = await getAllJSFiles(distDir);
  let fixedCount = 0;
  
  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Fix relative imports by adding .js extension
    // This pattern catches imports like './core/WOARUEngine' and '../analyzer/ProjectAnalyzer'
    let fixedContent = content.replace(
      /from\s+['"](\.\/.+?)(?<!\.js)['"];/g,
      "from '$1.js';"
    ).replace(
      /from\s+['"](\.\.\/.+?)(?<!\.js)['"];/g,
      "from '$1.js';"
    ).replace(
      /import\s*\(\s*['"](\.\/.+?)(?<!\.js)['"]\s*\)/g,
      "import('$1.js')"
    ).replace(
      /import\s*\(\s*['"](\.\.\/.+?)(?<!\.js)['"]\s*\)/g,
      "import('$1.js')"
    );
    
    if (fixedContent !== content) {
      await fs.writeFile(filePath, fixedContent);
      fixedCount++;
      const relativePath = path.relative(distDir, filePath);
      console.log(`✓ Fixed imports in ${relativePath}`);
    }
  }
  
  console.log(`✅ Fixed ${fixedCount} files`);
}

async function getAllJSFiles(dir) {
  const files = [];
  const items = await fs.readdir(dir, { withFileTypes: true });
  
  for (const item of items) {
    const itemPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...await getAllJSFiles(itemPath));
    } else if (item.name.endsWith('.js')) {
      files.push(itemPath);
    }
  }
  
  return files;
}

fixEsmImports().catch(console.error);