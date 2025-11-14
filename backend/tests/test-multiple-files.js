const FormData = require('form-data');
const axios = require('axios');

async function testMultipleFiles() {
  const form = new FormData();
  
  // Add form fields
  form.append('name', 'Ahmad');
  form.append('email', 'test@example.com');
  
  // Create test files
  const file1Content = 'This is the first test file';
  const file2Content = 'This is the second test file';
  const file3Content = JSON.stringify({ message: 'This is a JSON file' }, null, 2);
  
  // Add multiple files with different field names
  form.append('file1', Buffer.from(file1Content), {
    filename: 'test1.txt',
    contentType: 'text/plain'
  });
  
  form.append('file2', Buffer.from(file2Content), {
    filename: 'test2.txt',
    contentType: 'text/plain'
  });
  
  form.append('document', Buffer.from(file3Content), {
    filename: 'data.json',
    contentType: 'application/json'
  });
  
  try {
    const response = await axios.post(
      'http://localhost:4000/webhook/test-webhook?test=true',
      form,
      {
        headers: form.getHeaders()
      }
    );
    
    console.log('✅ Response Status:', response.status);
    console.log('📦 Response Data:', JSON.stringify(response.data, null, 2));
    
    // Check binary data
    if (response.data?.data?.main?.[0]?.binary) {
      console.log('\n📎 Files received:');
      Object.keys(response.data.data.main[0].binary).forEach(fieldName => {
        const file = response.data.data.main[0].binary[fieldName];
        console.log(`  - ${fieldName}: ${file.fileName} (${file.fileSize} bytes, ${file.mimeType})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testMultipleFiles();
