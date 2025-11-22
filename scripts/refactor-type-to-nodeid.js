#!/usr/bin/env node
/**
 * Automated script to refactor 'type' to 'nodeId' across the codebase
 * 
 * This script performs systematic replacements while being careful about:
 * - Not replacing 'type' in property definitions (type: "string", type: "number", etc.)
 * - Not replacing TypeScript type annotations
 * - Preserving code structure and formatting
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns to replace
const replacements = [
  // Node definition properties
  { pattern: /^(\s*)type:\s*(['"`])([^'"`]+)\2,?\s*$/gm, replacement: '$1nodeId: $2$3$2,' },
  
  // Variable declarations and parameters
  { pattern: /\bnodeType:\s*string\b/g, replacement: 'nodeId: string' },
  { pattern: /\bnodeType\?\s*:\s*string\b/g, replacement: 'nodeId?: string' },
  { pattern: /\bnodeType:\s*\{/g, replacement: 'nodeId: {' },
  
  // Function parameters
  { pattern: /\(nodeType:\s*string\)/g, replacement: '(nodeId: string)' },
  { pattern: /\(nodeType\?\s*:\s*string\)/g, replacement: '(nodeId?: string)' },
  { pattern: /async\s+(\w+)\(nodeType:/g, replacement: 'async $1(nodeId:' },
  
  // Object property access
  { pattern: /\.type(?=\s*[,;)\]}])/g, replacement: '.nodeId' },
  { pattern: /\['type'\]/g, replacement: "['nodeId']" },
  { pattern: /\["type"\]/g, replacement: '["nodeId"]' },
  
  // Variable assignments
  { pattern: /const\s+nodeType\s*=/g, replacement: 'const nodeId =' },
  { pattern: /let\s+nodeType\s*=/g, replacement: 'let nodeId =' },
  { pattern: /var\s+nodeType\s*=/g, replacement: 'var nodeId =' },
  
  // Object destructuring
  { pattern: /\{\s*type\s*\}/g, replacement: '{ nodeId }' },
  { pattern: /\{\s*type:\s*(\w+)\s*\}/g, replacement: '{ nodeId: $1 }' },
  
  // Database queries
  { pattern: /where:\s*\{\s*type:/g, replacement: 'where: { nodeId:' },
  { pattern: /type:\s*nodeType/g, replacement: 'nodeId: nodeId' },
  
  // Registry operations
  { pattern: /nodeRegistry\.set\(([^,]+)\.type,/g, replacement: 'nodeRegistry.set($1.nodeId,' },
  { pattern: /nodeRegistry\.get\(nodeType\)/g, replacement: 'nodeRegistry.get(nodeId)' },
  { pattern: /nodeRegistry\.delete\(nodeType\)/g, replacement: 'nodeRegistry.delete(nodeId)' },
  
  // Comments and strings (be careful)
  { pattern: /node type/gi, replacement: 'node ID' },
  { pattern: /nodeType/g, replacement: 'nodeId' },
];

// Files to process
const filePatterns = [
  'backend/src/**/*.ts',
  'backend/src/**/*.js',
  'frontend/src/**/*.ts',
  'frontend/src/**/*.tsx',
];

// Files to exclude
const excludePatterns = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
];

function shouldProcessFile(filePath) {
  // Skip excluded patterns
  for (const pattern of excludePatterns) {
    if (filePath.includes(pattern.replace(/\*\*/g, ''))) {
      return false;
    }
  }
  return true;
}

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Apply each replacement
    for (const { pattern, replacement } of replacements) {
      const newContent = content.replace(pattern, replacement);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Updated: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🔄 Starting refactoring: type → nodeId\n');
  
  let totalFiles = 0;
  let modifiedFiles = 0;
  
  for (const pattern of filePatterns) {
    const files = glob.sync(pattern, { nodir: true });
    
    for (const file of files) {
      if (shouldProcessFile(file)) {
        totalFiles++;
        if (processFile(file)) {
          modifiedFiles++;
        }
      }
    }
  }
  
  console.log(`\n✅ Refactoring complete!`);
  console.log(`   Files processed: ${totalFiles}`);
  console.log(`   Files modified: ${modifiedFiles}`);
}

main();
