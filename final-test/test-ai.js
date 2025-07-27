#!/usr/bin/env node

// Quick test script to verify i18n in runAiControlCenter
const { spawn } = require('child_process');

console.log('🧪 Testing woaru ai command with i18n fix...');

const child = spawn('node', ['/Users/halteverbotsocialmacpro/Desktop/arsvivai/WOARU(WorkaroundUltra)/dist/cli.js', 'ai'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let errorOutput = '';

child.stdout.on('data', (data) => {
  output += data.toString();
});

child.stderr.on('data', (data) => {
  errorOutput += data.toString();
});

// Send input to exit gracefully
setTimeout(() => {
  child.stdin.write('\n'); // Exit option
  setTimeout(() => {
    child.kill('SIGTERM');
  }, 1000);
}, 5000);

child.on('close', (code) => {
  console.log('📄 STDOUT Output:');
  console.log(output);
  
  if (errorOutput) {
    console.log('\n❌ STDERR Output:');
    console.log(errorOutput);
  }
  
  // Check if translations are working
  if (output.includes('cli.ai_control_center.menu_prompt')) {
    console.log('\n❌ ISSUE: Raw translation keys still visible');
  } else if (output.includes('What would you like to do')) {
    console.log('\n✅ SUCCESS: Translation keys are resolved');
  } else {
    console.log('\n⚠️  UNKNOWN: Unable to determine translation status');
  }
});

child.on('error', (err) => {
  console.error('❌ Error starting process:', err);
});