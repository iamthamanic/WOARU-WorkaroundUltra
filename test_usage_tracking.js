// Test script for Usage Tracking
const { UsageTracker } = require('./dist/ai/UsageTracker');

async function testUsageTracking() {
  console.log('🧪 Testing LLM Usage Tracking');
  console.log('═'.repeat(40));
  
  const usageTracker = UsageTracker.getInstance();
  
  // Simulate some API calls
  console.log('\n📊 Simulating LLM API calls...');
  
  // Simulate successful Anthropic Claude calls
  await usageTracker.trackRequest('anthropic-claude', 1200, 0.0036);
  await usageTracker.trackRequest('anthropic-claude', 800, 0.0024);
  await usageTracker.trackRequest('anthropic-claude', 1500, 0.0045);
  
  // Simulate successful OpenAI calls
  await usageTracker.trackRequest('openai-gpt4', 950, 0.0285);
  await usageTracker.trackRequest('openai-gpt4', 1100, 0.0330);
  
  // Simulate Google Gemini calls
  await usageTracker.trackRequest('google-gemini', 1300, 0.00045);
  
  // Simulate some errors
  await usageTracker.trackError('anthropic-claude');
  await usageTracker.trackError('openai-gpt4');
  
  console.log('✅ Simulated API calls completed');
  
  // Display usage statistics
  console.log('\n📈 Usage Statistics:');
  console.log('─'.repeat(30));
  
  const totalUsage = usageTracker.getTotalUsage();
  console.log(`Total Requests: ${totalUsage.totalRequests}`);
  console.log(`Total Tokens: ${totalUsage.totalTokensUsed.toLocaleString()}`);
  console.log(`Total Cost: $${totalUsage.totalCost.toFixed(4)}`);
  console.log(`Total Errors: ${totalUsage.totalErrors}`);
  console.log(`Active Providers: ${totalUsage.activeProviders}`);
  
  console.log('\n🔍 Per-Provider Details:');
  const allStats = usageTracker.getAllUsageStats();
  
  Object.entries(allStats).forEach(([providerId, stats]) => {
    console.log(`\n• ${providerId}:`);
    console.log(`  Requests: ${stats.totalRequests}`);
    console.log(`  Tokens: ${stats.totalTokensUsed.toLocaleString()}`);
    console.log(`  Cost: $${stats.totalCost.toFixed(4)}`);
    console.log(`  Errors: ${stats.errorCount}`);
    console.log(`  Last Used: ${new Date(stats.lastUsed).toLocaleString()}`);
  });
  
  console.log('\n💡 Now run "woaru status" to see the integrated display!');
}

testUsageTracking().catch(console.error);