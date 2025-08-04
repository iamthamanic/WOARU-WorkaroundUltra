#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Critical files that MUST be in the npm package
const REQUIRED_FILES = [
  'dist/',
  'tools/',
  'ai-models.json',
  'templates/',
  'locales/',
  'src/database/tools-db.json',
  'src/database/tools-db-schema.json'
];

// Critical directories in dist/ that MUST exist after build
const REQUIRED_DIST_DIRS = [
  'dist/tools/',
  'dist/templates/',
  'dist/locales/',
  'dist/database/'
];

// Critical files in dist/ that MUST exist after build
const REQUIRED_DIST_FILES = [
  'dist/ai-models.json',
  'dist/database/tools-db.json',
  'dist/database/tools-db-schema.json'
];

async function validatePackage() {
  console.log('🔍 WOARU Package Validation');
  console.log('═══════════════════════════════════════════════');
  
  let errors = 0;
  
  try {
    // Step 1: Validate that build was successful
    console.log('\n📦 Step 1: Checking dist/ directory...');
    const distExists = await fs.pathExists('dist');
    if (!distExists) {
      console.error('❌ ERROR: dist/ directory does not exist. Run "npm run build" first.');
      errors++;
    } else {
      console.log('✅ dist/ directory exists');
    }
    
    // Step 2: Validate critical directories exist in dist/
    console.log('\n📁 Step 2: Checking critical directories in dist/...');
    for (const dir of REQUIRED_DIST_DIRS) {
      const exists = await fs.pathExists(dir);
      if (!exists) {
        console.error(`❌ ERROR: Missing critical directory: ${dir}`);
        errors++;
      } else {
        console.log(`✅ ${dir} exists`);
      }
    }
    
    // Step 3: Validate critical files exist in dist/
    console.log('\n📄 Step 3: Checking critical files in dist/...');
    for (const file of REQUIRED_DIST_FILES) {
      const exists = await fs.pathExists(file);
      if (!exists) {
        console.error(`❌ ERROR: Missing critical file: ${file}`);
        errors++;
      } else {
        console.log(`✅ ${file} exists`);
      }
    }
    
    // Step 4: Create test package
    console.log('\n📦 Step 4: Creating test package...');
    const output = execSync('npm pack --dry-run', { encoding: 'utf8' });
    
    // Step 5: Validate package contents
    console.log('\n🔍 Step 5: Validating package contents...');
    for (const requiredFile of REQUIRED_FILES) {
      if (!output.includes(requiredFile)) {
        console.error(`❌ ERROR: Package missing critical file/directory: ${requiredFile}`);
        errors++;
      } else {
        console.log(`✅ Package includes: ${requiredFile}`);
      }
    }
    
    // Step 6: Check for common mistakes
    console.log('\n⚠️  Step 6: Checking for common packaging mistakes...');
    
    // Check if node_modules is accidentally included
    if (output.includes('node_modules/')) {
      console.warn('⚠️  WARNING: node_modules/ found in package (this might be intentional for some files)');
    }
    
    // Check if test files are accidentally included
    if (output.includes('test-') || output.includes('.test.')) {
      console.warn('⚠️  WARNING: Test files found in package (consider adding to .npmignore)');
    }
    
    // Check if savepoints are accidentally included
    if (output.includes('savepoints/')) {
      console.warn('⚠️  WARNING: savepoints/ directory found in package (should be in .npmignore)');
    }
    
    // Final result
    console.log('\n📋 VALIDATION SUMMARY');
    console.log('═══════════════════════════════════════════════');
    
    if (errors === 0) {
      console.log('✅ ALL CHECKS PASSED! Package is ready for publication.');
      console.log('');
      console.log('🚀 To publish:');
      console.log('   npm publish');
      console.log('');
      console.log('🧪 To test locally:');
      console.log('   npm pack');
      console.log('   npm install -g ./woaru-*.tgz');
      console.log('   woaru --version');
      process.exit(0);
    } else {
      console.error(`❌ VALIDATION FAILED! Found ${errors} critical error(s).`);
      console.error('');
      console.error('🔧 To fix:');
      console.error('   1. Run "npm run build" to rebuild');
      console.error('   2. Check that copy-assets.js is working correctly');
      console.error('   3. Verify all critical files exist in dist/');
      console.error('   4. Run "npm run validate:package" again');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Validation failed with error:', error.message);
    process.exit(1);
  }
}

validatePackage();