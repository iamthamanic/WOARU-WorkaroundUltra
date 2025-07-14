// Test script for Multi-LLM AI Code Review Agent
const { AIReviewAgent } = require('./dist/ai/AIReviewAgent');
const { ConfigLoader } = require('./dist/ai/ConfigLoader');

async function testAIReviewAgent() {
  console.log('🧠 Testing Multi-LLM AI Code Review Agent');
  console.log('═══════════════════════════════════════════');

  // Test configuration loading
  const configLoader = ConfigLoader.getInstance();
  
  console.log('\n📄 Testing Configuration Loading...');
  const config = await configLoader.loadConfig();
  
  if (!config) {
    console.log('⚠️  No configuration found. Using default config for demo.');
    
    // Use default config for demonstration
    const defaultConfig = configLoader.getDefaultConfig();
    console.log(`📋 Default config includes ${defaultConfig.providers.length} providers:`);
    defaultConfig.providers.forEach(provider => {
      console.log(`  • ${provider.id} (${provider.model}) - ${provider.enabled ? '✅ enabled' : '❌ disabled'}`);
    });

    // Create agent with default config
    const agent = new AIReviewAgent(defaultConfig);
    
    // Test code sample
    const testCode = `
function processUser(userData) {
    if (userData == null) {
        return null;
    }
    
    var password = userData.password;
    console.log("Processing user:", userData.email);
    
    // Validate password (bad implementation)
    if (password.length > 0) {
        return { id: Math.random(), email: userData.email, password: password };
    }
    
    return null;
}

// Usage
var users = [
    { email: "admin@test.com", password: "admin123" },
    { email: "user@test.com", password: "password" }
];

for (var i = 0; i < users.length; i++) {
    var result = processUser(users[i]);
    if (result != null) {
        console.log("User processed:", result);
    }
}`;

    const codeContext = {
      filePath: 'test_code.js',
      language: 'javascript',
      framework: 'node.js',
      totalLines: testCode.split('\n').length,
      projectContext: {
        name: 'test-project',
        type: 'application',
        dependencies: ['express', 'lodash']
      }
    };

    console.log('\n🔍 Code Analysis Context:');
    console.log(`  • File: ${codeContext.filePath}`);
    console.log(`  • Language: ${codeContext.language}`);
    console.log(`  • Lines: ${codeContext.totalLines}`);
    console.log(`  • Framework: ${codeContext.framework}`);

    console.log('\n💻 Code to Analyze:');
    console.log('```javascript');
    console.log(testCode);
    console.log('```');

    console.log('\n🚀 Starting Multi-LLM Analysis...');
    console.log('Note: This is a dry run - no actual API calls will be made without valid API keys');

    try {
      // This will show the architecture working, but won't make real API calls without keys
      const result = await agent.performMultiLLMReview(testCode, codeContext);
      
      console.log('\n📊 Analysis Complete!');
      console.log(`  • Total Duration: ${result.meta.totalDuration}ms`);
      console.log(`  • LLM Providers: ${Object.keys(result.results).length}`);
      console.log(`  • Total Findings: ${result.aggregation.totalFindings}`);
      console.log(`  • Estimated Cost: $${result.meta.totalEstimatedCost.toFixed(4)}`);

      if (result.aggregation.totalFindings > 0) {
        console.log('\n🔍 Findings Summary:');
        Object.entries(result.aggregation.findingsBySeverity).forEach(([severity, count]) => {
          const icon = severity === 'critical' ? '🔴' : severity === 'high' ? '🟡' : 
                      severity === 'medium' ? '🔵' : '⚪';
          console.log(`  ${icon} ${severity}: ${count}`);
        });

        console.log('\n📋 Findings by Category:');
        Object.entries(result.aggregation.findingsByCategory).forEach(([category, count]) => {
          console.log(`  • ${category}: ${count}`);
        });

        console.log(`\n🤝 LLM Agreement Score: ${(result.aggregation.llmAgreementScore * 100).toFixed(1)}%`);
      }

      if (Object.keys(result.meta.llmErrors).length > 0) {
        console.log('\n❌ LLM Errors:');
        Object.entries(result.meta.llmErrors).forEach(([llmId, error]) => {
          if (error) {
            console.log(`  • ${llmId}: ${error}`);
          }
        });
      }

    } catch (error) {
      console.error('\n❌ Analysis failed:', error.message);
    }

  } else {
    console.log('✅ Configuration loaded successfully!');
    console.log(`📋 Found ${config.providers.length} providers:`);
    config.providers.forEach(provider => {
      const status = provider.enabled ? '✅ enabled' : '❌ disabled';
      const hasKey = process.env[provider.apiKeyEnvVar] ? '🔑 key found' : '❌ no key';
      console.log(`  • ${provider.id} (${provider.model}) - ${status} - ${hasKey}`);
    });

    const enabledCount = config.providers.filter(p => p.enabled).length;
    console.log(`\n🚀 Ready for AI Code Review with ${enabledCount} enabled providers!`);
  }

  console.log('\n💡 Next Steps:');
  console.log('  1. Copy woaru.config.example.js to woaru.config.js');
  console.log('  2. Set your API keys in environment variables');
  console.log('  3. Enable your preferred LLM providers in the config');
  console.log('  4. Run: woaru review --ai <file> to get AI-powered code analysis');

  console.log('\n🎯 Architecture Overview:');
  console.log('  • Flexible multi-provider LLM configuration');
  console.log('  • Parallel or sequential API calls');
  console.log('  • Consensus mode for high-confidence findings');
  console.log('  • Cost estimation and token tracking');
  console.log('  • Comprehensive error handling');
  console.log('  • Conservative system prompts for reliable results');
}

testAIReviewAgent().catch(console.error);