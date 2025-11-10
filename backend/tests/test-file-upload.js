/**
 * Test script for file upload to webhook
 * Run with: node test-file-upload.js
 */

const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const webhookUrl = 'http://localhost:4000/webhook/255e5ffb-3a41-4eb1-9c1a-832f3bc87216/users/?test=true';

console.log('🧪 Testing File Upload to Webhook\n');
console.log('Webhook URL:', webhookUrl);
console.log('');

async function testFileUpload() {
  try {
    // Create a test file
    const testFilePath = path.join(__dirname, 'test-upload.txt');
    fs.writeFileSync(testFilePath, 'Hello, this is a test file for webhook upload!');
    console.log('✅ Created test file:', testFilePath);

    // Create form data
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath), {
      filename: 'test-upload.txt',
      contentType: 'text/plain'
    });

    console.log('\n📤 Uploading file...\n');

    // Make request
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(webhookUrl, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    const data = await response.json();

    console.log('📥 Response Status:', response.status);
    console.log('📥 Response Headers:');
    console.log('   Content-Type:', response.headers.get('content-type'));
    console.log('\n📥 Response Body:');
    console.log(JSON.stringify(data, null, 2));

    // Check if binary data is present
    if (data.binary) {
      console.log('\n✅ Binary data received!');
      console.log('   Property:', Object.keys(data.binary)[0]);
      console.log('   File Name:', data.binary[Object.keys(data.binary)[0]]?.fileName);
      console.log('   File Size:', data.binary[Object.keys(data.binary)[0]]?.fileSize);
      console.log('   MIME Type:', data.binary[Object.keys(data.binary)[0]]?.mimeType);
    } else {
      console.log('\n❌ No binary data in response!');
      console.log('   Body:', data.body);
    }

    // Cleanup
    fs.unlinkSync(testFilePath);
    console.log('\n🧹 Cleaned up test file');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

// Also test with form-data package
async function testWithFormData() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test 2: Using form-data package');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const testFilePath = path.join(__dirname, 'test-image.txt');
    fs.writeFileSync(testFilePath, 'Fake image data: PNG...');

    const FormData = require('form-data');
    const form = new FormData();
    
    form.append('file', fs.createReadStream(testFilePath), {
      filename: 'test-image.png',
      contentType: 'image/png'
    });

    console.log('📤 Uploading with form-data package...\n');

    const response = await new Promise((resolve, reject) => {
      form.submit(webhookUrl, (err, res) => {
        if (err) return reject(err);
        
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: JSON.parse(body)
          });
        });
      });
    });

    console.log('📥 Response Status:', response.status);
    console.log('📥 Response Body:');
    console.log(JSON.stringify(response.body, null, 2));

    if (response.body.binary) {
      console.log('\n✅ Binary data received!');
    } else {
      console.log('\n❌ No binary data in response!');
    }

    fs.unlinkSync(testFilePath);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run tests
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Test 1: Using node-fetch');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

testFileUpload()
  .then(() => testWithFormData())
  .then(() => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Tests Complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  })
  .catch(console.error);
