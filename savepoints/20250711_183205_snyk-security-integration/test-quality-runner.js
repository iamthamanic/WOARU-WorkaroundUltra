const { QualityRunner } = require('./dist/quality/QualityRunner');
const { NotificationManager } = require('./dist/supervisor/NotificationManager');

// Create notification manager
const notificationManager = new NotificationManager({
  terminal: true,
  desktop: false
});

// Create quality runner
const qualityRunner = new QualityRunner(notificationManager);

// Test the quality runner
async function test() {
  console.log('Testing QualityRunner...');
  await qualityRunner.runChecksOnFileChange('./test-error.js');
  console.log('Test completed.');
}

test().catch(console.error);