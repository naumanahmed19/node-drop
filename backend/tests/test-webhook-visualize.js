/**
 * Test script for webhook visualization feature
 * 
 * This script tests the new test mode feature that allows you to see
 * webhook executions in real-time in the workflow editor.
 * 
 * Usage: 
 *   node backend/test-webhook-visualize.js
 * 
 * Before running:
 *   1. Open the workflow editor in your browser
 *   2. Make sure the backend server is running
 *   3. Update the WEBHOOK_ID below if needed
 */

const http = require('http');

const WEBHOOK_ID = '8e283f19-c6a7-4a75-ab87-d9c46a64f514';
const BASE_URL = 'http://localhost:4000/webhook';

console.log('🧪 Testing Webhook Visualization Feature\n');
console.log('📋 Instructions:');
console.log('   1. Open the workflow editor in your browser');
console.log('   2. Open the browser console (F12)');
console.log('   3. Watch for real-time execution updates\n');

// Test 1: Standard webhook (background execution)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Test 1: Standard Webhook (Background)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const standardUrl = `${BASE_URL}/${WEBHOOK_ID}`;
console.log(`📨 Calling: ${standardUrl}\n`);

http.get(standardUrl, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('✅ Response:', JSON.stringify(response, null, 2));
      console.log('\n💡 This execution runs in the background.');
      console.log('   You won\'t see it in the editor.\n');
      
      // Wait 3 seconds before test 2
      setTimeout(runTest2, 3000);
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  });
}).on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  console.log('\n💡 Make sure the backend server is running!');
});

function runTest2() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test 2: Test Mode Webhook (Visible)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const testUrl = `${BASE_URL}/${WEBHOOK_ID}?test=true`;
  console.log(`📨 Calling: ${testUrl}\n`);
  console.log('👀 Watch your browser console now!\n');

  http.get(testUrl, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('✅ Response:', JSON.stringify(response, null, 2));
        console.log('\n🎉 Success! Check your browser console for:');
        console.log('   • "🧪 [WorkflowEditor] Webhook test triggered"');
        console.log('   • "✅ [WorkflowEditor] Subscribed to webhook execution"');
        console.log('   • Real-time execution logs and node updates\n');
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ All tests completed!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        console.log('📝 Summary:');
        console.log('   • Standard webhook: Background execution');
        console.log('   • Test mode webhook: Visible in editor');
        console.log('   • Add ?test=true to any webhook URL to visualize\n');
      } catch (error) {
        console.error('❌ Error:', error.message);
      }
    });
  }).on('error', (error) => {
    console.error('❌ Request failed:', error.message);
  });
}
