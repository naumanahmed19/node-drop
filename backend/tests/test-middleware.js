/**
 * Simple test to check if middleware is working
 */

const FormData = require('form-data');
const fs = require('fs');

async function test() {
  const fetch = (await import('node-fetch')).default;
  
  // Create test file
  fs.writeFileSync('test.txt', 'Hello World');
  
  // Create form
  const form = new FormData();
  form.append('file', fs.createReadStream('test.txt'));
  
  console.log('Sending request...');
  
  const response = await fetch('http://localhost:4000/webhook/255e5ffb-3a41-4eb1-9c1a-832f3bc87216/users/?test=true', {
    method: 'POST',
    body: form,
    headers: form.getHeaders()
  });
  
  const data = await response.json();
  
  console.log('Response:', JSON.stringify(data, null, 2));
  console.log('\nHas binary?', !!data.binary);
  console.log('Has body?', !!data.body && Object.keys(data.body).length > 0);
  
  fs.unlinkSync('test.txt');
}

test().catch(console.error);
