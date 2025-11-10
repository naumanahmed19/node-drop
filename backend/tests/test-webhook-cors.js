/**
 * Test script to demonstrate CORS behavior
 * Run with: node test-webhook-cors.js
 */

const webhookUrl = 'http://localhost:4000/webhook/255e5ffb-3a41-4eb1-9c1a-832f3bc87216/users/?test=true';

console.log('🧪 Testing Webhook CORS Behavior\n');
console.log('Webhook URL:', webhookUrl);
console.log('Allowed Origin: https://example.com\n');

// Test 1: No Origin Header (Should Work - No CORS Check)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Test 1: No Origin Header');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Command:');
console.log(`curl ${webhookUrl}`);
console.log('\nExpected: ✅ Success (no CORS check applies)');
console.log('Reason: No Origin header means no cross-origin request\n');

// Test 2: Allowed Origin (Should Work)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Test 2: With Allowed Origin');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Command:');
console.log(`curl -H "Origin: https://example.com" ${webhookUrl}`);
console.log('\nExpected: ✅ Success');
console.log('Response Headers:');
console.log('  Access-Control-Allow-Origin: https://example.com');
console.log('  Access-Control-Allow-Credentials: true\n');

// Test 3: Disallowed Origin (Should Fail)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Test 3: With Disallowed Origin');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Command:');
console.log(`curl -H "Origin: https://evil.com" ${webhookUrl}`);
console.log('\nExpected: ❌ 403 Forbidden');
console.log('Response:');
console.log(JSON.stringify({
  success: false,
  status: 403,
  error: "Forbidden",
  message: "Origin not allowed"
}, null, 2));
console.log();

// Test 4: Browser Test
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Test 4: From Browser (Real CORS Test)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Create test.html with this content:\n');
console.log(`<!DOCTYPE html>
<html>
<head><title>CORS Test</title></head>
<body>
    <h1>CORS Test</h1>
    <button onclick="testWebhook()">Test Webhook</button>
    <pre id="result"></pre>
    <script>
        async function testWebhook() {
            try {
                const response = await fetch('${webhookUrl}');
                const data = await response.json();
                document.getElementById('result').textContent = 
                    'Success:\\n' + JSON.stringify(data, null, 2);
            } catch (error) {
                document.getElementById('result').textContent = 
                    'CORS Error:\\n' + error.message;
            }
        }
    </script>
</body>
</html>`);
console.log('\nServe from https://example.com → ✅ Works');
console.log('Serve from http://localhost:8080 → ❌ CORS Error');
console.log('Serve from https://evil.com → ❌ CORS Error\n');

// Run actual tests
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Running Actual Tests...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function runTests() {
  const fetch = (await import('node-fetch')).default;

  // Test 1: No Origin
  console.log('Test 1: No Origin Header');
  try {
    const response = await fetch(webhookUrl);
    const data = await response.json();
    console.log('✅ Status:', response.status);
    console.log('✅ Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  console.log();

  // Test 2: Allowed Origin
  console.log('Test 2: Allowed Origin (https://example.com)');
  try {
    const response = await fetch(webhookUrl, {
      headers: { 'Origin': 'https://example.com' }
    });
    const data = await response.json();
    console.log('✅ Status:', response.status);
    console.log('✅ CORS Header:', response.headers.get('access-control-allow-origin'));
    console.log('✅ Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  console.log();

  // Test 3: Disallowed Origin
  console.log('Test 3: Disallowed Origin (https://evil.com)');
  try {
    const response = await fetch(webhookUrl, {
      headers: { 'Origin': 'https://evil.com' }
    });
    const data = await response.json();
    if (response.status === 403) {
      console.log('✅ Correctly blocked! Status:', response.status);
      console.log('✅ Response:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Should have been blocked! Status:', response.status);
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  console.log();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ CORS only applies to requests WITH Origin header');
  console.log('✅ Direct browser navigation has NO Origin header');
  console.log('✅ curl without -H "Origin: ..." has NO Origin header');
  console.log('✅ Browser fetch/XHR automatically adds Origin header');
  console.log('\n📝 This is standard CORS behavior!');
}

runTests().catch(console.error);
