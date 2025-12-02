import {
    NodeTypes,
    ReactFlowProvider
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useExecutionAwareEdges } from '@/hooks/workflow'
import {
    useCopyPaste,
    useExecutionControls,
    useExecutionPanelData,
    useKeyboardShortcuts,
    useReactFlowInteractions,
    useWorkflowOperations,
} from '@/hooks/workflow'
import { useAddNodeDialogStore, useReactFlowUIStore, useWorkflowStore, useWorkflowToolbarStore } from '@/stores'
import { useNodeTypes } from '@/stores/nodeTypes'
import { templateService } from '@/services'
import { NodeType } from '@/types'
import { useToast } from '@/hooks/useToast'
import { AddNodeCommandDialog } from './AddNodeCommandDialog'
import { RightSidebar } from './RightSidebar'

import { ChatDialog } from './ChatDialog'
import { CreateTemplateDialog } from './CreateTemplateDialog'
import { TemplateVariableDialog } from './TemplateVariableDialog'
import { CustomNode } from './CustomNode'
import { ExecutionPanel } from './ExecutionPanel'
import { NodeConfigDialog } from './NodeConfigDialog'
import { AnnotationNode, ChatInterfaceNode, DataPreviewNode, FormGeneratorNode, GroupNode, ImagePreviewNode } from './nodes'
import { WorkflowCanvas } from './WorkflowCanvas'
import { WorkflowErrorBoundary } from './WorkflowErrorBoundary'
import {
    transformWorkflowEdgesToReactFlow,
    transformWorkflowNodesToReactFlow,
} from './workflowTransformers'

interface WorkflowEditorProps {
    nodeTypes: NodeType[]
    readOnly?: boolean
    executionMode?: boolean
}

export function WorkflowEditor({
    nodeTypes: availableNodeTypes,
    readOnly = false,
    executionMode = false
}: WorkflowEditorProps) {
    // OPTIMIZATION: Use Zustand selectors to prevent unnecessary re-renders
    // Only subscribe to the specific state slices we need
    const workflow = useWorkflowStore(state => state.workflow)
    const showPropertyPanel = useWorkflowStore(state => state.showPropertyPanel)
    const propertyPanelNodeId = useWorkflowStore(state => state.propertyPanelNodeId)
    const showChatDialog = useWorkflowStore(state => state.showChatDialog)
    const chatDialogNodeId = useWorkflowStore(state => state.chatDialogNodeId)
    const undo = useWorkflowStore(state => state.undo)
    const redo = useWorkflowStore(state => state.redo)
    const closeNodeProperties = useWorkflowStore(state => state.closeNodeProperties)
    const closeChatDialog = useWorkflowStore(state => state.closeChatDialog)
    const showTemplateDialog = useWorkflowStore(state => state.showTemplateDialog)
    const closeTemplateDialog = useWorkflowStore(state => state.closeTemplateDialog)
    const showTemplateVariableDialog = useWorkflowStore(state => state.showTemplateVariableDialog)
    const templateVariableDialogData = useWorkflowStore(state => state.templateVariableDialogData)
    const closeTemplateVariableDialog = useWorkflowStore(state => state.closeTemplateVariableDialog)

    const { showSuccess, showError } = useToast()

    // Get dynamic node types from store to include newly uploaded nodes
    const { activeNodeTypes: storeNodeTypes, refetchNodeTypes } = useNodeTypes()

    // Don't load node types on component mount - let them load lazily when needed
    // Node types will be loaded when user opens the add node dialog or nodes sidebar

    // Create dynamic nodeTypes object that includes both built-in and uploaded nodes
    const nodeTypes = useMemo(() => {
        const baseNodeTypes: NodeTypes = {
            custom: CustomNode as any,
            chat: ChatInterfaceNode as any,
            'image-preview': ImagePreviewNode as any,
            'data-preview': DataPreviewNode as any,
            'forms': FormGeneratorNode as any,
            group: GroupNode as any,
            annotation: AnnotationNode as any,
          //  'ai-agent': AIAgentNode,
        }

        // For dynamically uploaded nodes, they all use the CustomNode component
        // The CustomNode component handles different node types based on the data.nodeType
        storeNodeTypes.forEach(nodeType => {
            if (!baseNodeTypes[nodeType.identifier]) {
                baseNodeTypes[nodeType.identifier] = CustomNode as any
            }
        })

        return baseNodeTypes
    }, [storeNodeTypes])

    // Command dialog state
    const { isOpen: showAddNodeDialog, openDialog, closeDialog, position } = useAddNodeDialogStore()

    // Use custom hooks for better organization
    const {
        saveWorkflow,
    } = useWorkflowOperations()

    const {
        nodes,
        edges,
        setNodes,
        setEdges,
        handleNodesChange,
        handleEdgesChange,
        handleConnect,
        handleConnectStart,
        handleConnectEnd,
        handleDrop,
        handleDragOver,
        handleSelectionChange,
        handleNodeDoubleClick,
        handleNodeDragStart,
        handleNodeDrag,
        handleNodeDragStop,
        handleSelectionDragStart,
        handleSelectionDragStop,
        handleNodesDelete,
        handleEdgesDelete,
        blockSync,
    } = useReactFlowInteractions()

    // Copy/paste functionality - automatically registers keyboard shortcuts
    // Ctrl/Cmd+C to copy, Ctrl/Cmd+X to cut, Ctrl/Cmd+V to paste
    // Functions are stored in useCopyPasteStore for use in context menus
    useCopyPaste()

    // OPTIMIZATION: Enhance edges with execution-aware animation
    // Only edges in the current execution path will be animated
    const executionAwareEdges = useExecutionAwareEdges(edges)

    const {
        executionState,
        lastExecutionResult,
        realTimeResults,
        executionLogs,
        getNodeResult,
        clearLogs,
    } = useExecutionControls()

    const {
        showExecutionPanel,
        toggleExecutionPanel,
        executionPanelSize,
        showMinimap,
        showBackground,
        showControls,
        backgroundVariant,
        setReactFlowInstance,
        reactFlowInstance,
        showRightSidebar,
        rightSidebarSize,
    } = useReactFlowUIStore()

    const {
        showNodePalette,
    } = useWorkflowToolbarStore()

    // Get selected nodes from React Flow nodes
    const selectedNodes = useMemo(() => {
        return nodes.filter(node => node.selected)
    }, [nodes])

    // Execution panel data
    const { flowExecutionStatus } = useExecutionPanelData({
        executionId: executionState.executionId,
    })

    // Sync ReactFlow instance to store (hook gets it automatically via useReactFlow)
    const handleReactFlowInit = useCallback((instance: any) => {
        setReactFlowInstance(instance)
    }, [setReactFlowInstance])

    // Memoize empty delete handler to prevent recreation on every render
    const emptyDeleteHandler = useCallback(() => { }, [])

    // Handle template variable submission
    const handleTemplateVariableSubmit = useCallback((values: Record<string, any>) => {
        if (!templateVariableDialogData) return

        const { nodeType, position } = templateVariableDialogData
        const { nodes: templateNodes, connections: templateConnections } = nodeType.templateData

        // Import and expand template with variable values
        import('@/utils/templateExpansion').then(({ expandTemplate }) => {
            const { nodes: expandedNodes, connections: expandedConnections } = expandTemplate(
                templateNodes,
                templateConnections,
                position,
                values // Pass variable values
            )

            // Add nodes and connections
            const addNodes = useWorkflowStore.getState().addNodes
            const addConnections = useWorkflowStore.getState().addConnections

            if (addNodes) {
                addNodes(expandedNodes)
            }
            if (addConnections) {
                addConnections(expandedConnections)
            }

            // Template expanded successfully
        })
    }, [templateVariableDialogData])

    // Handle template creation
    const handleCreateTemplate = useCallback(async (data: {
        name: string
        displayName: string
        description: string
        icon?: string
        color?: string
        group?: string[]
    }) => {
        if (!workflow || selectedNodes.length === 0) return

        const selectedNodeIds = new Set(selectedNodes.map(n => n.id))
        const templateNodes = workflow.nodes.filter(node => selectedNodeIds.has(node.id))
        const templateConnections = workflow.connections.filter(conn =>
            selectedNodeIds.has(conn.sourceNodeId) && selectedNodeIds.has(conn.targetNodeId)
        )

        await templateService.createTemplate({
            ...data,
            nodes: templateNodes,
            connections: templateConnections,
        })

        showSuccess('Template created', {
            message: `Template "${data.displayName}" has been created successfully.`,
        })

        // Reload node types to include the new template
        await refetchNodeTypes()
    }, [workflow, selectedNodes, showSuccess, showError, refetchNodeTypes])

    // Memoize add node handler - calculate viewport center position
    const handleAddNode = useCallback(() => {
        if (reactFlowInstance) {
            // Calculate center of viewport
            const viewportCenter = reactFlowInstance.screenToFlowPosition({
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
            })
            openDialog(viewportCenter)
        } else {
            // Fallback if instance not ready
            openDialog()
        }
    }, [openDialog, reactFlowInstance])

    // Keyboard shortcuts - disabled in read-only mode
    useKeyboardShortcuts({
        onSave: saveWorkflow,
        onUndo: undo,
        onRedo: redo,
        onDelete: emptyDeleteHandler,
        onAddNode: handleAddNode,
        disabled: readOnly
    })

    // Convert workflow data to React Flow format with real execution status
    // Using useMemo to prevent unnecessary re-transformations when dependencies haven't changed
    const reactFlowNodes = useMemo(() => {
        if (!workflow) return []

        return transformWorkflowNodesToReactFlow(
            workflow.nodes,
            availableNodeTypes,
            executionState,
            getNodeResult,
            lastExecutionResult
        )
    }, [workflow?.nodes, availableNodeTypes, executionState, realTimeResults, lastExecutionResult, getNodeResult])

    // Create execution state key and edges with memoization
    const reactFlowEdges = useMemo(() => {
        if (!workflow) return []

        // Create a key that changes when execution state changes to force edge re-renders
        // This ensures edge buttons become visible after execution completes
        const executionStateKey = `${executionState.status}-${executionState.executionId || 'none'}`
        return transformWorkflowEdgesToReactFlow(workflow.connections, executionStateKey)
    }, [workflow?.connections, executionState.status, executionState.executionId])

    // Sync Zustand workflow â†’ React Flow
    // Only sync when workflow ID changes (new workflow loaded) OR when blockSync is false
    const workflowId = workflow?.id;
    const prevWorkflowIdRef = useRef<string | undefined>(undefined);
    const prevReactFlowNodesRef = useRef<any[]>([]);
    
    // Initialize socket listeners for real-time updates
    const initializeRealTimeUpdates = useWorkflowStore(state => state.initializeRealTimeUpdates)
    
    useEffect(() => {
        // Setup socket listeners when component mounts
        initializeRealTimeUpdates()
        // Real-time socket listeners initialized
    }, [initializeRealTimeUpdates])

    useEffect(() => {
        const workflowChanged = workflowId !== prevWorkflowIdRef.current;
        const shouldSync = workflowChanged || !blockSync.current;

        if (shouldSync) {
            if (workflowChanged) {
                console.log('ðŸ”„ Syncing Zustand â†’ React Flow (workflow changed)', workflowId);
            } else {
                console.log('ðŸ”„ Syncing Zustand â†’ React Flow (not blocked)');
            }
            // Preserve current selection when syncing
            const currentNodes = reactFlowInstance?.getNodes() || [];
            const selectedNodeIds = currentNodes.filter(node => node.selected).map(node => node.id);

            // Check if the node structure actually changed (not just execution state)
            const prevNodeIds = prevReactFlowNodesRef.current.map(n => n.id).sort().join(',');
            const newNodeIds = reactFlowNodes.map(n => n.id).sort().join(',');
            const nodesStructureChanged = prevNodeIds !== newNodeIds;

            // Only update if structure changed OR workflow changed
            // This prevents overwriting selection during execution state updates
            if (nodesStructureChanged || workflowChanged) {
                // Update nodes with preserved selection
                // Always use positions from Zustand (don't preserve React Flow positions)
                // This ensures undo/redo works correctly
                const nodesWithSelection = reactFlowNodes.map(node => {
                    return {
                        ...node,
                        selected: selectedNodeIds.includes(node.id),
                        position: node.position // Always use position from Zustand
                    };
                });

                setNodes(nodesWithSelection);
                prevReactFlowNodesRef.current = reactFlowNodes;
            } else {
                // Just update node data without touching selection
                // Always use positions from Zustand for undo/redo to work
                // Also check if parentId changed (for group operations)
                const parentIdsChanged = currentNodes.some(currentNode => {
                    const updatedNode = reactFlowNodes.find(n => n.id === currentNode.id);
                    return updatedNode && currentNode.parentId !== updatedNode.parentId;
                });
                
                if (parentIdsChanged) {
                    // Parent relationships changed, do a full update
                    const nodesWithSelection = reactFlowNodes.map(node => {
                        return {
                            ...node,
                            selected: selectedNodeIds.includes(node.id),
                            position: node.position
                        };
                    });
                    setNodes(nodesWithSelection);
                    prevReactFlowNodesRef.current = reactFlowNodes;
                } else {
                    setNodes((currentNodes) =>
                        currentNodes.map(currentNode => {
                            const updatedNode = reactFlowNodes.find(n => n.id === currentNode.id);
                            if (updatedNode) {
                                return {
                                    ...updatedNode,
                                    selected: currentNode.selected, // Preserve current selection
                                    position: updatedNode.position // Always use position from Zustand
                                };
                            }
                            return currentNode;
                        })
                    );
                }
            }

            // For edges, preserve local control points data to avoid resetting during drag
            // Only do a full edge reset when workflow changes
            if (workflowChanged) {
                setEdges(reactFlowEdges);
            } else {
                // Merge edges: keep local edge data (control points) but update structure
                setEdges((currentEdges) => {
                    const currentEdgeMap = new Map(currentEdges.map(e => [e.id, e]));
                    return reactFlowEdges.map(newEdge => {
                        const currentEdge = currentEdgeMap.get(newEdge.id);
                        const currentPoints = (currentEdge?.data as any)?.points;
                        if (currentEdge && Array.isArray(currentPoints) && currentPoints.length > 0) {
                            // Preserve local control points if they exist
                            return {
                                ...newEdge,
                                data: {
                                    ...newEdge.data,
                                    points: currentPoints,
                                },
                            };
                        }
                        return newEdge;
                    });
                });
            }
            prevWorkflowIdRef.current = workflowId;
        } else {
            console.log('â¸ï¸  Sync blocked - drag in progress');
        }
    }, [workflowId, reactFlowNodes, reactFlowEdges, setNodes, setEdges, blockSync, reactFlowInstance]);

    // Memoize node type map for O(1) lookups
    const nodeTypeMap = useMemo(() => {
        return new Map(availableNodeTypes.map(nt => [nt.identifier, nt]))
    }, [availableNodeTypes])

    // Memoize workflow nodes map for O(1) lookups
    const workflowNodesMap = useMemo(() => {
        if (!workflow?.nodes) return new Map()
        return new Map(workflow.nodes.map(node => [node.id, node]))
    }, [workflow?.nodes])

    // Get selected node data for config panel (O(1) lookup)
    const selectedNode = useMemo(() => {
        return propertyPanelNodeId ? workflowNodesMap.get(propertyPanelNodeId) : null
    }, [propertyPanelNodeId, workflowNodesMap])

    const selectedNodeType = useMemo(() => {
        return selectedNode ? nodeTypeMap.get(selectedNode.type) : null
    }, [selectedNode, nodeTypeMap])

    // Get chat node data for chat dialog (O(1) lookup)
    const chatNode = useMemo(() => {
        return chatDialogNodeId ? workflowNodesMap.get(chatDialogNodeId) : null
    }, [chatDialogNodeId, workflowNodesMap])

    const chatNodeName = useMemo(() => {
        return chatNode?.name || 'Chat'
    }, [chatNode])

    return (
        <div className="flex flex-col h-full w-full">
            <WorkflowErrorBoundary>
                {/* Main Content Area with Resizable Panels */}
                <div className="flex-1 flex h-full">
                    <ResizablePanelGroup direction="horizontal" className="flex-1">
                        {/* Main Editor Area */}
                        <ResizablePanel defaultSize={showRightSidebar ? (100 - rightSidebarSize) : ((readOnly || !showNodePalette) ? 100 : 80)} minSize={30}>
                            {/* Resizable Layout for Canvas and Execution Panel */}
                            <ResizablePanelGroup direction="vertical" className="h-full">
                                {/* React Flow Canvas */}
                                <ResizablePanel
                                    key={`canvas-${executionPanelSize}`}
                                    defaultSize={100 - executionPanelSize}
                                    minSize={30}
                                >
                                    <WorkflowCanvas
                                        nodes={nodes}
                                        edges={executionAwareEdges}
                                        nodeTypes={nodeTypes}
                                        showControls={showControls}
                                        showMinimap={showMinimap}
                                        showBackground={showBackground}
                                        backgroundVariant={backgroundVariant}
                                        onInit={handleReactFlowInit}
                                        readOnly={readOnly}
                                        executionMode={executionMode}
                                        // Event handlers from useReactFlowInteractions
                                        onNodesChange={handleNodesChange}
                                        onEdgesChange={handleEdgesChange}
                                        onConnect={handleConnect}
                                        onConnectStart={handleConnectStart}
                                        onConnectEnd={handleConnectEnd}
                                        onDrop={handleDrop}
                                        onDragOver={handleDragOver}
                                        onSelectionChange={handleSelectionChange}
                                        onNodeDoubleClick={handleNodeDoubleClick}
                                        onNodeDragStart={handleNodeDragStart}
                                        onNodeDrag={handleNodeDrag}
                                        onNodeDragStop={handleNodeDragStop}
                                        onSelectionDragStart={handleSelectionDragStart}
                                        onSelectionDragStop={handleSelectionDragStop}
                                        onNodesDelete={handleNodesDelete}
                                        onEdgesDelete={handleEdgesDelete}
                                    />
                                </ResizablePanel>

                                {/* Execution Panel */}
                                <>
                                    <ResizableHandle withHandle />
                                    <ResizablePanel
                                        key={`execution-${executionPanelSize}`}
                                        defaultSize={executionPanelSize}
                                        minSize={4}
                                        maxSize={70}
                                    >
                                        <ExecutionPanel
                                            executionState={executionState}
                                            lastExecutionResult={lastExecutionResult}
                                            executionLogs={executionLogs}
                                            realTimeResults={realTimeResults}
                                            flowExecutionStatus={flowExecutionStatus}
                                            isExpanded={showExecutionPanel}
                                            onToggle={toggleExecutionPanel}
                                            onClearLogs={clearLogs}
                                        />
                                    </ResizablePanel>
                                </>
                            </ResizablePanelGroup>
                        </ResizablePanel>

                        {/* Right Sidebar - Settings, Copilot, Code */}
                        {showRightSidebar && (
                            <>
                                <ResizableHandle withHandle />
                                <ResizablePanel defaultSize={rightSidebarSize} minSize={15} maxSize={40}>
                                    <RightSidebar 
                                        selectedNodes={selectedNodes}
                                        readOnly={readOnly}
                                    />
                                </ResizablePanel>
                            </>
                        )}

                    </ResizablePanelGroup>
                </div>
            </WorkflowErrorBoundary>

            {/* Node Configuration Dialog */}
            {selectedNode && selectedNodeType && (
                <NodeConfigDialog
                    node={selectedNode}
                    nodeType={selectedNodeType}
                    isOpen={showPropertyPanel}
                    onClose={closeNodeProperties}
                    readOnly={readOnly}
                />
            )}

            {/* Chat Dialog */}
            {chatDialogNodeId && (
                <ChatDialog
                    nodeId={chatDialogNodeId}
                    nodeName={chatNodeName}
                    isOpen={showChatDialog}
                    onClose={closeChatDialog}
                />
            )}



            {/* Add Node Command Dialog - Hidden in read-only mode */}
            {!readOnly && (
                <AddNodeCommandDialog
                    open={showAddNodeDialog}
                    onOpenChange={closeDialog}
                    position={position}
                />
            )}

            {/* Create Template Dialog */}
            {workflow && selectedNodes.length > 0 && (
                <CreateTemplateDialog
                    open={showTemplateDialog}
                    onOpenChange={closeTemplateDialog}
                    nodes={workflow.nodes.filter(n => selectedNodes.some(sn => sn.id === n.id))}
                    connections={workflow.connections.filter(conn =>
                        selectedNodes.some(n => n.id === conn.sourceNodeId) &&
                        selectedNodes.some(n => n.id === conn.targetNodeId)
                    )}
                    onCreateTemplate={handleCreateTemplate}
                />
            )}

            {/* Template Variable Configuration Dialog */}
            {showTemplateVariableDialog && templateVariableDialogData && (
                <TemplateVariableDialog
                    open={showTemplateVariableDialog}
                    onOpenChange={closeTemplateVariableDialog}
                    variables={templateVariableDialogData.nodeType.templateData?.variables || []}
                    templateName={templateVariableDialogData.nodeType.displayName}
                    onSubmit={handleTemplateVariableSubmit}
                />
            )}
        </div>
    )
}

// Wrapper component with ReactFlowProvider
export function WorkflowEditorWrapper(props: WorkflowEditorProps) {
    return (
        <ReactFlowProvider>
            <WorkflowEditor {...props} />
        </ReactFlowProvider>
    )
}
