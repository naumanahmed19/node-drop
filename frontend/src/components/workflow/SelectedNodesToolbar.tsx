import { useWorkflowStore } from '@/stores'
import { WorkflowNode } from '@/types'
import {
  Node,
  NodeToolbar,
  useNodes,
  useReactFlow,
  useStore,
  useStoreApi,
} from '@xyflow/react'

const GROUP_PADDING = 25

/**
 * This toolbar is not bound to a specific node, but to the selected nodes.
 * It will show up when multiple nodes are selected and allow to group them.
 */
export default function SelectedNodesToolbar() {
  const nodes = useNodes()
  const { setNodes, getNodesBounds } = useReactFlow()
  const store = useStoreApi()
  
  // Access workflow store for state management
  const { workflow, updateWorkflow, setDirty, saveToHistory } = useWorkflowStore()

  // we are using useStore here, in order to prevent re-renders on every node change.
  const selectedNodes = useStore((state) => {
    return state.nodes.filter(
      (node) =>
        node.selected && 
        !node.parentId && 
        !state.parentLookup.get(node.id) &&
        node.type !== 'group'
    )
  })

  if (selectedNodes.length === 0) {
    return null
  }

  const selectedNodeIds = selectedNodes.map((node) => node.id)

  const onGroup = () => {
    // Take snapshot for undo/redo
    saveToHistory('Group nodes')
    
    const groupId = `group_${Math.random() * 10000}`
    const selectedNodesRectangle = getNodesBounds(selectedNodes)
    const groupNodePosition = {
      x: selectedNodesRectangle.x,
      y: selectedNodesRectangle.y,
    }

    // this is a new node that gets added to our nodes
    const groupNode = {
      id: groupId,
      type: 'group',
      position: groupNodePosition,
      style: {
        width: selectedNodesRectangle.width + GROUP_PADDING * 2,
        height: selectedNodesRectangle.height + GROUP_PADDING * 2,
      },
      data: {},
    }

    const nextNodes: Node[] = nodes.map((node) => {
      if (selectedNodeIds.includes(node.id)) {
        return {
          ...node,
          // here we calculate a relative position of the node inside the group
          position: {
            x: node.position.x - groupNodePosition.x + GROUP_PADDING,
            y: node.position.y - groupNodePosition.y + GROUP_PADDING,
          },
          extent: 'parent' as const,
          parentId: groupId,
          expandParent: true,
        }
      }

      return node
    })

    // Update React Flow nodes
    setNodes([groupNode, ...nextNodes])
    
    // Sync to Zustand workflow store
    if (workflow) {
      const allNodes = [groupNode, ...nextNodes]
      const existingNodesMap = new Map(workflow.nodes.map(n => [n.id, n]))
      
      const updatedWorkflowNodes: WorkflowNode[] = []
      
      allNodes.forEach((rfNode) => {
        const existingNode = existingNodesMap.get(rfNode.id)
        
        if (rfNode.type === 'group') {
          // Add the new group node
          updatedWorkflowNodes.push({
            id: rfNode.id,
            type: 'group',
            name: '',
            description: undefined,
            parameters: rfNode.data || {},
            position: rfNode.position,
            disabled: false,
            style: rfNode.style as any,
          })
        } else if (existingNode) {
          // Update existing node with parent relationship
          const anyRfNode = rfNode as any
          updatedWorkflowNodes.push({
            ...existingNode,
            position: rfNode.position,
            parentId: anyRfNode.parentId || undefined,
            extent: (anyRfNode.extent || undefined) as any,
          })
        }
      })
      
      // Skip history since we already saved before grouping
      updateWorkflow({ nodes: updatedWorkflowNodes }, true)
      setDirty(true) // Mark workflow as dirty
    }

    // we need to unselect all nodes to hide the toolbar
    store.getState().resetSelectedElements()
    store.setState({ nodesSelectionActive: false })
  }

  return (
    <NodeToolbar nodeId={selectedNodeIds} isVisible>
      <button className="group-node-button" onClick={onGroup}>
        Group selected nodes
      </button>
    </NodeToolbar>
  )
}
