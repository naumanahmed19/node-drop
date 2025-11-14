import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useAutoLayout, useCrossWindowCopyPaste, useWorkflowOperations } from '@/hooks/workflow';
import { useCopyPasteStore, useReactFlowUIStore, useWorkflowStore, useWorkflowToolbarStore } from '@/stores';
import { useReactFlow } from '@xyflow/react';
import {
    ArrowDownToLine,
    ArrowRightToLine,
    CheckCircle,
    Clipboard,
    Copy,
    Download,
    Eye,
    EyeOff,
    FileText,
    Grid,
    Grid3X3,
    Hash,
    History,
    Lock,
    Map,
    Maximize,
    Minimize2,
    MousePointerClick,
    Network,
    Palette,
    Play,
    Plus,
    Power,
    PowerOff,
    Redo,
    Save,
    Scissors,
    Settings,
    Undo,
    Unlock,
    Upload,
    ZoomIn,
    ZoomOut
} from 'lucide-react';
import React, { memo, useCallback, useMemo } from 'react';

interface WorkflowCanvasContextMenuProps {
  children: React.ReactNode
  readOnly?: boolean
}

export const WorkflowCanvasContextMenu = memo(function WorkflowCanvasContextMenu({
  children,
  readOnly = false
}: WorkflowCanvasContextMenuProps) {
  // Use stores directly instead of hooks with local state
  const {
    workflow,
    undo,
    redo,
    canUndo,
    canRedo,
    toggleWorkflowActive,
  } = useWorkflowStore()

  const {
    saveWorkflow,
    validateAndShowResult,
    handleExport,
    handleImport,
    isExporting,
    isImporting,
    hasUnsavedChanges,
  } = useWorkflowOperations()

  // Copy/paste functions from store
  const { copy, cut, paste, canCopy, canPaste } = useCopyPasteStore()

  // Cross-window copy/paste
  const { shareNodes, importSharedNodes } = useCrossWindowCopyPaste()

  // ReactFlow instance for select all
  const { getNodes, setNodes } = useReactFlow()

  // Auto-layout functions
  const { applyHorizontalLayout, applyVerticalLayout } = useAutoLayout()

  // ReactFlow UI state from store
  const {
    showMinimap,
    showBackground,
    showControls,
    showExecutionPanel,
    compactMode,
    panOnDrag,
    zoomOnScroll,
    toggleMinimap,
    toggleBackground,
    toggleControls,
    togglePanOnDrag,
    toggleZoomOnScroll,
    toggleCompactMode,
    changeBackgroundVariant,
    toggleExecutionPanel,
    zoomIn,
    zoomOut,
    fitView,
    zoomToFit,
  } = useReactFlowUIStore()

  // Toolbar state from store
  const {
    showNodePalette,
    showExecutionsPanel,
    toggleNodePalette,
    toggleExecutionsPanel,
  } = useWorkflowToolbarStore()

  // Memoize undo/redo state to prevent function calls on every render
  const canUndoState = useMemo(() => canUndo(), [canUndo])
  const canRedoState = useMemo(() => canRedo(), [canRedo])
  
  // Memoize workflow active state
  const isWorkflowActive = useMemo(() => workflow?.active, [workflow?.active])

  // Select all nodes handler
  const handleSelectAll = useCallback(() => {
    const nodes = getNodes()
    setNodes(nodes.map(node => ({ ...node, selected: true })))
  }, [getNodes, setNodes])

  // Memoize import handler to prevent recreation
  const handleImportClick = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        handleImport(file)
      }
    }
    input.click()
  }, [handleImport])

  // Memoize background variant handlers
  const handleDotsPattern = useCallback(() => changeBackgroundVariant('dots'), [changeBackgroundVariant])
  const handleLinesPattern = useCallback(() => changeBackgroundVariant('lines'), [changeBackgroundVariant])
  const handleCrossPattern = useCallback(() => changeBackgroundVariant('cross'), [changeBackgroundVariant])
  const handleNoPattern = useCallback(() => changeBackgroundVariant('none'), [changeBackgroundVariant])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {/* File Operations */}
        <ContextMenuItem
          onClick={saveWorkflow}
          disabled={!hasUnsavedChanges || readOnly}
          className="cursor-pointer"
        >
          <Save className="mr-2 h-4 w-4" />
          Save Workflow
        </ContextMenuItem>
        
        {/* Import/Export */}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="cursor-pointer">
            <FileText className="mr-2 h-4 w-4" />
            Import/Export
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem
              onClick={handleExport}
              disabled={isExporting}
              className="cursor-pointer"
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? 'Exporting...' : 'Export Workflow'}
            </ContextMenuItem>
            <ContextMenuItem
              onClick={handleImportClick}
              disabled={isImporting || readOnly}
              className="cursor-pointer"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isImporting ? 'Importing...' : 'Import Workflow'}
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        {/* Edit Operations */}
        <ContextMenuItem
          onClick={undo}
          disabled={!canUndoState || readOnly}
          className="cursor-pointer"
        >
          <Undo className="mr-2 h-4 w-4" />
          Undo
        </ContextMenuItem>
        <ContextMenuItem
          onClick={redo}
          disabled={!canRedoState || readOnly}
          className="cursor-pointer"
        >
          <Redo className="mr-2 h-4 w-4" />
          Redo
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Auto Layout */}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="cursor-pointer" disabled={readOnly}>
            <Network className="mr-2 h-4 w-4" />
            Auto Layout
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem
              onClick={applyHorizontalLayout}
              disabled={readOnly}
              className="cursor-pointer"
            >
              <ArrowRightToLine className="mr-2 h-4 w-4" />
              Horizontal Layout
            </ContextMenuItem>
            <ContextMenuItem
              onClick={applyVerticalLayout}
              disabled={readOnly}
              className="cursor-pointer"
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Vertical Layout
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        {/* Select/Copy/Paste Operations */}
        <ContextMenuItem
          onClick={handleSelectAll}
          className="cursor-pointer"
        >
          <MousePointerClick className="mr-2 h-4 w-4" />
          Select All
        </ContextMenuItem>

        <ContextMenuSub>
          <ContextMenuSubTrigger className="cursor-pointer">
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem
              onClick={copy || undefined}
              disabled={!canCopy || readOnly}
              className="cursor-pointer"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy (Same Window)
            </ContextMenuItem>
            <ContextMenuItem
              onClick={shareNodes}
              disabled={!canCopy || readOnly}
              className="cursor-pointer"
            >
              <Clipboard className="mr-2 h-4 w-4" />
              Copy to Clipboard
              <span className="ml-auto text-xs text-muted-foreground">Cross-window</span>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuItem
          onClick={cut || undefined}
          disabled={!canCopy || readOnly}
          className="cursor-pointer"
        >
          <Scissors className="mr-2 h-4 w-4" />
          Cut
        </ContextMenuItem>

        <ContextMenuSub>
          <ContextMenuSubTrigger className="cursor-pointer">
            <Clipboard className="mr-2 h-4 w-4" />
            Paste
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem
              onClick={paste || undefined}
              disabled={!canPaste || readOnly}
              className="cursor-pointer"
            >
              <Clipboard className="mr-2 h-4 w-4" />
          Paste (Same Window)
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => importSharedNodes()}
              disabled={readOnly}
              className="cursor-pointer"
            >
              <Clipboard className="mr-2 h-4 w-4" />
              Paste from Clipboard
              <span className="ml-auto text-xs text-muted-foreground">Cross-window</span>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        {/* Workflow Control */}
        <ContextMenuItem
          onClick={toggleWorkflowActive}
          disabled={readOnly}
          className="cursor-pointer"
        >
          {isWorkflowActive ? (
            <>
              <PowerOff className="mr-2 h-4 w-4" />
              Deactivate Workflow
            </>
          ) : (
            <>
              <Power className="mr-2 h-4 w-4" />
              Activate Workflow
            </>
          )}
        </ContextMenuItem>

        <ContextMenuItem
          onClick={validateAndShowResult}
          className="cursor-pointer"
        >
          <CheckCircle className="mr-2 h-4 w-4" />
          Validate Workflow
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* View Panels */}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            View Panels
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem
              onClick={toggleExecutionPanel}
              className="cursor-pointer"
            >
              <Play className="mr-2 h-4 w-4" />
              {showExecutionPanel ? 'Hide' : 'Show'} Execution Panel
            </ContextMenuItem>
            <ContextMenuItem
              onClick={toggleExecutionsPanel}
              className="cursor-pointer"
            >
              <History className="mr-2 h-4 w-4" />
              {showExecutionsPanel ? 'Hide' : 'Show'} Executions History
            </ContextMenuItem>
            <ContextMenuItem
              onClick={toggleNodePalette}
              className="cursor-pointer"
            >
              <Palette className="mr-2 h-4 w-4" />
              {showNodePalette ? 'Hide' : 'Show'} Node Palette
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* ReactFlow View Options */}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="cursor-pointer">
            <Eye className="mr-2 h-4 w-4" />
            Canvas View
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-52">
            <ContextMenuItem
              onClick={toggleMinimap}
              className="cursor-pointer"
            >
              {showMinimap ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {showMinimap ? 'Hide' : 'Show'} Minimap
            </ContextMenuItem>
            <ContextMenuItem
              onClick={toggleBackground}
              className="cursor-pointer"
            >
              <Grid3X3 className="mr-2 h-4 w-4" />
              {showBackground ? 'Hide' : 'Show'} Grid Background
            </ContextMenuItem>
            <ContextMenuItem
              onClick={toggleControls}
              className="cursor-pointer"
            >
              <Settings className="mr-2 h-4 w-4" />
              {showControls ? 'Hide' : 'Show'} Controls
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={toggleCompactMode}
              className="cursor-pointer"
            >
              {compactMode ? (
                <>
                  <Maximize className="mr-2 h-4 w-4" />
                  Show Node Titles
                </>
              ) : (
                <>
                  <Minimize2 className="mr-2 h-4 w-4" />
                  Compact Mode
                </>
              )}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={togglePanOnDrag}
              className="cursor-pointer"
            >
              {panOnDrag ? (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Lock Canvas Pan
                </>
              ) : (
                <>
                  <Unlock className="mr-2 h-4 w-4" />
                  Unlock Canvas Pan
                </>
              )}
            </ContextMenuItem>
            <ContextMenuItem
              onClick={toggleZoomOnScroll}
              className="cursor-pointer"
            >
              {zoomOnScroll ? (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Lock Zoom
                </>
              ) : (
                <>
                  <Unlock className="mr-2 h-4 w-4" />
                  Unlock Zoom
                </>
              )}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={zoomIn}
              className="cursor-pointer"
            >
              <ZoomIn className="mr-2 h-4 w-4" />
              Zoom In
            </ContextMenuItem>
            <ContextMenuItem
              onClick={zoomOut}
              className="cursor-pointer"
            >
              <ZoomOut className="mr-2 h-4 w-4" />
              Zoom Out
            </ContextMenuItem>
            <ContextMenuItem
              onClick={fitView}
              className="cursor-pointer"
            >
              <Maximize className="mr-2 h-4 w-4" />
              Fit to View
            </ContextMenuItem>
            <ContextMenuItem
              onClick={zoomToFit}
              className="cursor-pointer"
            >
              <Map className="mr-2 h-4 w-4" />
              Zoom to Fit All
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger className="cursor-pointer">
                <Grid className="mr-2 h-4 w-4" />
                Background Pattern
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem onClick={handleDotsPattern}>
                  <Grid className="mr-2 h-4 w-4" />
                  Dots Pattern
                </ContextMenuItem>
                <ContextMenuItem onClick={handleLinesPattern}>
                  <Hash className="mr-2 h-4 w-4" />
                  Lines Pattern
                </ContextMenuItem>
                <ContextMenuItem onClick={handleCrossPattern}>
                  <Plus className="mr-2 h-4 w-4" />
                  Cross Pattern
                </ContextMenuItem>
                <ContextMenuItem onClick={handleNoPattern}>
                  <EyeOff className="mr-2 h-4 w-4" />
                  No Pattern
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  )
})
