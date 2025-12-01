import { useReactFlowAutoLayout } from '@/hooks/useReactFlowAutoLayout'
import { useReactFlowStyles } from '@/hooks/useReactFlowStyles'
import { useReactFlowUIStore } from '@/stores'
import { Background, BackgroundVariant, Edge, EdgeTypes, MiniMap, Node, NodeTypes, ReactFlow, SelectionMode } from '@xyflow/react'
import { useMemo, useRef } from 'react'
import { WorkflowCanvasContextMenu } from './WorkflowCanvasContextMenu'
import { WorkflowControls } from './WorkflowControls'
import { EditableEdgeComponent } from './EditableEdge'
import { ConnectionLine } from './ConnectionLine'
import './reactflow-theme.css'

// Define edge types once outside component to prevent re-creation
const edgeTypes: EdgeTypes = {
    default: EditableEdgeComponent,
    smoothstep: EditableEdgeComponent,
    'editable-edge': EditableEdgeComponent,
}

interface WorkflowCanvasProps {
    nodes: Node[]
    edges: Edge[]
    nodeTypes: NodeTypes
    showControls: boolean
    showMinimap: boolean
    showBackground: boolean
    backgroundVariant: string
    onInit: (instance: any) => void
    readOnly?: boolean
    executionMode?: boolean
    // Event handlers
    onNodesChange: any
    onEdgesChange: any
    onConnect: any
    onConnectStart: any
    onConnectEnd: any
    onDrop: any
    onDragOver: any
    onSelectionChange: any
    onNodeDoubleClick: any
    onNodeDragStart: any
    onNodeDrag: any
    onNodeDragStop: any
    onSelectionDragStart: any
    onSelectionDragStop: any
    onNodesDelete: any
    onEdgesDelete: any
}

export function WorkflowCanvas({
    nodes,
    edges,
    nodeTypes,
    showControls,
    showMinimap,
    showBackground,
    backgroundVariant,
    onInit,
    readOnly = false,
    executionMode = false,
    // Event handlers from parent
    onNodesChange: handleNodesChange,
    onEdgesChange: handleEdgesChange,
    onConnect: handleConnect,
    onConnectStart: handleConnectStart,
    onConnectEnd: handleConnectEnd,
    onDrop: handleDrop,
    onDragOver: handleDragOver,
    onSelectionChange: handleSelectionChange,
    onNodeDoubleClick: handleNodeDoubleClick,
    onNodeDragStart: handleNodeDragStart,
    onNodeDrag: handleNodeDrag,
    onNodeDragStop: handleNodeDragStop,
    onSelectionDragStart: handleSelectionDragStart,
    onSelectionDragStop: handleSelectionDragStop,
    onNodesDelete: handleNodesDelete,
    onEdgesDelete: handleEdgesDelete,
}: WorkflowCanvasProps) {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);

    // Get panOnDrag and zoomOnScroll settings from store
    const { panOnDrag, zoomOnScroll, reactFlowInstance } = useReactFlowUIStore()

    // Use custom hooks for better code organization
    const { edgeStyle, connectionLineStyle, isDarkMode } = useReactFlowStyles()
    const combinedRef = useReactFlowAutoLayout({
        reactFlowInstance,
        nodesCount: nodes.length,
        enabled: false,
        delay: 50,
        additionalRef: reactFlowWrapper
    })

    // Determine if interactions should be disabled
    const isDisabled = readOnly || executionMode

    // Memoize background variant to prevent unnecessary recalculations
    const displayBackgroundVariant = useMemo(() =>
        isDisabled ? BackgroundVariant.Cross : (backgroundVariant as any),
        [isDisabled, backgroundVariant]
    )

    const backgroundColor = useMemo(() =>
        isDisabled ? 'hsl(var(--muted))' : undefined,
        [isDisabled]
    )

    // Memoize defaultEdgeOptions to prevent ReactFlow re-initialization
    // NOTE: animated property is now set per-edge by useExecutionAwareEdges hook
    // This ensures only edges in the current execution path are animated
    const defaultEdgeOptions = useMemo(() => ({
        type: 'editable-edge' as const,
        style: edgeStyle,
        data: {
            algorithm: 'Step',
            points: [],
        },
    }), [edgeStyle])

    // Memoize MiniMap style to prevent object re-creation
    const miniMapStyle = useMemo(() => ({
        backgroundColor: isDarkMode ? 'hsl(var(--card))' : '#fff',
    }), [isDarkMode])

    // Memoize disabled handlers (undefined) vs enabled handlers
    const nodesChangeHandler = useMemo(() =>
        isDisabled ? undefined : handleNodesChange,
        [isDisabled, handleNodesChange]
    )

    const edgesChangeHandler = useMemo(() =>
        isDisabled ? undefined : handleEdgesChange,
        [isDisabled, handleEdgesChange]
    )

    const connectHandler = useMemo(() =>
        isDisabled ? undefined : handleConnect,
        [isDisabled, handleConnect]
    )

    const connectStartHandler = useMemo(() =>
        isDisabled ? undefined : handleConnectStart,
        [isDisabled, handleConnectStart]
    )

    const connectEndHandler = useMemo(() =>
        isDisabled ? undefined : handleConnectEnd,
        [isDisabled, handleConnectEnd]
    )

    const dropHandler = useMemo(() =>
        isDisabled ? undefined : handleDrop,
        [isDisabled, handleDrop]
    )

    const dragOverHandler = useMemo(() =>
        isDisabled ? undefined : handleDragOver,
        [isDisabled, handleDragOver]
    )

    // Memoize undo/redo snapshot handlers
    const nodeDragStartHandler = useMemo(() =>
        isDisabled ? undefined : handleNodeDragStart,
        [isDisabled, handleNodeDragStart]
    )

    const nodeDragHandler = useMemo(() =>
        isDisabled ? undefined : handleNodeDrag,
        [isDisabled, handleNodeDrag]
    )

    const nodeDragStopHandler = useMemo(() =>
        isDisabled ? undefined : handleNodeDragStop,
        [isDisabled, handleNodeDragStop]
    )

    const selectionDragStartHandler = useMemo(() =>
        isDisabled ? undefined : handleSelectionDragStart,
        [isDisabled, handleSelectionDragStart]
    )

    const selectionDragStopHandler = useMemo(() =>
        isDisabled ? undefined : handleSelectionDragStop,
        [isDisabled, handleSelectionDragStop]
    )

    const nodesDeleteHandler = useMemo(() =>
        isDisabled ? undefined : handleNodesDelete,
        [isDisabled, handleNodesDelete]
    )

    const edgesDeleteHandler = useMemo(() =>
        isDisabled ? undefined : handleEdgesDelete,
        [isDisabled, handleEdgesDelete]
    )

    return (
        <WorkflowCanvasContextMenu readOnly={isDisabled}>
            <div className="h-full" ref={combinedRef} style={{ backgroundColor }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={nodesChangeHandler}
                    onEdgesChange={edgesChangeHandler}
                    onConnect={connectHandler}
                    onConnectStart={connectStartHandler}
                    onConnectEnd={connectEndHandler}
                    onInit={onInit}
                    onDrop={dropHandler}
                    onDragOver={dragOverHandler}
                    onSelectionChange={handleSelectionChange}
                    onNodeDoubleClick={(event, node) => handleNodeDoubleClick(event, node.id)}
                    onNodeDragStart={nodeDragStartHandler}
                    onNodeDrag={nodeDragHandler}
                    onNodeDragStop={nodeDragStopHandler}
                    onSelectionDragStart={selectionDragStartHandler}
                    onSelectionDragStop={selectionDragStopHandler}
                    onNodesDelete={nodesDeleteHandler}
                    onEdgesDelete={edgesDeleteHandler}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    nodesDraggable={!isDisabled}
                    nodesConnectable={!isDisabled}
                    elementsSelectable={true}
                    deleteKeyCode={isDisabled ? null : ["Backspace", "Delete"]}
                    panOnDrag={panOnDrag}
                    zoomOnScroll={zoomOnScroll}
                    zoomOnDoubleClick={false}
                    connectionLineStyle={connectionLineStyle}
                    connectionLineComponent={ConnectionLine}
                    // translateExtent={[[-canvasBoundaryX, -canvasBoundaryY], [canvasBoundaryX, canvasBoundaryY]]}
                    // nodeExtent={[[-canvasBoundaryX, -canvasBoundaryY], [canvasBoundaryX, canvasBoundaryY]]}
                    attributionPosition="bottom-left"
                    selectNodesOnDrag={false}
                    selectionOnDrag={true}
                    selectionKeyCode="Shift"
                    multiSelectionKeyCode="Shift"
                    selectionMode={SelectionMode.Partial}
                    fitView
                    fitViewOptions={{ padding: 0.3, maxZoom: 1.5 }}
                    defaultViewport={{ x: 0, y: 0, zoom: 1.5 }}
                    minZoom={0.1}
                    maxZoom={2}
                    defaultEdgeOptions={defaultEdgeOptions}
                >
                    {showControls && (
                        <WorkflowControls showAddNode={!isDisabled} showExecute={!isDisabled} showUndoRedo={!isDisabled} />
                    )}
                    {showMinimap && (
                        <MiniMap
                            nodeColor={isDarkMode ? '#334155' : '#e2e8f0'}
                            maskColor={isDarkMode ? 'rgba(28, 37, 51, 0.6)' : 'rgba(0, 0, 0, 0.1)'}
                            style={miniMapStyle}
                        />
                    )}
                    {showBackground && (
                        <Background
                            variant={displayBackgroundVariant}
                            gap={isDisabled ? 20 : 12}
                            size={isDisabled ? 2 : 1}
                            color={isDisabled ? '#cbd5e1' : undefined}
                        />
                    )}
                </ReactFlow>
            </div>
        </WorkflowCanvasContextMenu>
    )
}
