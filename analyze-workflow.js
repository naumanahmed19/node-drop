// Workflow Connection Analyzer
const workflow = require('./workflow-debug.json').workflow;

console.log('=== WORKFLOW ANALYSIS ===\n');

console.log('Nodes:');
workflow.nodes.forEach(node => {
  console.log(`  - ${node.name} (${node.id}) [${node.type}]`);
});

console.log('\nConnections:');
workflow.connections.forEach(conn => {
  const sourceNode = workflow.nodes.find(n => n.id === conn.sourceNodeId);
  const targetNode = workflow.nodes.find(n => n.id === conn.targetNodeId);
  console.log(`  - ${sourceNode?.name} → ${targetNode?.name}`);
  console.log(`    ID: ${conn.id}`);
  console.log(`    Source: ${conn.sourceNodeId} (${conn.sourceOutput})`);
  console.log(`    Target: ${conn.targetNodeId} (${conn.targetInput})`);
  console.log('');
});

console.log('\n=== INPUT ANALYSIS FOR ANTHROPIC NODE ===\n');
const anthropicNode = workflow.nodes.find(n => n.type === 'anthropic');
if (anthropicNode) {
  console.log(`Node: ${anthropicNode.name} (${anthropicNode.id})`);
  console.log('\nInput Connections:');
  
  const inputs = workflow.connections.filter(conn => conn.targetNodeId === anthropicNode.id);
  inputs.forEach((conn, index) => {
    const sourceNode = workflow.nodes.find(n => n.id === conn.sourceNodeId);
    console.log(`  ${index + 1}. From: ${sourceNode?.name} (${sourceNode?.type})`);
    console.log(`     Connection ID: ${conn.id}`);
  });
  
  console.log(`\nTotal Inputs: ${inputs.length}`);
  
  if (inputs.length > 1) {
    console.log('\n⚠️  WARNING: This node has multiple input connections!');
    console.log('This means it will receive data from multiple sources.');
    console.log('\nIf you only want ONE input, you should remove the extra connection(s).');
  }
}

console.log('\n=== RECOMMENDED FIX ===\n');
console.log('If you want the workflow to be: HTTP Request → IF → Anthropic');
console.log('Then you should remove the direct connection: HTTP Request → Anthropic');
console.log('\nConnection to remove:');
const directConn = workflow.connections.find(
  conn => conn.sourceNodeId === 'node-1762292488960' && conn.targetNodeId === 'node-1762293883853'
);
if (directConn) {
  console.log(`  ID: ${directConn.id}`);
  console.log('  This is the direct HTTP Request → Anthropic connection');
}
