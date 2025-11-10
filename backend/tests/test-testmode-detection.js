/**
 * Test if the backend detects ?test=true parameter
 */

const http = require('http');

const WEBHOOK_ID = '8e283f19-c6a7-4a75-ab87-d9c46a64f514';

console.log('🧪 Testing Test Mode Detection\n');

// Test 1: Without test mode
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Test 1: Standard Mode (no ?test=true)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const standardUrl = `http://localhost:4000/webhook/${WEBHOOK_ID}`;
console.log(`URL: ${standardUrl}\n`);

http.get(standardUrl, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('Response:');
      console.log(JSON.stringify(response, null, 2));
      
      if (response.testMode === true) {
        console.log('\n❌ ERROR: testMode should be false or undefined!');
      } else {
        console.log('\n✅ PASS: testMode is not set (as expected)');
      }
      
      console.log('\n');
      runTest2();
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  });
}).on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  process.exit(1);
});

function runTest2() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test 2: Test Mode (?test=true)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const testUrl = `http://localhost:4000/webhook/${WEBHOOK_ID}?test=true`;
  console.log(`URL: ${testUrl}\n`);

  http.get(testUrl, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('Response:');
        console.log(JSON.stringify(response, null, 2));
        
        if (response.testMode === true) {
          console.log('\n✅ PASS: testMode is true (as expected)');
          console.log('✅ Backend is correctly detecting ?test=true parameter');
        } else {
          console.log('\n❌ ERROR: testMode should be true!');
          console.log('❌ Backend is NOT detecting ?test=true parameter');
          console.log('\n💡 This means the issue is in the backend route handler');
        }
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Summary');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        if (response.testMode === true) {
          console.log('✅ Test mode detection is working!');
          console.log('\nNext steps:');
          console.log('1. Check backend logs for: "🧪 Emitting webhook-test-triggered"');
          console.log('2. Check frontend console for: "🧪 [WorkflowEditor] Webhook test triggered"');
          console.log('3. If backend logs show the message but frontend doesn\'t:');
          console.log('   - Run: node backend/test-socket-connection.js');
          console.log('   - Then trigger webhook again');
          console.log('   - This will help debug socket emission\n');
        } else {
          console.log('❌ Test mode detection is NOT working!');
          console.log('\nThe backend is not detecting ?test=true parameter.');
          console.log('Check backend/src/routes/webhook.ts\n');
        }
      } catch (error) {
        console.error('❌ Error:', error.message);
      }
    });
  }).on('error', (error) => {
    console.error('❌ Request failed:', error.message);
  });
}
