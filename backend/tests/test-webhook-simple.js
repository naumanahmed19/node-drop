/**
 * Simple webhook test - just trigger and show the response
 */

const http = require('http');

const WEBHOOK_ID = '8e283f19-c6a7-4a75-ab87-d9c46a64f514';
const TEST_MODE = process.argv[2] === 'test' || process.argv[2] === 'visualize';

const url = TEST_MODE 
  ? `http://localhost:4000/webhook/${WEBHOOK_ID}?test=true`
  : `http://localhost:4000/webhook/${WEBHOOK_ID}`;

console.log(`\n📨 Triggering webhook: ${url}\n`);

if (TEST_MODE) {
  console.log('🧪 TEST MODE: Open the workflow editor to see execution!\n');
}

http.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('✅ Response:');
      console.log(JSON.stringify(response, null, 2));
      console.log('\n📝 Execution ID:', response.executionId);
      
      if (TEST_MODE) {
        console.log('\n👀 Check your browser console for real-time updates!');
      }
      console.log('');
    } catch (error) {
      console.error('❌ Error:', error.message);
      console.log('Raw response:', data);
    }
  });
}).on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  console.log('\n💡 Make sure the backend server is running (npm run dev in backend folder)\n');
});

// Usage instructions
if (process.argv.length === 2) {
  console.log('Usage:');
  console.log('  node backend/test-webhook-simple.js          # Standard mode');
  console.log('  node backend/test-webhook-simple.js test     # Test mode (visible in editor)');
  console.log('');
}
