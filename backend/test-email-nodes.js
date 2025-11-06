/**
 * Test script to verify email nodes are loadable
 */

const path = require('path');

console.log('🔍 Testing Email Nodes...\n');

// Test loading email-send node
try {
  const emailSendPath = path.join(__dirname, 'custom-nodes/email/nodes/email-send.node.js');
  console.log('📄 Loading Email Send from:', emailSendPath);
  
  delete require.cache[require.resolve(emailSendPath)];
  const EmailSendNode = require(emailSendPath);
  
  console.log('✅ Email Send Node loaded successfully!');
  console.log('   Type:', EmailSendNode.type);
  console.log('   Display Name:', EmailSendNode.displayName);
  console.log('   Group:', EmailSendNode.group);
  console.log('   Properties:', EmailSendNode.properties.length);
  console.log('   Has execute function:', typeof EmailSendNode.execute === 'function');
  console.log('');
} catch (error) {
  console.error('❌ Failed to load Email Send Node:', error.message);
  console.log('');
}

// Test loading email-receive node
try {
  const emailReceivePath = path.join(__dirname, 'custom-nodes/email/nodes/email-receive.node.js');
  console.log('📄 Loading Email Receive from:', emailReceivePath);
  
  delete require.cache[require.resolve(emailReceivePath)];
  const EmailReceiveNode = require(emailReceivePath);
  
  console.log('✅ Email Receive Node loaded successfully!');
  console.log('   Type:', EmailReceiveNode.type);
  console.log('   Display Name:', EmailReceiveNode.displayName);
  console.log('   Group:', EmailReceiveNode.group);
  console.log('   Properties:', EmailReceiveNode.properties.length);
  console.log('   Has execute function:', typeof EmailReceiveNode.execute === 'function');
  console.log('');
} catch (error) {
  console.error('❌ Failed to load Email Receive Node:', error.message);
  console.log('');
}

// Test loading via index.js
try {
  const indexPath = path.join(__dirname, 'custom-nodes/email/index.js');
  console.log('📄 Loading via index.js from:', indexPath);
  
  delete require.cache[require.resolve(indexPath)];
  const emailPackage = require(indexPath);
  
  console.log('✅ Email package loaded via index.js!');
  console.log('   Nodes:', Object.keys(emailPackage.nodes));
  console.log('   Credentials:', Object.keys(emailPackage.credentials));
  console.log('');
} catch (error) {
  console.error('❌ Failed to load via index.js:', error.message);
  console.log('');
}

console.log('✨ Test complete!\n');
console.log('📝 Next steps:');
console.log('   1. Restart your backend server');
console.log('   2. Or call: POST /api/node-types/refresh-custom');
console.log('   3. Check the backend logs for node loading messages');
