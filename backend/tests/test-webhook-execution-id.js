/**
 * Test script to verify webhook execution ID consistency
 * 
 * This script tests that the execution ID returned by the webhook endpoint
 * matches the execution ID used in the actual workflow execution.
 * 
 * Usage: node test-webhook-execution-id.js
 */

const http = require('http');

const WEBHOOK_URL = 'http://localhost:4000/webhook/8e283f19-c6a7-4a75-ab87-d9c46a64f514';

console.log('🧪 Testing webhook execution ID consistency...\n');

// Make a GET request to the webhook
const req = http.get(WEBHOOK_URL, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      console.log('📨 Webhook Response:');
      console.log(JSON.stringify(response, null, 2));
      console.log('\n✅ Execution ID from webhook:', response.executionId);
      console.log('\n📝 Check the browser console for the execution event.');
      console.log('   The execution ID in the console should match:', response.executionId);
      console.log('\n   If they match, the bug is fixed! 🎉');
      console.log('   If they differ, the bug still exists. 😞');
      
    } catch (error) {
      console.error('❌ Error parsing response:', error.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  console.log('\n💡 Make sure:');
  console.log('   1. The backend server is running (npm run dev in backend folder)');
  console.log('   2. The workflow is active and the webhook is registered');
});

req.end();
