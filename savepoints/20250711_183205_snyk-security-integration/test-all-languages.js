const { QualityRunner } = require('./dist/quality/QualityRunner');
const { NotificationManager } = require('./dist/supervisor/NotificationManager');

// Create notification manager
const notificationManager = new NotificationManager({
  terminal: true,
  desktop: false
});

// Create quality runner
const qualityRunner = new QualityRunner(notificationManager);

// Test all languages
async function testAllLanguages() {
  const tests = [
    { file: './test-error.js', name: 'JavaScript' },
    { file: './test-python-error.py', name: 'Python' },
    { file: './test-go-error.go', name: 'Go' },
    { file: './test-rust-error.rs', name: 'Rust' },
    { file: './test-csharp-error.cs', name: 'C#' },
    { file: './test-java-error.java', name: 'Java' },
    { file: './test-php-error.php', name: 'PHP' },
    { file: './test-ruby-error.rb', name: 'Ruby' }
  ];

  for (const test of tests) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Testing ${test.name}...`);
    console.log('='.repeat(50));
    
    try {
      await qualityRunner.runChecksOnFileChange(test.file);
    } catch (error) {
      console.error(`Error testing ${test.name}:`, error.message);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✅ All language tests completed!');
}

testAllLanguages().catch(console.error);