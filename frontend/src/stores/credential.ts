import { createWithEqualityFn } from 'zustand/traditional'
import { 
  Credential, 
  CredentialType, 
  CreateCredentialRequest, 
  UpdateCredentialRequest,
  TestCredentialRequest,
  TestCredentialResponse,
  CredentialData,
  CredentialUsageLog,
  CredentialAuditLog,
  CredentialSecurityPolicy,
  CredentialBackup,
  CredentialImportData,
  CredentialExportData
} from '@/types'
import { credentialService } from '@/services'

interface CredentialState {
  credentials: Credential[]
  credentialTypes: CredentialType[]
  expiringCredentials: Credential[]
  sharedCredentials: Credential[]
  usageLogs: CredentialUsageLog[]
  auditLogs: CredentialAuditLog[]
  securityPolicies: CredentialSecurityPolicy[]
  backups: CredentialBackup[]
  isLoading: boolean
  error: string | null
}

interface CredentialActions {
  fetchCredentials: () => Promise<void>
  fetchCredentialTypes: () => Promise<void>
  createCredential: (data: CreateCredentialRequest) => Promise<Credential>
  updateCredential: (id: string, data: UpdateCredentialRequest) => Promise<Credential>
  deleteCredential: (id: string) => Promise<void>
  testCredential: (data: TestCredentialRequest) => Promise<TestCredentialResponse>
  getCredentialsByType: (type: string) => Credential[]
  
  // Rotation and expiration
  rotateCredential: (id: string, newData: CredentialData) => Promise<Credential>
  fetchExpiringCredentials: (warningDays?: number) => Promise<void>
  
  // Usage and audit
  fetchCredentialUsage: (credentialId: string) => Promise<void>
  fetchAuditLogs: (credentialId?: string) => Promise<void>
  
  // Bulk operations
  bulkExportCredentials: (credentialIds: string[]) => Promise<CredentialExportData>
  bulkImportCredentials: (importData: CredentialImportData) => Promise<{ imported: number; errors: string[] }>
  bulkDeleteCredentials: (credentialIds: string[]) => Promise<{ deleted: number; errors: string[] }>
  bulkRotateCredentials: (credentialIds: string[]) => Promise<{ rotated: number; errors: string[] }>
  
  // Sharing
  shareCredential: (credentialId: string, userId: string, permission?: 'USE' | 'VIEW' | 'EDIT') => Promise<void>
  unshareCredential: (credentialId: string, userId: string) => Promise<void>
  fetchSharedCredentials: () => Promise<void>
  
  // Security policies
  fetchSecurityPolicies: () => Promise<void>
  createSecurityPolicy: (policy: Omit<CredentialSecurityPolicy, 'id'>) => Promise<CredentialSecurityPolicy>
  updateSecurityPolicy: (id: string, policy: Partial<CredentialSecurityPolicy>) => Promise<CredentialSecurityPolicy>
  deleteSecurityPolicy: (id: string) => Promise<void>
  
  // Backup and recovery
  createBackup: (name: string, credentialIds: string[], description?: string) => Promise<CredentialBackup>
  fetchBackups: () => Promise<void>
  restoreBackup: (backupId: string, overwriteExisting?: boolean) => Promise<{ restored: number; errors: string[] }>
  deleteBackup: (backupId: string) => Promise<void>
  
  clearError: () => void
}

export const useCredentialStore = createWithEqualityFn<CredentialState & CredentialActions>((set, get) => ({
  // State
  credentials: [],
  credentialTypes: [],
  expiringCredentials: [],
  sharedCredentials: [],
  usageLogs: [],
  auditLogs: [],
  securityPolicies: [],
  backups: [],
  isLoading: false,
  error: null,

  // Actions
  fetchCredentials: async () => {
    set({ isLoading: true, error: null })
    try {
      const credentials = await credentialService.getCredentials()
      set({ credentials, isLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch credentials',
        isLoading: false 
      })
    }
  },

  fetchCredentialTypes: async () => {
    set({ isLoading: true, error: null })
    try {
      const credentialTypes = await credentialService.getCredentialTypes()
      set({ credentialTypes, isLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch credential types',
        isLoading: false 
      })
    }
  },

  createCredential: async (data: CreateCredentialRequest) => {
    set({ isLoading: true, error: null })
    try {
      const credential = await credentialService.createCredential(data)
      set(state => ({ 
        credentials: [...state.credentials, credential],
        isLoading: false 
      }))
      return credential
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create credential'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  updateCredential: async (id: string, data: UpdateCredentialRequest) => {
    set({ isLoading: true, error: null })
    try {
      const credential = await credentialService.updateCredential(id, data)
      set(state => ({ 
        credentials: state.credentials.map(c => c.id === id ? credential : c),
        isLoading: false 
      }))
      return credential
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update credential'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  deleteCredential: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await credentialService.deleteCredential(id)
      set(state => ({ 
        credentials: state.credentials.filter(c => c.id !== id),
        isLoading: false 
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete credential'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  testCredential: async (data: TestCredentialRequest) => {
    set({ isLoading: true, error: null })
    try {
      const result = await credentialService.testCredential(data)
      set({ isLoading: false })
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to test credential'
      set({ error: errorMessage, isLoading: false })
      return { success: false, error: errorMessage }
    }
  },

  getCredentialsByType: (type: string) => {
    const { credentials } = get()
    return credentials.filter(credential => credential.type === type)
  },

  // Rotation and expiration
  rotateCredential: async (id: string, newData: CredentialData) => {
    set({ isLoading: true, error: null })
    try {
      const credential = await credentialService.rotateCredential(id, newData)
      set(state => ({ 
        credentials: state.credentials.map(c => c.id === id ? credential : c),
        isLoading: false 
      }))
      return credential
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to rotate credential'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  fetchExpiringCredentials: async (warningDays = 7) => {
    set({ isLoading: true, error: null })
    try {
      const expiringCredentials = await credentialService.getExpiringCredentials(warningDays)
      set({ expiringCredentials, isLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch expiring credentials',
        isLoading: false 
      })
    }
  },

  // Usage and audit
  fetchCredentialUsage: async (credentialId: string) => {
    set({ isLoading: true, error: null })
    try {
      const usageLogs = await credentialService.getCredentialUsage(credentialId)
      set({ usageLogs, isLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch credential usage',
        isLoading: false 
      })
    }
  },

  fetchAuditLogs: async (credentialId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const auditLogs = await credentialService.getCredentialAuditLogs(credentialId)
      set({ auditLogs, isLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch audit logs',
        isLoading: false 
      })
    }
  },

  // Bulk operations
  bulkExportCredentials: async (credentialIds: string[]) => {
    set({ isLoading: true, error: null })
    try {
      const exportData = await credentialService.bulkExportCredentials(credentialIds)
      set({ isLoading: false })
      return exportData
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to export credentials'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  bulkImportCredentials: async (importData: CredentialImportData) => {
    set({ isLoading: true, error: null })
    try {
      const result = await credentialService.bulkImportCredentials(importData)
      // Refresh credentials list
      const credentials = await credentialService.getCredentials()
      set({ credentials, isLoading: false })
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import credentials'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  bulkDeleteCredentials: async (credentialIds: string[]) => {
    set({ isLoading: true, error: null })
    try {
      const result = await credentialService.bulkDeleteCredentials(credentialIds)
      set(state => ({ 
        credentials: state.credentials.filter(c => !credentialIds.includes(c.id)),
        isLoading: false 
      }))
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete credentials'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  bulkRotateCredentials: async (credentialIds: string[]) => {
    set({ isLoading: true, error: null })
    try {
      const result = await credentialService.bulkRotateCredentials(credentialIds)
      // Refresh credentials list to get updated data
      const credentials = await credentialService.getCredentials()
      set({ credentials, isLoading: false })
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to rotate credentials'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  // Sharing
  shareCredential: async (credentialId: string, userId: string, permission: 'USE' | 'VIEW' | 'EDIT' = 'USE') => {
    set({ isLoading: true, error: null })
    try {
      await credentialService.shareCredential(credentialId, userId, permission)
      // Refresh credentials to get updated share status
      const credentials = await credentialService.getCredentials()
      set({ credentials, isLoading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to share credential'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  unshareCredential: async (credentialId: string, userId: string) => {
    set({ isLoading: true, error: null })
    try {
      await credentialService.unshareCredential(credentialId, userId)
      // Refresh credentials to get updated share status
      const credentials = await credentialService.getCredentials()
      set({ credentials, isLoading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to unshare credential'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  fetchSharedCredentials: async () => {
    set({ isLoading: true, error: null })
    try {
      const sharedCredentials = await credentialService.getSharedCredentials()
      set({ sharedCredentials, isLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch shared credentials',
        isLoading: false 
      })
    }
  },

  // Security policies
  fetchSecurityPolicies: async () => {
    set({ isLoading: true, error: null })
    try {
      const securityPolicies = await credentialService.getSecurityPolicies()
      set({ securityPolicies, isLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch security policies',
        isLoading: false 
      })
    }
  },

  createSecurityPolicy: async (policy: Omit<CredentialSecurityPolicy, 'id'>) => {
    set({ isLoading: true, error: null })
    try {
      const newPolicy = await credentialService.createSecurityPolicy(policy)
      set(state => ({ 
        securityPolicies: [...state.securityPolicies, newPolicy],
        isLoading: false 
      }))
      return newPolicy
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create security policy'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  updateSecurityPolicy: async (id: string, policy: Partial<CredentialSecurityPolicy>) => {
    set({ isLoading: true, error: null })
    try {
      const updatedPolicy = await credentialService.updateSecurityPolicy(id, policy)
      set(state => ({ 
        securityPolicies: state.securityPolicies.map(p => p.id === id ? updatedPolicy : p),
        isLoading: false 
      }))
      return updatedPolicy
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update security policy'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  deleteSecurityPolicy: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await credentialService.deleteSecurityPolicy(id)
      set(state => ({ 
        securityPolicies: state.securityPolicies.filter(p => p.id !== id),
        isLoading: false 
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete security policy'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  // Backup and recovery
  createBackup: async (name: string, credentialIds: string[], description?: string) => {
    set({ isLoading: true, error: null })
    try {
      const backup = await credentialService.createBackup(name, credentialIds, description)
      set(state => ({ 
        backups: [...state.backups, backup],
        isLoading: false 
      }))
      return backup
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create backup'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  fetchBackups: async () => {
    set({ isLoading: true, error: null })
    try {
      const backups = await credentialService.getBackups()
      set({ backups, isLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch backups',
        isLoading: false 
      })
    }
  },

  restoreBackup: async (backupId: string, overwriteExisting = false) => {
    set({ isLoading: true, error: null })
    try {
      const result = await credentialService.restoreBackup(backupId, overwriteExisting)
      // Refresh credentials list
      const credentials = await credentialService.getCredentials()
      set({ credentials, isLoading: false })
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to restore backup'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  deleteBackup: async (backupId: string) => {
    set({ isLoading: true, error: null })
    try {
      await credentialService.deleteBackup(backupId)
      set(state => ({ 
        backups: state.backups.filter(b => b.id !== backupId),
        isLoading: false 
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete backup'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))
