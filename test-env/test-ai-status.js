#!/usr/bin/env node

// Test script to demonstrate the visual AI status system
// This shows how the new functions can be used

const chalk = require('chalk');

async function testAiStatusSystem() {
  console.log(chalk.cyan.bold('\n🧪 Testing Visual AI Status System\n'));
  
  try {
    // Import the new AI helpers functions
    const {
      checkAiModelStatus,
      displayAiStatus,
      isAiReady,
      getProvidersWithStatus
    } = require('../src/utils/ai-helpers');

    console.log(chalk.blue('1. Testing checkAiModelStatus():'));
    const status = await checkAiModelStatus();
    console.log('Status object:', JSON.stringify(status, null, 2));
    console.log();

    console.log(chalk.blue('2. Testing displayAiStatus() - Full details:'));
    await displayAiStatus({ showDetails: true, compact: false });

    console.log(chalk.blue('3. Testing displayAiStatus() - Compact mode:'));
    await displayAiStatus({ showDetails: false, compact: true });

    console.log(chalk.blue('4. Testing isAiReady():'));
    const ready = await isAiReady();
    console.log(`AI Ready: ${ready ? chalk.green('✅ Yes') : chalk.red('❌ No')}`);
    console.log();

    console.log(chalk.blue('5. Testing getProvidersWithStatus():'));
    const providers = await getProvidersWithStatus();
    console.log('Providers with status:');
    providers.forEach(provider => {
      console.log(`  ${provider.statusIcon} ${provider.id}: ${provider.status} (${provider.model || 'no model'})`);
    });
    console.log();

    console.log(chalk.green('✅ All tests completed successfully!'));

  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error);
  }
}

// Run the test
testAiStatusSystem().catch(console.error);