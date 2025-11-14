import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { WorkflowEditorWrapper } from '../../../components/workflow/WorkflowEditor'
import { useNodeTypes } from '../../../stores/nodeTypes'

// Mock the node types store
vi.mock('../../../stores/nodeTypes')
vi.mock('../../../stores/workflow')
vi.mock('../../../stores/auth')

// Mock ReactFlow and other dependencies
vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useReactFlow: () => ({
    screenToFlowPosition: vi.fn(() => ({ x: 0, y: 0 })),
  }),
}))

vi.mock('../../../components/workflow/WorkflowCanvas', () => ({
  WorkflowCanvas: ({ nodeTypes }: { nodeTypes: any }) => (
    <div data-testid="workflow-canvas" data-node-types={JSON.stringify(Object.keys(nodeTypes))} />
  )
}))

// Mock other components to avoid complex dependencies
vi.mock('../../../components/workflow/ExecutionPanel', () => ({
  ExecutionPanel: () => <div data-testid="execution-panel" />
}))

vi.mock('../../../components/workflow/AddNodeCommandDialog', () => ({
  AddNodeCommandDialog: () => <div data-testid="add-node-dialog" />
}))

vi.mock('../../../components/workflow/WorkflowErrorBoundary', () => ({
  WorkflowErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('../../../hooks/workflow', () => ({
  useWorkflowOperations: () => ({ saveWorkflow: vi.fn() }),
  useReactFlowInteractions: () => ({
    nodes: [],
    edges: [],
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    handleNodesChange: vi.fn(),
    handleEdgesChange: vi.fn(),
    handleConnect: vi.fn(),
    handleConnectStart: vi.fn(),
    handleConnectEnd: vi.fn(),
    handleDrop: vi.fn(),
    handleDragOver: vi.fn(),
    handleSelectionChange: vi.fn(),
    handleNodeDoubleClick: vi.fn(),
    handleNodeDragStart: vi.fn(),
    handleNodeDrag: vi.fn(),
    handleNodeDragStop: vi.fn(),
    handleSelectionDragStart: vi.fn(),
    handleSelectionDragStop: vi.fn(),
    handleNodesDelete: vi.fn(),
    handleEdgesDelete: vi.fn(),
    blockSync: { current: false },
  }),
  useCopyPaste: () => ({}),
  useExecutionControls: () => ({
    executionState: { status: 'idle' },
    lastExecutionResult: null,
    realTimeResults: new Map(),
    executionLogs: [],
    getNodeResult: vi.fn(),
    getFlowStatus: vi.fn(),
    getExecutionMetrics: vi.fn(),
    clearLogs: vi.fn(),
  }),
  useExecutionPanelData: () => ({
    flowExecutionStatus: null,
    executionMetrics: null,
  }),
  useKeyboardShortcuts: () => ({}),
}))

vi.mock('../../../hooks/workflow/useEdgeAnimation', () => ({
  useExecutionAwareEdges: (edges: any) => edges,
}))

vi.mock('../../../stores', () => ({
  useAddNodeDialogStore: () => ({
    isOpen: false,
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    position: null,
  }),
  useReactFlowUIStore: () => ({
    showExecutionPanel: false,
    toggleExecutionPanel: vi.fn(),
    executionPanelSize: 30,
    showMinimap: false,
    showBackground: false,
    showControls: false,
    backgroundVariant: 'dots',
    setReactFlowInstance: vi.fn(),
    reactFlowInstance: null,
  }),
  useWorkflowStore: () => ({
    workflow: null,
    showPropertyPanel: false,
    propertyPanelNodeId: null,
    showChatDialog: false,
    chatDialogNodeId: null,
    undo: vi.fn(),
    redo: vi.fn(),
    closeNodeProperties: vi.fn(),
    closeChatDialog: vi.fn(),
    readOnly: false,
  }),
  useWorkflowToolbarStore: () => ({
    showNodePalette: false,
  }),
}))

describe('WorkflowEditor Dynamic Node Types', () => {
  const mockUseNodeTypes = vi.mocked(useNodeTypes)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should include built-in node types in nodeTypes object', () => {
    mockUseNodeTypes.mockReturnValue({
      activeNodeTypes: [],
      fetchNodeTypes: vi.fn(),
      hasFetched: true,
      isLoading: false,
      isRefetching: false,
      nodeTypes: [],
      error: null,
      refetchNodeTypes: vi.fn(),
      updateNodeType: vi.fn(),
      removeNodeType: vi.fn(),
      clearError: vi.fn(),
      getNodeTypeById: vi.fn(),
      getNodeTypesByCategory: vi.fn(),
      getActiveNodeTypesByCategory: vi.fn(),
    })

    const { container } = render(
      <WorkflowEditorWrapper nodeTypes={[]} />
    )

    const workflowCanvas = container.querySelector('[data-testid="workflow-canvas"]')
    expect(workflowCanvas).toBeTruthy()
    
    const nodeTypesAttr = workflowCanvas?.getAttribute('data-node-types')
    const nodeTypes = JSON.parse(nodeTypesAttr || '[]')
    
    // Should include built-in node types
    expect(nodeTypes).toContain('custom')
    expect(nodeTypes).toContain('chat')
    expect(nodeTypes).toContain('image-preview')
    expect(nodeTypes).toContain('form-generator')
    expect(nodeTypes).toContain('group')
    expect(nodeTypes).toContain('annotation')
  })

  it('should include dynamically uploaded node types', () => {
    const mockUploadedNodeType = {
      type: 'test-uploaded-node',
      displayName: 'Test Uploaded Node',
      group: ['Custom'],
      properties: [],
      active: true,
    }

    mockUseNodeTypes.mockReturnValue({
      activeNodeTypes: [mockUploadedNodeType],
      fetchNodeTypes: vi.fn(),
      hasFetched: true,
      isLoading: false,
      isRefetching: false,
      nodeTypes: [mockUploadedNodeType],
      error: null,
      refetchNodeTypes: vi.fn(),
      updateNodeType: vi.fn(),
      removeNodeType: vi.fn(),
      clearError: vi.fn(),
      getNodeTypeById: vi.fn(),
      getNodeTypesByCategory: vi.fn(),
      getActiveNodeTypesByCategory: vi.fn(),
    })

    const { container } = render(
      <WorkflowEditorWrapper nodeTypes={[]} />
    )

    const workflowCanvas = container.querySelector('[data-testid="workflow-canvas"]')
    expect(workflowCanvas).toBeTruthy()
    
    const nodeTypesAttr = workflowCanvas?.getAttribute('data-node-types')
    const nodeTypes = JSON.parse(nodeTypesAttr || '[]')
    
    // Should include both built-in and uploaded node types
    expect(nodeTypes).toContain('custom')
    expect(nodeTypes).toContain('test-uploaded-node')
  })

  it('should fetch node types on mount if not already fetched', () => {
    const mockFetchNodeTypes = vi.fn()
    
    mockUseNodeTypes.mockReturnValue({
      activeNodeTypes: [],
      fetchNodeTypes: mockFetchNodeTypes,
      hasFetched: false,
      isLoading: false,
      isRefetching: false,
      nodeTypes: [],
      error: null,
      refetchNodeTypes: vi.fn(),
      updateNodeType: vi.fn(),
      removeNodeType: vi.fn(),
      clearError: vi.fn(),
      getNodeTypeById: vi.fn(),
      getNodeTypesByCategory: vi.fn(),
      getActiveNodeTypesByCategory: vi.fn(),
    })

    render(<WorkflowEditorWrapper nodeTypes={[]} />)

    expect(mockFetchNodeTypes).toHaveBeenCalled()
  })

  it('should not fetch node types if already fetched', () => {
    const mockFetchNodeTypes = vi.fn()
    
    mockUseNodeTypes.mockReturnValue({
      activeNodeTypes: [],
      fetchNodeTypes: mockFetchNodeTypes,
      hasFetched: true,
      isLoading: false,
      isRefetching: false,
      nodeTypes: [],
      error: null,
      refetchNodeTypes: vi.fn(),
      updateNodeType: vi.fn(),
      removeNodeType: vi.fn(),
      clearError: vi.fn(),
      getNodeTypeById: vi.fn(),
      getNodeTypesByCategory: vi.fn(),
      getActiveNodeTypesByCategory: vi.fn(),
    })

    render(<WorkflowEditorWrapper nodeTypes={[]} />)

    expect(mockFetchNodeTypes).not.toHaveBeenCalled()
  })
})