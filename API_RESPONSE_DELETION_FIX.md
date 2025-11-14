# API Response Node Deletion Fix

## Problem
The API Response node was not being deleted when using the package deletion endpoint, while PostgreSQL and other nodes were being deleted successfully.

## Root Cause
The deletion logic in `backend/src/routes/node-types.ts` had **case-sensitivity issues** when matching node types:

### API Response Node Structure:
- **Package name**: `api-response`
- **Node type** (in database): `apiResponse` (camelCase)
- **File name**: `ApiResponse.node.js` (PascalCase)
- **package.json**: Uses `nodeDrop.nodes` structure

### PostgreSQL Node Structure:
- **Package name**: `PostgreSQL`
- **Node type** (in database): `postgres` (lowercase)
- **File name**: `postgres.node.js` (lowercase)
- **package.json**: Uses `nodes` at root level

### The Issue:
When extracting the node type from the filename `ApiResponse.node.js`, the code would get `ApiResponse` (PascalCase), but the database stores it as `apiResponse` (camelCase). The exact match comparison failed:

```javascript
// Old code - exact match only
const matchingNode = allNodeTypes.find(nt => nt.type === potentialType);
```

## Solution
Updated the node type matching logic in **two strategies**:

### 1. Strategy 2 - Package.json Parsing
- Added support for both `nodeDrop.nodes` and `nodes` structures
- Changed to **case-insensitive matching** with fallback to exact match

```javascript
// Support both nodeDrop.nodes and nodes at root level
const nodesList = packageInfo.nodeDrop?.nodes || packageInfo.nodes || [];

// Try case-insensitive matching first, then exact match
const matchingNode = allNodeTypes.find(nt => 
  nt.type.toLowerCase() === potentialType.toLowerCase() || nt.type === potentialType
);
```

### 2. Strategy 3 - File Scanning
- Changed to **case-insensitive matching** with fallback to exact match

```javascript
// Try case-insensitive matching first, then exact match
const matchingNode = allNodeTypes.find(nt => 
  nt.type.toLowerCase() === potentialType.toLowerCase() || nt.type === potentialType
);
```

## Testing
To test the fix:
1. Try deleting the `api-response` package via the API
2. Verify it's removed from both database and filesystem
3. Test with other nodes to ensure backward compatibility

## Files Modified
- `backend/src/routes/node-types.ts` - Updated node type matching logic in deletion endpoint
