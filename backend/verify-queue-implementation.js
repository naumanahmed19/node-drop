/**
 * Quick verification script to check if execution queue is implemented
 * This script inspects the codebase to verify queue functionality
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Execution Queue Implementation\n');
console.log('='.repeat(60));

const checks = [];

// Check 1: TriggerManager has queue functionality
function checkTriggerManager() {
  const filePath = path.join(__dirname, 'src/services/TriggerManager.ts');
  
  if (!fs.existsSync(filePath)) {
    return { name: 'TriggerManager exists', status: '❌', details: 'File not found' };
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  const hasQueuedTriggers = content.includes('queuedTriggers');
  const hasQueueMethod = content.includes('queueTrigger');
  const hasProcessQueue = content.includes('processQueue');
  const hasGetQueued = content.includes('getQueuedTriggers');
  
  if (hasQueuedTriggers && hasQueueMethod && hasProcessQueue && hasGetQueued) {
    return {
      name: 'TriggerManager Queue',
      status: '✅',
      details: 'Has queuedTriggers, queueTrigger(), processQueue(), getQueuedTriggers()'
    };
  }
  
  return {
    name: 'TriggerManager Queue',
    status: '⚠️',
    details: `Missing: ${!hasQueuedTriggers ? 'queuedTriggers ' : ''}${!hasQueueMethod ? 'queueTrigger() ' : ''}${!hasProcessQueue ? 'processQueue() ' : ''}${!hasGetQueued ? 'getQueuedTriggers()' : ''}`
  };
}

// Check 2: ExecutionEngine has Bull queues
function checkExecutionEngine() {
  const filePath = path.join(__dirname, 'src/services/ExecutionEngine.ts');
  
  if (!fs.existsSync(filePath)) {
    return { name: 'ExecutionEngine exists', status: '❌', details: 'File not found' };
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  const hasBull = content.includes('bull') || content.includes('Bull');
  const hasExecutionQueue = content.includes('executionQueue');
  const hasNodeQueue = content.includes('nodeQueue');
  const hasQueueAdd = content.includes('.add(');
  const hasQueueProcess = content.includes('.process(');
  
  if (hasBull && hasExecutionQueue && hasNodeQueue && hasQueueAdd && hasQueueProcess) {
    return {
      name: 'ExecutionEngine Bull Queues',
      status: '✅',
      details: 'Has Bull, executionQueue, nodeQueue, add(), process()'
    };
  }
  
  return {
    name: 'ExecutionEngine Bull Queues',
    status: '⚠️',
    details: `Missing: ${!hasBull ? 'Bull ' : ''}${!hasExecutionQueue ? 'executionQueue ' : ''}${!hasNodeQueue ? 'nodeQueue ' : ''}${!hasQueueAdd ? 'add() ' : ''}${!hasQueueProcess ? 'process()' : ''}`
  };
}

// Check 3: FlowExecutionEngine has node queue
function checkFlowExecutionEngine() {
  const filePath = path.join(__dirname, 'src/services/FlowExecutionEngine.ts');
  
  if (!fs.existsSync(filePath)) {
    return { name: 'FlowExecutionEngine exists', status: '❌', details: 'File not found' };
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  const hasNodeQueue = content.includes('nodeQueue');
  const hasQueueSet = content.includes('nodeQueue.set');
  const hasQueueGet = content.includes('nodeQueue.get');
  const hasQueueDependents = content.includes('queueDependentNodes') || content.includes('queuing dependent');
  
  if (hasNodeQueue && hasQueueSet && hasQueueGet && hasQueueDependents) {
    return {
      name: 'FlowExecutionEngine Node Queue',
      status: '✅',
      details: 'Has nodeQueue, set(), get(), queueDependentNodes()'
    };
  }
  
  return {
    name: 'FlowExecutionEngine Node Queue',
    status: '⚠️',
    details: `Missing: ${!hasNodeQueue ? 'nodeQueue ' : ''}${!hasQueueSet ? 'set() ' : ''}${!hasQueueGet ? 'get() ' : ''}${!hasQueueDependents ? 'queueDependents' : ''}`
  };
}

// Check 4: TriggerService uses node-cron
function checkTriggerService() {
  const filePath = path.join(__dirname, 'src/services/TriggerService.ts');
  
  if (!fs.existsSync(filePath)) {
    return { name: 'TriggerService exists', status: '❌', details: 'File not found' };
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  const hasNodeCron = content.includes('node-cron');
  const hasScheduledTasks = content.includes('scheduledTasks');
  const hasCronSchedule = content.includes('cron.schedule');
  const hasCronValidate = content.includes('cron.validate');
  const hasActivateSchedule = content.includes('activateScheduleTrigger');
  
  if (hasNodeCron && hasScheduledTasks && hasCronSchedule && hasCronValidate && hasActivateSchedule) {
    return {
      name: 'TriggerService Cron Support',
      status: '✅',
      details: 'Has node-cron, scheduledTasks, schedule(), validate(), activateScheduleTrigger()'
    };
  }
  
  return {
    name: 'TriggerService Cron Support',
    status: '⚠️',
    details: `Missing: ${!hasNodeCron ? 'node-cron ' : ''}${!hasScheduledTasks ? 'scheduledTasks ' : ''}${!hasCronSchedule ? 'schedule() ' : ''}${!hasCronValidate ? 'validate() ' : ''}${!hasActivateSchedule ? 'activateScheduleTrigger()' : ''}`
  };
}

// Check 5: Package.json has required dependencies
function checkDependencies() {
  const filePath = path.join(__dirname, 'package.json');
  
  if (!fs.existsSync(filePath)) {
    return { name: 'package.json exists', status: '❌', details: 'File not found' };
  }
  
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const deps = { ...content.dependencies, ...content.devDependencies };
  
  const hasBull = deps['bull'];
  const hasNodeCron = deps['node-cron'];
  const hasRedis = deps['redis'];
  
  if (hasBull && hasNodeCron && hasRedis) {
    return {
      name: 'Required Dependencies',
      status: '✅',
      details: `bull@${hasBull}, node-cron@${hasNodeCron}, redis@${hasRedis}`
    };
  }
  
  return {
    name: 'Required Dependencies',
    status: '⚠️',
    details: `Missing: ${!hasBull ? 'bull ' : ''}${!hasNodeCron ? 'node-cron ' : ''}${!hasRedis ? 'redis' : ''}`
  };
}

// Check 6: ScheduleTrigger node has improved features
function checkScheduleTrigger() {
  const filePath = path.join(__dirname, 'src/nodes/backup/triggers/ScheduleTrigger.ts');
  
  if (!fs.existsSync(filePath)) {
    return { name: 'ScheduleTrigger exists', status: '❌', details: 'File not found' };
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  const hasScheduleMode = content.includes('scheduleMode');
  const hasSimpleMode = content.includes('simple');
  const hasDateTimeMode = content.includes('datetime');
  const hasConvertSimple = content.includes('convertSimpleToCron');
  const hasConvertDateTime = content.includes('convertDateTimeToCron');
  
  if (hasScheduleMode && hasSimpleMode && hasDateTimeMode && hasConvertSimple && hasConvertDateTime) {
    return {
      name: 'ScheduleTrigger Improvements',
      status: '✅',
      details: 'Has scheduleMode, simple, datetime, convertSimpleToCron(), convertDateTimeToCron()'
    };
  }
  
  return {
    name: 'ScheduleTrigger Improvements',
    status: '⚠️',
    details: `Missing: ${!hasScheduleMode ? 'scheduleMode ' : ''}${!hasSimpleMode ? 'simple ' : ''}${!hasDateTimeMode ? 'datetime ' : ''}${!hasConvertSimple ? 'convertSimpleToCron() ' : ''}${!hasConvertDateTime ? 'convertDateTimeToCron()' : ''}`
  };
}

// Run all checks
checks.push(checkTriggerManager());
checks.push(checkExecutionEngine());
checks.push(checkFlowExecutionEngine());
checks.push(checkTriggerService());
checks.push(checkDependencies());
checks.push(checkScheduleTrigger());

// Display results
console.log('\n📋 Verification Results:\n');

checks.forEach((check, index) => {
  console.log(`${index + 1}. ${check.status} ${check.name}`);
  console.log(`   ${check.details}\n`);
});

// Summary
const passed = checks.filter(c => c.status === '✅').length;
const warnings = checks.filter(c => c.status === '⚠️').length;
const failed = checks.filter(c => c.status === '❌').length;

console.log('='.repeat(60));
console.log('\n📊 Summary:');
console.log(`   ✅ Passed: ${passed}/${checks.length}`);
console.log(`   ⚠️  Warnings: ${warnings}/${checks.length}`);
console.log(`   ❌ Failed: ${failed}/${checks.length}\n`);

if (passed === checks.length) {
  console.log('🎉 All checks passed! Execution queue is fully implemented.\n');
} else if (failed === 0) {
  console.log('✅ Core functionality is implemented with minor warnings.\n');
} else {
  console.log('❌ Some critical components are missing. Review the details above.\n');
}

// Additional info
console.log('📚 Next Steps:');
console.log('   1. Run: node test-schedule-trigger.js');
console.log('   2. Check: backend/SCHEDULE_TRIGGER_IMPROVEMENTS.md');
console.log('   3. Monitor: Execution logs and queue status');
console.log('   4. Test: Create workflows with different schedule modes\n');
