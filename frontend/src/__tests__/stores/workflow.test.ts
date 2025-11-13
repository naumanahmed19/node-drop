import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useWorkflowStore } from '@/stores/workflow'
import { Workflow, WorkflowNode, WorkflowConnection } from '@/types'
import { workflowFileService } from '@/services/workflowFile'
import { ensureWorkflowMetadata } from '@/utils/workflowMetadata'

// Helper function to create expected workflow with metadata
const createExpectedWorkflow = (workflow: Workflow): Workflow => {
  const result = ensureWorkflowMetadata(workflow)
  // Normalize timestamp to avoid millisecond precision issues in tests
  if (result.metadata) {
    result.metadata.lastTitleUpdate = expect.any(String) as any
  }
  return result
}

// Mock workflow data
const mockWorkflow: Workflow = {
  id: 'test-workflow',
  name: 'Test Workflow',
  description: 'A test workflow',
  userId: 'test-user',
  nodes: [
    {
      id: 'node-1',
      type: 'http-request',
      name: 'HTTP Request',
      parameters: { method: 'GET', url: 'https://api.example.com' },
      position: { x: 100, y: 100 },
      credentials: [],
      disabled: false
    },
    {
      id: 'node-2',
      type: 'json-transform',
      name: 'Transform Data',
      parameters: { expression: 'return items;' },
      position: { x: 300, y: 100 },
      credentials: [],
      disabled: false
    }
  ],
  connections: [
    {
      id: 'conn-1',
      sourceNodeId: 'node-1',
      sourceOutput: 'main',
      targetNodeId: 'node-2',
      targetInput: 'main'
    }
  ],
  settings: {
    timezone: 'UTC',
    saveDataErrorExecution: 'all',
    saveDataSuccessExecution: 'all',
    saveManualExecutions: true,
    callerPolicy: 'workflowsFromSameOwner'
  },
  active: false,
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z'
}

describe('WorkflowStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useWorkflowStore.setState({
      workflow: null,
      selectedNodeId: null,
      isLoading: false,
      isDirty: false,
      history: [],
      historyIndex: -1,
      workflowTitle: '',
      isTitleDirty: false,
      titleValidationError: null,
      isExporting: false,
      isImporting: false,
      importProgress: 0,
      exportProgress: 0,
      importError: null,
      exportError: null,
      executionState: {
        status: 'idle',
        progress: 0,
        startTime: undefined,
        endTime: undefined,
        error: undefined,
        executionId: undefined
      },
      lastExecutionResult: null
    })
    
    // Clear all mocks
    vi.clearAllMocks()
  })

  describe('setWorkflow', () => {
    it('should set workflow and mark as not dirty', () => {
      const { setWorkflow } = useWorkflowStore.getState()
      
      setWorkflow(mockWorkflow)
      
      const state = useWorkflowStore.getState()
      expect(state.workflow).toEqual(createExpectedWorkflow(mockWorkflow))
      expect(state.isDirty).toBe(false)
    })

    it('should save to history when setting workflow', () => {
      const { setWorkflow } = useWorkflowStore.getState()
      
      setWorkflow(mockWorkflow)
      
      const state = useWorkflowStore.getState()
      expect(state.history).toHaveLength(1)
      expect(state.history[0].action).toBe('Load workflow')
      expect(state.historyIndex).toBe(0)
    })
  })

  describe('addNode', () => {
    it('should add node to workflow and mark as dirty', () => {
      const { setWorkflow, addNode } = useWorkflowStore.getState()
      setWorkflow(mockWorkflow)
      
      const newNode: WorkflowNode = {
        id: 'node-3',
        type: 'set-values',
        name: 'Set Values',
        parameters: { values: [] },
        position: { x: 500, y: 100 },
        credentials: [],
        disabled: false
      }
      
      addNode(newNode)
      
      const state = useWorkflowStore.getState()
      expect(state.workflow?.nodes).toHaveLength(3)
      expect(state.workflow?.nodes[2]).toEqual(newNode)
      expect(state.isDirty).toBe(true)
    })

    it('should save to history when adding node', () => {
      const { setWorkflow, addNode } = useWorkflowStore.getState()
      setWorkflow(mockWorkflow)
      const initialHistoryLength = useWorkflowStore.getState().history.length
      
      const newNode: WorkflowNode = {
        id: 'node-3',
        type: 'set-values',
        name: 'Set Values',
        parameters: { values: [] },
        position: { x: 500, y: 100 },
        credentials: [],
        disabled: false
      }
      
      addNode(newNode)
      
      const state = useWorkflowStore.getState()
      expect(state.history).toHaveLength(initialHistoryLength + 1)
      expect(state.history[state.history.length - 1].action).toBe('Add node: Set Values')
    })
  })

  describe('updateNode', () => {
    it('should update node and mark as dirty', () => {
      const { setWorkflow, updateNode } = useWorkflowStore.getState()
      setWorkflow(mockWorkflow)
      
      updateNode('node-1', { name: 'Updated HTTP Request' })
      
      const state = useWorkflowStore.getState()
      const updatedNode = state.workflow?.nodes.find(n => n.id === 'node-1')
      expect(updatedNode?.name).toBe('Updated HTTP Request')
      expect(state.isDirty).toBe(true)
    })
  })

  describe('addConnection', () => {
    it('should add valid connection', () => {
      const { setWorkflow, addNode, addConnection } = useWorkflowStore.getState()
      setWorkflow(mockWorkflow)
      
      // Add a third node first
      const newNode: WorkflowNode = {
        id: 'node-3',
        type: 'set-values',
        name: 'Set Values',
        parameters: { values: [] },
        position: { x: 500, y: 100 },
        credentials: [],
        disabled: false
      }
      addNode(newNode)
      
      const newConnection: WorkflowConnection = {
        id: 'conn-2',
        sourceNodeId: 'node-2',
        sourceOutput: 'main',
        targetNodeId: 'node-3',
        targetInput: 'main'
      }
      
      addConnection(newConnection)
      
      const state = useWorkflowStore.getState()
      expect(state.workflow?.connections).toHaveLength(2)
      expect(state.isDirty).toBe(true)
    })

    it('should not add invalid connection (self-connection)', () => {
      const { setWorkflow, addConnection } = useWorkflowStore.getState()
      setWorkflow(mockWorkflow)
      const initialConnectionsLength = useWorkflowStore.getState().workflow?.connections.length || 0
      
      const invalidConnection: WorkflowConnection = {
        id: 'conn-invalid',
        sourceNodeId: 'node-1',
        sourceOutput: 'main',
        targetNodeId: 'node-1',
        targetInput: 'main'
      }
      
      addConnection(invalidConnection)
      
      const state = useWorkflowStore.getState()
      expect(state.workflow?.connections).toHaveLength(initialConnectionsLength)
    })
  })

  describe('validateWorkflow', () => {
    it('should validate workflow with nodes and connections', () => {
      const store = useWorkflowStore.getState()
      store.setWorkflow(mockWorkflow)
      
      const result = store.validateWorkflow()
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect empty workflow', () => {
      const store = useWorkflowStore.getState()
      const emptyWorkflow = { ...mockWorkflow, nodes: [], connections: [] }
      store.setWorkflow(emptyWorkflow)
      
      const result = store.validateWorkflow()
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Workflow must contain at least one node')
    })

    it('should detect orphaned nodes', () => {
      const store = useWorkflowStore.getState()
      const workflowWithOrphan = {
        ...mockWorkflow,
        nodes: [
          ...mockWorkflow.nodes,
          {
            id: 'orphan-node',
            type: 'set-values',
            name: 'Orphan Node',
            parameters: {},
            position: { x: 500, y: 100 },
            credentials: [],
            disabled: false
          }
        ]
      }
      store.setWorkflow(workflowWithOrphan)
      
      const result = store.validateWorkflow()
      
      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('Orphaned nodes found'))).toBe(true)
    })
  })

  describe('validateConnection', () => {
    it('should allow valid connection', () => {
      const { setWorkflow, addNode, validateConnection } = useWorkflowStore.getState()
      setWorkflow(mockWorkflow)
      
      // Add a third node first
      const newNode: WorkflowNode = {
        id: 'node-3',
        type: 'set-values',
        name: 'Set Values',
        parameters: { values: [] },
        position: { x: 500, y: 100 },
        credentials: [],
        disabled: false
      }
      addNode(newNode)
      
      const isValid = validateConnection('node-2', 'node-3')
      
      expect(isValid).toBe(true)
    })

    it('should prevent self-connection', () => {
      const { setWorkflow, validateConnection } = useWorkflowStore.getState()
      setWorkflow(mockWorkflow)
      
      const isValid = validateConnection('node-1', 'node-1')
      
      expect(isValid).toBe(false)
    })

    it('should prevent duplicate connection', () => {
      const { setWorkflow, validateConnection } = useWorkflowStore.getState()
      setWorkflow(mockWorkflow)
      
      const isValid = validateConnection('node-1', 'node-2')
      
      expect(isValid).toBe(false)
    })
  })

  describe('history management', () => {
    it('should support undo operation', () => {
      const { setWorkflow, updateNode, undo } = useWorkflowStore.getState()
      setWorkflow(mockWorkflow)

      
      // Make a change
      updateNode('node-1', { name: 'Changed Name' })
      let state = useWorkflowStore.getState()
      expect(state.workflow?.nodes[0].name).toBe('Changed Name')
      
      // Undo the change
      undo()
      state = useWorkflowStore.getState()
      expect(state.workflow?.nodes[0].name).toBe('HTTP Request')
      expect(state.isDirty).toBe(true)
    })

    it('should support redo operation', () => {
      const { setWorkflow, updateNode, undo, redo } = useWorkflowStore.getState()
      setWorkflow(mockWorkflow)
      
      // Make a change
      updateNode('node-1', { name: 'Changed Name' })
      
      // Undo the change
      undo()
      let state = useWorkflowStore.getState()
      expect(state.workflow?.nodes[0].name).toBe('HTTP Request')
      
      // Redo the change
      redo()
      state = useWorkflowStore.getState()
      expect(state.workflow?.nodes[0].name).toBe('Changed Name')
    })

    it('should report correct undo/redo availability', () => {
      const { setWorkflow, updateNode, undo, canUndo, canRedo } = useWorkflowStore.getState()
      setWorkflow(mockWorkflow)
      
      expect(canUndo()).toBe(false)
      expect(canRedo()).toBe(false)
      
      // Make a change
      updateNode('node-1', { name: 'Changed Name' })
      
      const actions = useWorkflowStore.getState()
      expect(actions.canUndo()).toBe(true)
      expect(actions.canRedo()).toBe(false)
      
      // Undo
      undo()
      
      const finalActions = useWorkflowStore.getState()
      expect(finalActions.canUndo()).toBe(false)
      expect(finalActions.canRedo()).toBe(true)
    })
  })

  describe('title management', () => {
    describe('setWorkflow with title', () => {
      it('should set workflow title from workflow name', () => {
        const { setWorkflow } = useWorkflowStore.getState()
        
        setWorkflow(mockWorkflow)
        
        const state = useWorkflowStore.getState()
        expect(state.workflowTitle).toBe(mockWorkflow.name)
        expect(state.isTitleDirty).toBe(false)
        expect(state.titleValidationError).toBeNull()
      })

      it('should handle workflow without name', () => {
        const { setWorkflow } = useWorkflowStore.getState()
        const workflowWithoutName = { ...mockWorkflow, name: '' }
        
        setWorkflow(workflowWithoutName)
        
        const state = useWorkflowStore.getState()
        expect(state.workflowTitle).toBe('Untitled Workflow') // Metadata management provides default title
        expect(state.isTitleDirty).toBe(false)
      })

      it('should handle null workflow', () => {
        const { setWorkflow } = useWorkflowStore.getState()
        
        setWorkflow(null)
        
        const state = useWorkflowStore.getState()
        expect(state.workflowTitle).toBe('')
        expect(state.isTitleDirty).toBe(false)
        expect(state.titleValidationError).toBeNull()
      })
    })

    describe('updateTitle', () => {
      it('should update title and mark as dirty', () => {
        const { setWorkflow, updateTitle } = useWorkflowStore.getState()
        setWorkflow(mockWorkflow)
        
        updateTitle('New Title')
        
        const state = useWorkflowStore.getState()
        expect(state.workflowTitle).toBe('New Title')
        expect(state.isTitleDirty).toBe(true)
        expect(state.titleValidationError).toBeNull()
      })

      it('should sanitize title when updating', () => {
        const { setWorkflow, updateTitle } = useWorkflowStore.getState()
        setWorkflow(mockWorkflow)
        
        updateTitle('  Title  with   spaces  ')
        
        const state = useWorkflowStore.getState()
        expect(state.workflowTitle).toBe('Title with spaces')
        expect(state.isTitleDirty).toBe(true)
      })

      it('should validate title and set error for invalid title', () => {
        const { setWorkflow, updateTitle } = useWorkflowStore.getState()
        setWorkflow(mockWorkflow)
        
        updateTitle('Title<with>invalid:chars')
        
        const state = useWorkflowStore.getState()
        expect(state.workflowTitle).toBe('Titlewithinvalidchars')
        expect(state.isTitleDirty).toBe(true)
        expect(state.titleValidationError).toBeNull()
      })

      it('should set validation error for empty title', () => {
        const { setWorkflow, updateTitle } = useWorkflowStore.getState()
        setWorkflow(mockWorkflow)
        
        updateTitle('   ')
        
        const state = useWorkflowStore.getState()
        expect(state.workflowTitle).toBe('')
        expect(state.isTitleDirty).toBe(true)
        expect(state.titleValidationError).toBe('Title cannot be empty')
      })
    })

    describe('saveTitle', () => {
      it('should save valid title to workflow and mark workflow as dirty', () => {
        const { setWorkflow, updateTitle, saveTitle } = useWorkflowStore.getState()
        setWorkflow(mockWorkflow)
        updateTitle('Updated Title')
        
        saveTitle()
        
        const state = useWorkflowStore.getState()
        expect(state.workflow?.name).toBe('Updated Title')
        expect(state.isTitleDirty).toBe(false)
        expect(state.isDirty).toBe(true)
      })

      it('should save to history when title is saved', () => {
        const { setWorkflow, updateTitle, saveTitle } = useWorkflowStore.getState()
        setWorkflow(mockWorkflow)
        const initialHistoryLength = useWorkflowStore.getState().history.length
        updateTitle('Updated Title')
        
        saveTitle()
        
        const state = useWorkflowStore.getState()
        expect(state.history).toHaveLength(initialHistoryLength + 1)
        expect(state.history[state.history.length - 1].action).toBe('Update title: Updated Title')
      })

      it('should not save title if no workflow is loaded', () => {
        const { updateTitle, saveTitle } = useWorkflowStore.getState()
        updateTitle('Some Title')
        
        saveTitle()
        
        const state = useWorkflowStore.getState()
        expect(state.isTitleDirty).toBe(true) // Should remain dirty
      })

      it('should not save title if validation error exists', () => {
        const { setWorkflow, updateTitle, saveTitle } = useWorkflowStore.getState()
        setWorkflow(mockWorkflow)
        updateTitle('') // This will create a validation error
        
        saveTitle()
        
        const state = useWorkflowStore.getState()
        expect(state.workflow?.name).toBe(mockWorkflow.name) // Should remain unchanged
        expect(state.isTitleDirty).toBe(true) // Should remain dirty
      })
    })

    describe('setTitleDirty', () => {
      it('should set title dirty state', () => {
        const { setTitleDirty } = useWorkflowStore.getState()
        
        setTitleDirty(true)
        let state = useWorkflowStore.getState()
        expect(state.isTitleDirty).toBe(true)
        
        setTitleDirty(false)
        state = useWorkflowStore.getState()
        expect(state.isTitleDirty).toBe(false)
      })
    })

    describe('validateTitle', () => {
      it('should validate valid title', () => {
        const { validateTitle } = useWorkflowStore.getState()
        
        const result = validateTitle('Valid Title')
        
        expect(result.isValid).toBe(true)
        expect(result.error).toBeNull()
      })

      it('should reject empty title', () => {
        const { validateTitle } = useWorkflowStore.getState()
        
        const result = validateTitle('')
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Title cannot be empty')
      })

      it('should reject whitespace-only title', () => {
        const { validateTitle } = useWorkflowStore.getState()
        
        const result = validateTitle('   ')
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Title cannot be empty')
      })

      it('should reject title that is too long', () => {
        const { validateTitle } = useWorkflowStore.getState()
        const longTitle = 'a'.repeat(101)
        
        const result = validateTitle(longTitle)
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Title cannot exceed 100 characters')
      })

      it('should reject title with invalid characters', () => {
        const { validateTitle } = useWorkflowStore.getState()
        
        const result = validateTitle('Title<with>invalid:chars')
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Title contains invalid characters')
      })

      it('should accept title at maximum length', () => {
        const { validateTitle } = useWorkflowStore.getState()
        const maxTitle = 'a'.repeat(100)
        
        const result = validateTitle(maxTitle)
        
        expect(result.isValid).toBe(true)
        expect(result.error).toBeNull()
      })
    })

    describe('sanitizeTitle', () => {
      it('should trim whitespace', () => {
        const { sanitizeTitle } = useWorkflowStore.getState()
        
        const result = sanitizeTitle('  Title  ')
        
        expect(result).toBe('Title')
      })

      it('should replace multiple spaces with single space', () => {
        const { sanitizeTitle } = useWorkflowStore.getState()
        
        const result = sanitizeTitle('Title   with    spaces')
        
        expect(result).toBe('Title with spaces')
      })

      it('should remove invalid characters', () => {
        const { sanitizeTitle } = useWorkflowStore.getState()
        
        const result = sanitizeTitle('Title<with>invalid:chars"/\\|?*')
        
        expect(result).toBe('Titlewithinvalidchars')
      })

      it('should truncate long titles', () => {
        const { sanitizeTitle } = useWorkflowStore.getState()
        const longTitle = 'a'.repeat(150)
        
        const result = sanitizeTitle(longTitle)
        
        expect(result).toHaveLength(100)
        expect(result).toBe('a'.repeat(100))
      })

      it('should handle complex sanitization', () => {
        const { sanitizeTitle } = useWorkflowStore.getState()
        
        const result = sanitizeTitle('  Complex<Title>  with   invalid:chars  ')
        
        expect(result).toBe('ComplexTitle with invalidchars')
      })

      it('should handle empty string', () => {
        const { sanitizeTitle } = useWorkflowStore.getState()
        
        const result = sanitizeTitle('')
        
        expect(result).toBe('')
      })

      it('should handle whitespace-only string', () => {
        const { sanitizeTitle } = useWorkflowStore.getState()
        
        const result = sanitizeTitle('   ')
        
        expect(result).toBe('')
      })
    })
  })

  describe('import/export functionality', () => {
    // Mock the workflowFileService
    const mockExportWorkflow = vi.spyOn(workflowFileService, 'exportWorkflow')
    const mockImportWorkflow = vi.spyOn(workflowFileService, 'importWorkflow')
    const mockValidateWorkflowFile = vi.spyOn(workflowFileService, 'validateWorkflowFile')

    beforeEach(() => {
      mockExportWorkflow.mockClear()
      mockImportWorkflow.mockClear()
      mockValidateWorkflowFile.mockClear()
    })

    describe('exportWorkflow', () => {
      it('should export workflow successfully', async () => {
        const { setWorkflow, exportWorkflow } = useWorkflowStore.getState()
        setWorkflow(mockWorkflow)
        mockExportWorkflow.mockResolvedValue(undefined)

        await exportWorkflow()

        const state = useWorkflowStore.getState()
        expect(mockExportWorkflow).toHaveBeenCalledWith(createExpectedWorkflow(mockWorkflow))
        expect(state.exportError).toBeNull()
        expect(state.exportProgress).toBe(100)
        expect(state.isExporting).toBe(true) // Still true until setTimeout completes
      })

      it('should handle export error', async () => {
        const { setWorkflow, exportWorkflow } = useWorkflowStore.getState()
        setWorkflow(mockWorkflow)
        const errorMessage = 'Export failed'
        mockExportWorkflow.mockRejectedValue(new Error(errorMessage))

        await exportWorkflow()

        const state = useWorkflowStore.getState()
        expect(state.exportError).toBe(errorMessage)
        expect(state.isExporting).toBe(false)
        expect(state.exportProgress).toBe(0)
      })

      it('should not export if no workflow is loaded', async () => {
        const { exportWorkflow } = useWorkflowStore.getState()

        await exportWorkflow()

        const state = useWorkflowStore.getState()
        expect(mockExportWorkflow).not.toHaveBeenCalled()
        expect(state.exportError).toBe('No workflow to export')
        expect(state.isExporting).toBe(false)
      })

      it('should not export invalid workflow', async () => {
        const { setWorkflow, exportWorkflow } = useWorkflowStore.getState()
        const invalidWorkflow = { ...mockWorkflow, nodes: [] }
        setWorkflow(invalidWorkflow)

        await exportWorkflow()

        const state = useWorkflowStore.getState()
        expect(mockExportWorkflow).not.toHaveBeenCalled()
        expect(state.exportError).toContain('Cannot export invalid workflow')
        expect(state.isExporting).toBe(false)
      })

      it('should track export progress', async () => {
        const { setWorkflow, exportWorkflow } = useWorkflowStore.getState()
        setWorkflow(mockWorkflow)
        
        // Mock a slow export to test progress tracking
        mockExportWorkflow.mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, 100))
        )

        const exportPromise = exportWorkflow()
        
        // Check that export is in progress
        let state = useWorkflowStore.getState()
        expect(state.isExporting).toBe(true)
        expect(state.exportProgress).toBeGreaterThan(0)

        await exportPromise

        // Check final state (still in progress until setTimeout completes)
        state = useWorkflowStore.getState()
        expect(state.isExporting).toBe(true)
        expect(state.exportProgress).toBe(100)
      })
    })

    describe('importWorkflow', () => {
      const mockFile = new File(['{"test": "data"}'], 'test.json', { type: 'application/json' })
      const mockImportedWorkflow: Workflow = {
        ...mockWorkflow,
        id: 'imported-workflow',
        name: 'Imported Workflow'
      }

      it('should import workflow successfully', async () => {
        const { importWorkflow } = useWorkflowStore.getState()
        mockValidateWorkflowFile.mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: []
        })
        mockImportWorkflow.mockResolvedValue(mockImportedWorkflow)

        await importWorkflow(mockFile)

        const state = useWorkflowStore.getState()
        expect(mockValidateWorkflowFile).toHaveBeenCalledWith(mockFile)
        expect(mockImportWorkflow).toHaveBeenCalledWith(mockFile)
        expect(state.workflow).toEqual(createExpectedWorkflow(mockImportedWorkflow))
        expect(state.importError).toBeNull()
        expect(state.importProgress).toBe(100)
        expect(state.isImporting).toBe(true) // Still true until setTimeout completes
      })

      it('should handle import validation error', async () => {
        const { importWorkflow } = useWorkflowStore.getState()
        const validationErrors = ['Invalid file format']
        mockValidateWorkflowFile.mockResolvedValue({
          isValid: false,
          errors: validationErrors,
          warnings: []
        })

        await importWorkflow(mockFile)

        const state = useWorkflowStore.getState()
        expect(mockImportWorkflow).not.toHaveBeenCalled()
        expect(state.importError).toContain('Invalid workflow file')
        expect(state.importError).toContain(validationErrors[0])
        expect(state.isImporting).toBe(false)
      })

      it('should handle import error', async () => {
        const { importWorkflow } = useWorkflowStore.getState()
        mockValidateWorkflowFile.mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: []
        })
        const errorMessage = 'Import failed'
        mockImportWorkflow.mockRejectedValue(new Error(errorMessage))

        await importWorkflow(mockFile)

        const state = useWorkflowStore.getState()
        expect(state.importError).toBe(errorMessage)
        expect(state.isImporting).toBe(false)
        expect(state.importProgress).toBe(0)
      })

      it('should track import progress', async () => {
        const { importWorkflow } = useWorkflowStore.getState()
        mockValidateWorkflowFile.mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: []
        })
        
        // Mock a slow import to test progress tracking
        mockImportWorkflow.mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve(mockImportedWorkflow), 100))
        )

        const importPromise = importWorkflow(mockFile)
        
        // Check that import is in progress
        let state = useWorkflowStore.getState()
        expect(state.isImporting).toBe(true)
        expect(state.importProgress).toBeGreaterThan(0)

        await importPromise

        // Check final state (still in progress until setTimeout completes)
        state = useWorkflowStore.getState()
        expect(state.isImporting).toBe(true)
        expect(state.importProgress).toBe(100)
      })

      it('should handle validation warnings', async () => {
        const { importWorkflow } = useWorkflowStore.getState()
        const warnings = ['Unsupported version']
        mockValidateWorkflowFile.mockResolvedValue({
          isValid: true,
          errors: [],
          warnings
        })
        mockImportWorkflow.mockResolvedValue(mockImportedWorkflow)

        // Mock console.warn to verify warnings are logged
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        await importWorkflow(mockFile)

        expect(consoleSpy).toHaveBeenCalledWith('Import warnings:', warnings)
        
        const state = useWorkflowStore.getState()
        expect(state.workflow).toEqual(createExpectedWorkflow(mockImportedWorkflow))
        expect(state.importError).toBeNull()

        consoleSpy.mockRestore()
      })

      it('should warn about unsaved changes when importing', async () => {
        const { setWorkflow, updateTitle, importWorkflow } = useWorkflowStore.getState()
        setWorkflow(mockWorkflow)
        updateTitle('Modified Title') // Make the workflow dirty
        
        mockValidateWorkflowFile.mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: []
        })
        mockImportWorkflow.mockResolvedValue(mockImportedWorkflow)

        // Mock console.warn to verify warning is logged
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        await importWorkflow(mockFile)

        expect(consoleSpy).toHaveBeenCalledWith('Importing workflow will overwrite unsaved changes')
        
        const state = useWorkflowStore.getState()
        expect(state.workflow).toEqual(createExpectedWorkflow(mockImportedWorkflow))

        consoleSpy.mockRestore()
      })
    })

    describe('validateImportFile', () => {
      const mockFile = new File(['{"test": "data"}'], 'test.json', { type: 'application/json' })

      it('should validate file successfully', async () => {
        const { validateImportFile } = useWorkflowStore.getState()
        const validationResult = {
          isValid: true,
          errors: [],
          warnings: []
        }
        mockValidateWorkflowFile.mockResolvedValue(validationResult)

        const result = await validateImportFile(mockFile)

        expect(mockValidateWorkflowFile).toHaveBeenCalledWith(mockFile)
        expect(result).toEqual(validationResult)
      })

      it('should handle validation error', async () => {
        const { validateImportFile } = useWorkflowStore.getState()
        const errorMessage = 'Validation failed'
        mockValidateWorkflowFile.mockRejectedValue(new Error(errorMessage))

        const result = await validateImportFile(mockFile)

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain(errorMessage)
        expect(result.warnings).toEqual([])
      })
    })

    describe('progress tracking', () => {
      it('should set import progress within bounds', () => {
        const { setImportProgress } = useWorkflowStore.getState()

        setImportProgress(50)
        let state = useWorkflowStore.getState()
        expect(state.importProgress).toBe(50)

        setImportProgress(-10)
        state = useWorkflowStore.getState()
        expect(state.importProgress).toBe(0)

        setImportProgress(150)
        state = useWorkflowStore.getState()
        expect(state.importProgress).toBe(100)
      })

      it('should set export progress within bounds', () => {
        const { setExportProgress } = useWorkflowStore.getState()

        setExportProgress(75)
        let state = useWorkflowStore.getState()
        expect(state.exportProgress).toBe(75)

        setExportProgress(-5)
        state = useWorkflowStore.getState()
        expect(state.exportProgress).toBe(0)

        setExportProgress(120)
        state = useWorkflowStore.getState()
        expect(state.exportProgress).toBe(100)
      })
    })

    describe('error management', () => {
      it('should clear import/export errors', () => {
        const { clearImportExportErrors } = useWorkflowStore.getState()
        
        // Set some errors first
        useWorkflowStore.setState({
          importError: 'Import error',
          exportError: 'Export error'
        })

        clearImportExportErrors()

        const state = useWorkflowStore.getState()
        expect(state.importError).toBeNull()
        expect(state.exportError).toBeNull()
      })
    })

    describe('state management during operations', () => {
      it('should reset state properly when export starts', async () => {
        const { setWorkflow, exportWorkflow } = useWorkflowStore.getState()
        setWorkflow(mockWorkflow)
        
        // Set some initial error state
        useWorkflowStore.setState({ exportError: 'Previous error' })
        
        mockExportWorkflow.mockResolvedValue(undefined)

        await exportWorkflow()

        // Verify state was reset at start of operation
        expect(mockExportWorkflow).toHaveBeenCalled()
      })

      it('should reset state properly when import starts', async () => {
        const { importWorkflow } = useWorkflowStore.getState()
        const mockFile = new File(['{"test": "data"}'], 'test.json', { type: 'application/json' })
        
        // Set some initial error state
        useWorkflowStore.setState({ importError: 'Previous error' })
        
        mockValidateWorkflowFile.mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: []
        })
        mockImportWorkflow.mockResolvedValue(mockWorkflow)

        await importWorkflow(mockFile)

        // Verify state was reset at start of operation
        expect(mockValidateWorkflowFile).toHaveBeenCalled()
      })
    })
  })

  describe('execution functionality', () => {
    beforeEach(() => {
      // Reset execution state before each test
      useWorkflowStore.setState({
        executionState: {
          status: 'idle',
          progress: 0,
          startTime: undefined,
          endTime: undefined,
          error: undefined,
          executionId: undefined
        },
        lastExecutionResult: null
      })
    })

    describe('executeWorkflow', () => {
      it('should execute workflow successfully', async () => {
        const { setWorkflow, executeWorkflow } = useWorkflowStore.getState()
        setWorkflow(mockWorkflow)

        const executePromise = executeWorkflow()

        // Check initial execution state
        let state = useWorkflowStore.getState()
        expect(state.executionState.status).toBe('running')
        expect(state.executionState.progress).toBeGreaterThanOrEqual(0)
        expect(state.executionState.startTime).toBeDefined()
        expect(state.executionState.executionId).toBeDefined()

        await executePromise

        // Check final execution state
        state = useWorkflowStore.getState()
        expect(state.executionState.status).toBe('success')
        expect(state.executionState.progress).toBe(100)
        expect(state.executionState.endTime).toBeDefined()
        expect(state.lastExecutionResult).toBeDefined()
        expect(state.lastExecutionResult?.status).toBe('success')
        expect(state.lastExecutionResult?.nodeResults).toHaveLength(mockWorkflow.nodes.length)
      })

      it('should not execute if no workflow is loaded', async () => {
        const { executeWorkflow } = useWorkflowStore.getState()

        await executeWorkflow()

        const state = useWorkflowStore.getState()
        expect(state.executionState.status).toBe('error')
        expect(state.executionState.error).toBe('No workflow to execute')
      })

      it('should not execute invalid workflow', async () => {
        const { setWorkflow, executeWorkflow } = useWorkflowStore.getState()
        const invalidWorkflow = { ...mockWorkflow, nodes: [] }
        setWorkflow(invalidWorkflow)

        await executeWorkflow()

        const state = useWorkflowStore.getState()
        expect(state.executionState.status).toBe('error')
        expect(state.executionState.error).toContain('Cannot execute invalid workflow')
      })

      it('should prevent multiple simultaneous executions', async () => {
        const { setWorkflow, executeWorkflow } = useWorkflowStore.getState()
        setWorkflow(mockWorkflow)

        // Mock console.warn to verify warning is logged
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        // Start first execution
        const firstExecution = executeWorkflow()
        
        // Try to start second execution while first is running
        await executeWorkflow()

        expect(consoleSpy).toHaveBeenCalledWith('Workflow is already executing')

        // Wait for first execution to complete
        await firstExecution

        consoleSpy.mockRestore()
      })

      it('should save execution to history', async () => {
        const { setWorkflow, executeWorkflow } = useWorkflowStore.getState()
        setWorkflow(mockWorkflow)
        const initialHistoryLength = useWorkflowStore.getState().history.length

        await executeWorkflow()

        const state = useWorkflowStore.getState()
        expect(state.history).toHaveLength(initialHistoryLength + 1)
        expect(state.history[state.history.length - 1].action).toBe(`Execute workflow: ${mockWorkflow.name}`)
      })

      it('should handle execution errors', async () => {
        const { setWorkflow, executeWorkflow } = useWorkflowStore.getState()
        
        // Create a workflow that will trigger the simulated failure
        const failingWorkflow = {
          ...mockWorkflow,
          nodes: Array(20).fill(null).map((_, i) => ({
            id: `node-${i}`,
            type: 'test-node',
            name: `Test Node ${i}`,
            parameters: {},
            position: { x: i * 100, y: 100 },
            credentials: [],
            disabled: false
          })),
          connections: Array(19).fill(null).map((_, i) => ({
            id: `conn-${i}`,
            sourceNodeId: `node-${i}`,
            sourceOutput: 'main',
            targetNodeId: `node-${i + 1}`,
            targetInput: 'main'
          }))
        }
        setWorkflow(failingWorkflow)

        // Mock Math.random to ensure failure occurs
        const originalRandom = Math.random
        Math.random = vi.fn().mockReturnValue(0.01) // Force failure (< 0.05)

        await executeWorkflow()

        const state = useWorkflowStore.getState()
        expect(state.executionState.status).toBe('error')
        expect(state.executionState.error).toContain('failed during execution')
        expect(state.lastExecutionResult?.status).toBe('error')

        // Restore Math.random
        Math.random = originalRandom
      })

      it('should track execution progress', async () => {
        const { setWorkflow, executeWorkflow } = useWorkflowStore.getState()
        setWorkflow(mockWorkflow)

        const executePromise = executeWorkflow()

        // Wait a bit and check progress
        await new Promise(resolve => setTimeout(resolve, 100))
        
        let state = useWorkflowStore.getState()
        expect(state.executionState.status).toBe('running')
        expect(state.executionState.progress).toBeGreaterThan(0)
        expect(state.executionState.progress).toBeLessThan(100)

        await executePromise

        // Check that execution completed successfully
        state = useWorkflowStore.getState()
        expect(state.executionState.status).toBe('success')
        expect(state.executionState.progress).toBe(100)
      })
    })

    describe('stopExecution', () => {
      it('should stop running execution', async () => {
        const { setWorkflow, executeWorkflow, stopExecution } = useWorkflowStore.getState()
        setWorkflow(mockWorkflow)

        // Start execution
        const executePromise = executeWorkflow()
        
        // Wait a bit then stop
        await new Promise(resolve => setTimeout(resolve, 100))
        await stopExecution()

        const state = useWorkflowStore.getState()
        expect(state.executionState.status).toBe('cancelled')
        expect(state.executionState.error).toBe('Execution cancelled by user')
        expect(state.lastExecutionResult?.status).toBe('cancelled')

        // Wait for original execution to complete
        await executePromise
      })

      it('should not stop if no execution is running', async () => {
        const { stopExecution } = useWorkflowStore.getState()

        // Mock console.warn to verify warning is logged
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        await stopExecution()

        expect(consoleSpy).toHaveBeenCalledWith('No execution to stop')

        const state = useWorkflowStore.getState()
        expect(state.executionState.status).toBe('idle')

        consoleSpy.mockRestore()
      })

      it('should save cancellation to history', async () => {
        const { setWorkflow, executeWorkflow, stopExecution } = useWorkflowStore.getState()
        setWorkflow(mockWorkflow)

        // Start execution
        const executePromise = executeWorkflow()
        const initialHistoryLength = useWorkflowStore.getState().history.length
        
        // Wait a bit then stop
        await new Promise(resolve => setTimeout(resolve, 100))
        await stopExecution()

        const state = useWorkflowStore.getState()
        expect(state.history).toHaveLength(initialHistoryLength + 1)
        expect(state.history[state.history.length - 1].action).toBe('Cancel workflow execution')

        // Wait for original execution to complete
        await executePromise
      })
    })

    describe('execution state management', () => {
      it('should set execution state', () => {
        const { setExecutionState } = useWorkflowStore.getState()

        setExecutionState({
          status: 'running',
          progress: 50,
          executionId: 'test-exec-id'
        })

        const state = useWorkflowStore.getState()
        expect(state.executionState.status).toBe('running')
        expect(state.executionState.progress).toBe(50)
        expect(state.executionState.executionId).toBe('test-exec-id')
      })

      it('should merge execution state updates', () => {
        const { setExecutionState } = useWorkflowStore.getState()

        // Set initial state
        setExecutionState({
          status: 'running',
          progress: 25,
          executionId: 'test-exec-id'
        })

        // Update only progress
        setExecutionState({ progress: 75 })

        const state = useWorkflowStore.getState()
        expect(state.executionState.status).toBe('running') // Should remain
        expect(state.executionState.progress).toBe(75) // Should update
        expect(state.executionState.executionId).toBe('test-exec-id') // Should remain
      })

      it('should clear execution state', () => {
        const { setExecutionState, clearExecutionState } = useWorkflowStore.getState()

        // Set some state first
        setExecutionState({
          status: 'success',
          progress: 100,
          executionId: 'test-exec-id',
          error: 'Some error'
        })

        clearExecutionState()

        const state = useWorkflowStore.getState()
        expect(state.executionState.status).toBe('idle')
        expect(state.executionState.progress).toBe(0)
        expect(state.executionState.startTime).toBeUndefined()
        expect(state.executionState.endTime).toBeUndefined()
        expect(state.executionState.error).toBeUndefined()
        expect(state.executionState.executionId).toBeUndefined()
      })

      it('should set execution progress within bounds', () => {
        const { setExecutionProgress } = useWorkflowStore.getState()

        setExecutionProgress(50)
        let state = useWorkflowStore.getState()
        expect(state.executionState.progress).toBe(50)

        setExecutionProgress(-10)
        state = useWorkflowStore.getState()
        expect(state.executionState.progress).toBe(0)

        setExecutionProgress(150)
        state = useWorkflowStore.getState()
        expect(state.executionState.progress).toBe(100)
      })

      it('should set execution error', () => {
        const { setExecutionError } = useWorkflowStore.getState()
        const errorMessage = 'Test execution error'

        setExecutionError(errorMessage)

        const state = useWorkflowStore.getState()
        expect(state.executionState.status).toBe('error')
        expect(state.executionState.error).toBe(errorMessage)
        expect(state.executionState.progress).toBe(0)
        expect(state.executionState.endTime).toBeDefined()
      })
    })

    describe('execution validation', () => {
      it('should validate workflow before execution', async () => {
        const { setWorkflow, executeWorkflow } = useWorkflowStore.getState()
        const invalidWorkflow = {
          ...mockWorkflow,
          nodes: [
            {
              id: 'orphan-node',
              type: 'test-node',
              name: 'Orphan Node',
              parameters: {},
              position: { x: 100, y: 100 },
              credentials: [],
              disabled: false
            },
            {
              id: 'another-orphan',
              type: 'test-node',
              name: 'Another Orphan',
              parameters: {},
              position: { x: 200, y: 100 },
              credentials: [],
              disabled: false
            }
          ],
          connections: []
        }
        setWorkflow(invalidWorkflow)

        await executeWorkflow()

        const state = useWorkflowStore.getState()
        expect(state.executionState.status).toBe('error')
        expect(state.executionState.error).toContain('Cannot execute invalid workflow')
        expect(state.executionState.error).toContain('Orphaned nodes found')
      })
    })
  })
})
