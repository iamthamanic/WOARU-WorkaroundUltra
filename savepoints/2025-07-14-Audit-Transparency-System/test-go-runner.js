const { QualityRunner } = require('./dist/quality/QualityRunner');
const { NotificationManager } = require('./dist/supervisor/NotificationManager');

// Create notification manager
const notificationManager = new NotificationManager({
  terminal: true,
  desktop: false
});

// Create quality runner
const qualityRunner = new QualityRunner(notificationManager);

// Test the Go quality runner
async function testGo() {
  console.log('Testing Go QualityRunner...');
  await qualityRunner.runChecksOnFileChange('./test-go-error.go');
  console.log('Go test completed.');
}

testGo().catch(console.error);