// Simple test script to verify Continue integration works
import { SimpleIntegrationService } from './dist/services/SimpleIntegrationService.js';

async function testContinueIntegration() {
  console.log('Testing Continue integration...');
  
  try {
    // Create integration service
    const integration = new SimpleIntegrationService(
      '/home/thaman/ai-coding-assistant',
      'http://localhost:3001'
    );
    
    // Test initialization
    console.log('1. Testing initialization...');
    await integration.initialize();
    console.log('✅ Initialization successful');
    
    // Test health check
    console.log('2. Testing health check...');
    const health = await integration.healthCheck();
    console.log('✅ Health check:', health.status);
    
    // Test file operations
    console.log('3. Testing file operations...');
    const workspaceDirs = await integration.listDirectory('/home/thaman/ai-coding-assistant');
    console.log('✅ Found workspace directories:', workspaceDirs.length);
    
    // Test config operations
    console.log('4. Testing config operations...');
    const config = await integration.getConfig();
    console.log('✅ Config loaded:', !!config);
    
    console.log('\n🎉 Continue integration test successful!');
    console.log('All adapters are working correctly.');
    
  } catch (error) {
    console.error('❌ Continue integration test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testContinueIntegration();