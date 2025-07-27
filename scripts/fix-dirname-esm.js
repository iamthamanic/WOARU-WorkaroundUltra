#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '..', 'src');

const files = [
  'cli.ts',
  'assets/splash_logo.ts', 
  'utils/versionManager.ts',
  'utils/translationValidator.ts',
  'utils/asciiArtGenerator.ts',
  'utils/AIProviderUtils.ts',
  'database/ToolsDatabaseManager.ts',
  'database/DatabaseManager.ts',
  'config/i18n.ts',
  'ai/PromptManager.ts',
  'supervisor/ToolRecommendationEngine.ts'
];

async function fixDirnameUsage() {
  console.log('🔧 Fixing __dirname usage in source files for ES modules...');
  
  let fixedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(srcDir, file);
    if (!await fs.pathExists(filePath)) {
      continue;
    }
    
    const content = await fs.readFile(filePath, 'utf8');
    
    // Check if file already has ES module __dirname setup
    if (content.includes('fileURLToPath(import.meta.url)')) {
      continue;
    }
    
    // Check if file uses __dirname
    if (!content.includes('__dirname')) {
      continue;
    }
    
    // Add ES module compatibility imports
    let newContent = content;
    
    // Check if path and url imports exist, if not add them
    if (!content.includes("import { fileURLToPath }")) {
      // Find existing import statements
      const importRegex = /^import .+ from .+;$/gm;
      const imports = content.match(importRegex) || [];
      const lastImportIndex = imports.length > 0 ? 
        content.lastIndexOf(imports[imports.length - 1]) + imports[imports.length - 1].length : 0;
      
      const esmSetup = `
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
`;
      
      newContent = content.slice(0, lastImportIndex) + esmSetup + content.slice(lastImportIndex);
    }
    
    if (newContent !== content) {
      await fs.writeFile(filePath, newContent);
      fixedCount++;
      console.log(`✓ Fixed __dirname in ${file}`);
    }
  }
  
  console.log(`✅ Fixed ${fixedCount} files`);
}

fixDirnameUsage().catch(console.error);