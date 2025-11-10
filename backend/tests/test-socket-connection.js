/**
 * Test Socket.IO connection and workflow subscription
 * This helps debug if the frontend is properly connected to the backend
 */

const io = require('socket.io-client');

const BACKEND_URL = 'http://localhost:4000';
const WORKFLOW_ID = 'cmhc339fl0003ugricrt1qm49';

console.log('🔌 Testing Socket.IO Connection\n');
console.log(`Backend URL: ${BACKEND_URL}`);
console.log(`Workflow ID: ${WORKFLOW_ID}\n`);

// Create socket connection
const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
});

socket.on('connect', () => {
  console.log('✅ Connected to backend');
  console.log(`   Socket ID: ${socket.id}\n`);

  // Subscribe to workflow
  console.log(`📡 Subscribing to workflow: ${WORKFLOW_ID}`);
  socket.emit('subscribe-workflow', WORKFLOW_ID);
});

socket.on('workflow-subscribed', (data) => {
  console.log('✅ Subscribed to workflow:', data);
  console.log('\n🎉 Socket connection is working!');
  console.log('\nNow trigger your webhook with ?test=true and you should see events here.\n');
});

socket.on('webhook-test-triggered', (data) => {
  console.log('\n🧪 WEBHOOK TEST TRIGGERED!');
  console.log(JSON.stringify(data, null, 2));
  console.log('\n✅ The webhook test mode is working correctly!');
  console.log('   You should see the same message in your browser console.\n');
});

socket.on('execution-event', (event) => {
  console.log('\n🟢 Execution Event:', {
    type: event.type,
    executionId: event.executionId,
    nodeId: event.nodeId,
    timestamp: event.timestamp,
  });
});

socket.on('execution-progress', (progress) => {
  console.log('\n🔵 Execution Progress:', {
    executionId: progress.executionId,
    completedNodes: progress.completedNodes,
    totalNodes: progress.totalNodes,
    status: progress.status,
  });
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  console.log('\n💡 Make sure the backend server is running on port 4000\n');
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('\n⚠️  Disconnected:', reason);
  if (reason === 'io server disconnect') {
    console.log('   Server disconnected the socket. Reconnecting...');
    socket.connect();
  }
});

// Keep the script running
console.log('👂 Listening for events... (Press Ctrl+C to exit)\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Disconnecting...');
  socket.disconnect();
  process.exit(0);
});
