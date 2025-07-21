// Quick test script for AIReviewAgent Constructor Fix
const { AIReviewAgent } = require('./dist/ai/AIReviewAgent');

try {
  // Test with empty config - should not crash
  const config1 = {
    providers: undefined,
    parallelRequests: false,
    tokenLimit: 8000,
    costThreshold: 0.5
  };
  
  console.log('Testing undefined providers...');
  const agent1 = new AIReviewAgent(config1);
  console.log('✅ AIReviewAgent constructor fixed - handles undefined providers');
  
  // Test with empty array
  const config2 = {
    providers: [],
    parallelRequests: false,
    tokenLimit: 8000,
    costThreshold: 0.5
  };
  
  console.log('Testing empty providers array...');
  const agent2 = new AIReviewAgent(config2);
  console.log('✅ AIReviewAgent constructor fixed - handles empty providers array');
  
  // Test with valid providers
  const config3 = {
    providers: [
      { id: 'openai', enabled: true, providerType: 'openai', baseUrl: 'test', model: 'gpt-4' }
    ],
    parallelRequests: false,
    tokenLimit: 8000,
    costThreshold: 0.5
  };
  
  console.log('Testing valid providers...');
  const agent3 = new AIReviewAgent(config3);
  console.log('✅ AIReviewAgent constructor fixed - handles valid providers');
  
  console.log('\n🎉 All AIReviewAgent constructor tests passed!');
  
} catch (error) {
  console.error('❌ AIReviewAgent test failed:', error.message);
  process.exit(1);
}