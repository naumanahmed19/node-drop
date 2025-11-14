# Enhanced Edge Animation for Execution Path Visualization

## Overview
Improved edge animation to show the **actual execution path** being followed in real-time, including which branches of IfElse nodes are being taken.

## Features

### 1. Real-Time Path Visualization
- **Active Edges** (Green, Animated): Edges currently being traversed
- **Completed Edges** (Indigo): Edges that have been traversed
- **Pending Edges** (Gray, Faded): Edges in the execution path but not yet reached

### 2. Branch Decision Visualization
- Shows which branch of an IfElse node is being followed
- Only the active branch (true or false) is animated
- The inactive branch remains gray/faded

### 3. Smooth Transitions
- Edges animate for 800ms when activated
- Smooth transition from active (green) to completed (indigo)
- Clear visual feedback of execution flow

## Implementation

### Backend Changes (`RealtimeExecutionEngine.ts`)

When a node completes, the backend now includes information about which connections/edges will be activated next:

```typescript
// Find which edges/connections will be activated by this node
const activeConnections = context.connections
    .filter((conn) => conn.sourceNodeId === nodeId)
    .map((conn) => ({
        id: conn.id,
        sourceNodeId: conn.sourceNodeId,
        targetNodeId: conn.targetNodeId,
        sourceOutput: conn.sourceOutput,
    }));

// Emit node completed event with active connections
this.emit("node-completed", {
    executionId,
    nodeId,
    // ... other fields
    activeConnections, // NEW: Include which connections are active
});
```

### Frontend Changes

#### 1. Updated `ExecutionFlowStatus` Type (`types/execution.ts`)
```typescript
export interface ExecutionFlowStatus {
  // ... existing fields
  activeEdges?: Set<string>;      // Edges currently being traversed
  completedEdges?: Set<string>;   // Edges that have been traversed
}
```

#### 2. Enhanced Edge Animation Hook (`hooks/useEdgeAnimation.ts`)
```typescript
export function useExecutionAwareEdges(edges: Edge[]): Edge[] {
  const activeEdges = useActiveEdges();
  const completedEdges = useCompletedEdges();
  
  return edges.map((edge) => {
    const isActive = activeEdges.has(edge.id);
    const isCompleted = completedEdges.has(edge.id);
    
    if (isActive) {
      // Green, thick, animated
      return { ...edge, animated: true, style: { stroke: "#10b981", strokeWidth: 3 } };
    } else if (isCompleted) {
      // Indigo, medium, not animated
      return { ...edge, animated: false, style: { stroke: "#6366f1", strokeWidth: 2 } };
    }
    // ... pending edges
  });
}
```

#### 3. Workflow Store Updates (`stores/workflow.ts`)
When a `node-completed` event is received:
1. Extract `activeConnections` from the event data
2. Add connection IDs to `activeEdges` set
3. After 800ms, move them to `completedEdges` set
4. Trigger re-render to update edge styles

## Visual States

### During Execution

```
[Trigger] ──green──> [IfElse] ──green──> [Node A]  (true branch - active)
                      │
                      └──gray──> [Node B]  (false branch - inactive)
```

After a few moments:

```
[Trigger] ──indigo──> [IfElse] ──indigo──> [Node A]  (completed)
                       │
                       └──gray──> [Node B]  (skipped)
```

### Color Scheme
- **Green (#10b981)**: Active edge (currently traversing)
- **Indigo (#6366f1)**: Completed edge (already traversed)
- **Gray (#94a3b8)**: Pending edge (in path but not reached)
- **Default**: Edges not in execution path

### Stroke Width
- **Active**: 3px (thickest)
- **Completed**: 2px (medium)
- **Pending**: 1.5px (thin)
- **Default**: 1px

## How It Works with IfElse Nodes

1. **IfElse Node Executes**
   - Evaluates condition
   - Returns data on one branch only (true or false)

2. **Backend Sends activeConnections**
   - Includes only the connections from the active branch
   - Example: If condition is false, only includes connection to "false" output

3. **Frontend Animates Active Branch**
   - Edge to the active branch turns green and animates
   - Edge to the inactive branch stays gray (not animated)

4. **After 800ms**
   - Active edge turns indigo (completed)
   - Next node starts executing
   - Its outgoing edges become active

## Benefits

1. **Clear Execution Flow**: Users can see exactly which path the workflow is taking
2. **Branch Visibility**: Immediately see which branch of an IfElse node is being followed
3. **Debugging Aid**: Helps identify unexpected execution paths
4. **Visual Feedback**: Smooth animations provide satisfying user experience
5. **Performance**: Only animates edges that are actually being used

## Testing

To test the enhanced edge animation:

1. **Restart backend** to get the updated `node-completed` events
2. Create a workflow with an IfElse node
3. Connect different nodes to the "true" and "false" outputs
4. Run the workflow
5. Watch the edges animate:
   - Green animation on the active branch
   - Gray (no animation) on the inactive branch
   - Indigo for completed edges

## Future Enhancements

Potential improvements:
- Add edge labels showing data count (e.g., "3 items")
- Different animation speeds based on data volume
- Pulse effect for high-priority paths
- Edge tooltips showing execution timing
- Replay mode to review execution path
