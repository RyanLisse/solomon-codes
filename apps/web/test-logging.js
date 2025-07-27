// Simple test to verify our logging system works
const { createLogger } = require('./src/lib/logging/index.ts');

try {
  console.log('Testing logging system...');
  const logger = createLogger();
  
  logger.info('Logging system test successful!', {
    component: 'test',
    timestamp: new Date().toISOString()
  });
  
  console.log('✅ Logging system is working correctly');
} catch (error) {
  console.error('❌ Logging system test failed:', error.message);
  process.exit(1);
}
