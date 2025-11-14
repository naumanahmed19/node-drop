import { Workflow } from '@/types'
import { migrateMetadata, validateMetadata } from '@/utils/workflowMetadata'

/**
 * Export format for workflow files
 */
export interface WorkflowExportFormat {
  version: string
  exportedAt: string
  exportedBy: string
  workflow: {
    title: string
    name: string
    description?: string
    nodes: Workflow['nodes']
    connections: Workflow['connections']
    settings: Workflow['settings']
    metadata?: Workflow['metadata']
    tags?: string[]
    category?: string
  }
  checksum: string
}

/**
 * Validation result for imported workflow files
 */
export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Service for handling workflow file import/export operations
 * This service handles client-side file operations using browser APIs
 */
class WorkflowFileService {
  private readonly EXPORT_VERSION = '1.0.0'
  private readonly SUPPORTED_VERSIONS = ['1.0.0']
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
  private readonly ALLOWED_FILE_EXTENSIONS = ['.json', '.workflow']

  /**
   * Export a workflow to a downloadable file
   */
  async exportWorkflow(workflow: Workflow): Promise<void> {
    try {
      console.log('📤 Starting workflow export...', { workflowId: workflow.id, workflowName: workflow.name })
      
      const exportData = this.prepareExportData(workflow)
      console.log('📦 Export data prepared:', { 
        version: exportData.version, 
        nodeCount: exportData.workflow.nodes.length,
        connectionCount: exportData.workflow.connections.length 
      })
      
      const filename = this.generateFileName(workflow)
      console.log('📝 Generated filename:', filename)
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      })
      console.log('💾 Blob created:', { size: blob.size, type: blob.type })

      // Create download link and trigger download
      const url = URL.createObjectURL(blob)
      console.log('🔗 Object URL created:', url)
      
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      
      // Add link to DOM (required for Firefox)
      document.body.appendChild(link)
      console.log('🖱️ Triggering download...')
      
      // Trigger download
      link.click()
      
      // Clean up
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      console.log('✅ Export completed successfully')
    } catch (error) {
      console.error('❌ Export failed:', error)
      throw new Error(`Failed to export workflow: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Import a workflow from a file
   */
  async importWorkflow(file: File): Promise<Workflow> {
    try {
      // Validate file before processing
      const validation = await this.validateWorkflowFile(file)
      if (!validation.isValid) {
        throw new Error(`Invalid workflow file: ${validation.errors.join(', ')}`)
      }

      // Read and parse file content
      const content = await this.readFileContent(file)
      const exportData = JSON.parse(content) as WorkflowExportFormat

      // Convert export format back to workflow
      return this.convertToWorkflow(exportData)
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON format in workflow file')
      }
      throw new Error(`Failed to import workflow: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate a workflow file before import
   */
  async validateWorkflowFile(file: File): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // Check file size
      if (file.size > this.MAX_FILE_SIZE) {
        errors.push(`File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${this.MAX_FILE_SIZE / 1024 / 1024}MB)`)
      }

      // Check file extension
      const extension = this.getFileExtension(file.name)
      if (!this.ALLOWED_FILE_EXTENSIONS.includes(extension)) {
        errors.push(`Unsupported file extension: ${extension}. Allowed extensions: ${this.ALLOWED_FILE_EXTENSIONS.join(', ')}`)
      }

      // Check file content if basic validation passes
      if (errors.length === 0) {
        const content = await this.readFileContent(file)
        
        try {
          const data = JSON.parse(content) as WorkflowExportFormat
          
          // Validate export format structure
          const structureValidation = this.validateExportStructure(data)
          errors.push(...structureValidation.errors)
          warnings.push(...structureValidation.warnings)
          
        } catch (parseError) {
          errors.push('Invalid JSON format')
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [`File validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      }
    }
  }

  /**
   * Generate a filename based on workflow title
   */
  generateFileName(workflow: Workflow): string {
    // Use title from metadata if available, otherwise use name
    const title = workflow.metadata?.title || workflow.name || 'Untitled Workflow'
    
    // Sanitize filename by removing invalid characters
    const sanitized = title
      .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid filename characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .toLowerCase()

    // Add timestamp to ensure uniqueness
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
    
    return `${sanitized}_${timestamp}.json`
  }

  /**
   * Prepare workflow data for export
   */
  private prepareExportData(workflow: Workflow): WorkflowExportFormat {
    // Ensure metadata exists and has required fields
    const now = new Date().toISOString()
    const metadata = workflow.metadata || {
      title: workflow.name || 'Untitled Workflow',
      lastTitleUpdate: now,
      exportVersion: '1.0.0',
      schemaVersion: '1.0.0',
      version: 1,
      tags: [],
      customProperties: {}
    }
    
    // Ensure all required metadata fields are present
    const completeMetadata = {
      ...metadata,
      title: metadata.title || workflow.name || 'Untitled Workflow',
      lastTitleUpdate: metadata.lastTitleUpdate || now,
      exportVersion: metadata.exportVersion || '1.0.0',
      schemaVersion: metadata.schemaVersion || '1.0.0',
      version: metadata.version || 1,
      tags: metadata.tags || [],
      customProperties: metadata.customProperties || {}
    }
    
    const exportData: WorkflowExportFormat = {
      version: this.EXPORT_VERSION,
      exportedAt: now,
      exportedBy: 'workflow-editor', // Could be enhanced to include user info
      workflow: {
        title: completeMetadata.title,
        name: workflow.name || completeMetadata.title,
        description: workflow.description,
        nodes: workflow.nodes || [],
        connections: workflow.connections || [],
        settings: workflow.settings || {},
        metadata: completeMetadata,
        tags: workflow.tags,
        category: workflow.category
      },
      checksum: this.generateChecksum(workflow)
    }

    return exportData
  }

  /**
   * Convert export format back to workflow
   */
  private convertToWorkflow(exportData: WorkflowExportFormat): Workflow {
    const now = new Date().toISOString()
    

    
    // Migrate and ensure proper metadata structure
    const migratedMetadata = migrateMetadata(
      exportData.workflow.metadata,
      exportData.workflow.name
    )
    
    // Create a new workflow object from the export data
    const workflow: Workflow = {
      id: '', // Will be assigned by the backend
      name: exportData.workflow.name,
      description: exportData.workflow.description,
      userId: '', // Will be assigned by the backend
      nodes: exportData.workflow.nodes,
      connections: exportData.workflow.connections,
      settings: exportData.workflow.settings,
      active: false, // Imported workflows start as inactive
      tags: exportData.workflow.tags,
      category: exportData.workflow.category,
      isTemplate: false,
      isPublic: false,
      sharedWith: [],
      metadata: {
        ...migratedMetadata,
        importSource: `Imported from file on ${now}`,
        lastTitleUpdate: now
      },
      createdAt: now,
      updatedAt: now
    }

    return workflow
  }

  /**
   * Validate the structure of an export format
   */
  private validateExportStructure(data: any): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Check required top-level fields
    if (!data.version) {
      errors.push('Missing version field')
    } else if (!this.SUPPORTED_VERSIONS.includes(data.version)) {
      warnings.push(`Unsupported version: ${data.version}. Supported versions: ${this.SUPPORTED_VERSIONS.join(', ')}`)
    }

    if (!data.exportedAt) {
      warnings.push('Missing exportedAt field')
    }

    if (!data.workflow) {
      errors.push('Missing workflow data')
      return { isValid: false, errors, warnings }
    }

    // Check required workflow fields
    const workflow = data.workflow
    if (!workflow.name) {
      errors.push('Missing workflow name')
    }

    if (!Array.isArray(workflow.nodes)) {
      errors.push('Invalid or missing nodes array')
    }

    if (!Array.isArray(workflow.connections)) {
      errors.push('Invalid or missing connections array')
    }

    if (!workflow.settings || typeof workflow.settings !== 'object') {
      warnings.push('Missing or invalid workflow settings')
    }

    // Validate metadata structure if present
    if (workflow.metadata) {
      const metadataErrors = validateMetadata(workflow.metadata)
      
      metadataErrors.forEach(error => {
        if (error.code?.includes('MISSING') || error.code?.includes('EMPTY')) {
          warnings.push(`Metadata validation: ${error.message}`)
        } else {
          errors.push(`Metadata validation: ${error.message}`)
        }
      })
    } else {
      warnings.push('Missing workflow metadata - will be migrated during import')
    }

    // Validate nodes structure
    if (Array.isArray(workflow.nodes)) {
      workflow.nodes.forEach((node: any, index: number) => {
        if (!node.id) {
          errors.push(`Node at index ${index} missing id`)
        }
        if (!node.type) {
          errors.push(`Node at index ${index} missing type`)
        }
        if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
          errors.push(`Node at index ${index} has invalid position`)
        }
      })
    }

    // Validate connections structure
    if (Array.isArray(workflow.connections)) {
      workflow.connections.forEach((connection: any, index: number) => {
        if (!connection.id) {
          errors.push(`Connection at index ${index} missing id`)
        }
        if (!connection.sourceNodeId || !connection.targetNodeId) {
          errors.push(`Connection at index ${index} missing source or target node id`)
        }
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Read file content as text
   */
  private readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string)
        } else {
          reject(new Error('Failed to read file content'))
        }
      }
      
      reader.onerror = () => {
        reject(new Error('File reading failed'))
      }
      
      reader.readAsText(file)
    })
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.')
    return lastDotIndex >= 0 ? filename.slice(lastDotIndex) : ''
  }

  /**
   * Generate a simple checksum for workflow data
   */
  private generateChecksum(workflow: Workflow): string {
    // Simple checksum based on workflow content
    const content = JSON.stringify({
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections
    })
    
    // Simple hash function (for production, consider using a proper hash library)
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16)
  }
}

export const workflowFileService = new WorkflowFileService()
export { WorkflowFileService }
