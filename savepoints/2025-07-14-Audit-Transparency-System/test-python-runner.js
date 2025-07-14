const { QualityRunner } = require('./dist/quality/QualityRunner');
const { NotificationManager } = require('./dist/supervisor/NotificationManager');

// Create notification manager
const notificationManager = new NotificationManager({
  terminal: true,
  desktop: false
});

// Create quality runner
const qualityRunner = new QualityRunner(notificationManager);

// Test the Python quality runner
async function testPython() {
  console.log('Testing Python QualityRunner...');
  await qualityRunner.runChecksOnFileChange('./test-python-error.py');
  console.log('Python test completed.');
}

testPython().catch(console.error);