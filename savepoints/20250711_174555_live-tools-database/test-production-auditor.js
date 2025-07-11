const { ProductionReadinessAuditor } = require('./dist/auditor/ProductionReadinessAuditor');
const { NotificationManager } = require('./dist/supervisor/NotificationManager');

// Create notification manager
const notificationManager = new NotificationManager({
  terminal: true,
  desktop: false
});

// Create production auditor
const auditor = new ProductionReadinessAuditor('.');

// Test production audit
async function testProductionAudit() {
  console.log('🏗️ Testing Production-Readiness-Auditor...\n');
  
  const auditConfig = {
    language: 'javascript',
    frameworks: ['jest'], // This project uses jest
    projectType: 'cli'
  };

  try {
    const audits = await auditor.auditProject(auditConfig);
    
    if (audits.length > 0) {
      await notificationManager.notifyProductionAudits(audits);
    } else {
      console.log('🎉 No production issues found! This project is production-ready.');
    }
    
  } catch (error) {
    console.error('❌ Error during production audit:', error);
  }
  
  console.log('\n✅ Production audit completed!');
}

testProductionAudit().catch(console.error);