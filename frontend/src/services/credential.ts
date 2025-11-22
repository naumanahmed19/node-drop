import { apiClient } from './api'
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

export class CredentialService {
  async getCredentials(): Promise<Credential[]> {
    const response = await apiClient.get<Credential[]>('/credentials')
    return response.data || []
  }

  async getCredential(id: string): Promise<Credential> {
    const response = await apiClient.get<Credential>(`/credentials/${id}`)
    if (!response.success || !response.data) {
      throw new Error('Failed to fetch credential')
    }
    return response.data
  }

  async createCredential(data: CreateCredentialRequest): Promise<Credential> {
    const response = await apiClient.post<Credential>('/credentials', data)
    if (!response.success || !response.data) {
      throw new Error('Failed to create credential')
    }
    return response.data
  }

  async updateCredential(id: string, data: UpdateCredentialRequest): Promise<Credential> {
    const response = await apiClient.put<Credential>(`/credentials/${id}`, data)
    if (!response.success || !response.data) {
      throw new Error('Failed to update credential')
    }
    return response.data
  }

  async deleteCredential(id: string): Promise<void> {
    const response = await apiClient.delete(`/credentials/${id}`)
    if (!response.success) {
      throw new Error('Failed to delete credential')
    }
  }

  async getCredentialTypes(): Promise<CredentialType[]> {
    const response = await apiClient.get<CredentialType[]>('/credentials/types')
    return response.data || []
  }

  async testCredential(data: TestCredentialRequest): Promise<TestCredentialResponse> {
    const response = await apiClient.post<TestCredentialResponse>('/credentials/test', data)
    return response.data || { success: false, error: 'Unknown error' }
  }

  async getCredentialsByType(type: string): Promise<Credential[]> {
    const response = await apiClient.get<Credential[]>(`/credentials?type=${encodeURIComponent(type)}`)
    return response.data || []
  }

  // Credential rotation
  async rotateCredential(id: string, newData: CredentialData): Promise<Credential> {
    const response = await apiClient.post<Credential>(`/credentials/${id}/rotate`, { data: newData })
    if (!response.success || !response.data) {
      throw new Error('Failed to rotate credential')
    }
    return response.data
  }

  async getExpiringCredentials(warningDays: number = 7): Promise<Credential[]> {
    const response = await apiClient.get<Credential[]>(`/credentials/expiring/${warningDays}`)
    return response.data || []
  }

  // Usage tracking and audit logs
  async getCredentialUsage(credentialId: string): Promise<CredentialUsageLog[]> {
    const response = await apiClient.get<CredentialUsageLog[]>(`/credentials/${credentialId}/usage`)
    return response.data || []
  }

  async getCredentialAuditLogs(credentialId?: string): Promise<CredentialAuditLog[]> {
    const url = credentialId ? `/credentials/${credentialId}/audit` : '/credentials/audit'
    const response = await apiClient.get<CredentialAuditLog[]>(url)
    return response.data || []
  }

  // Bulk operations
  async bulkExportCredentials(credentialIds: string[]): Promise<CredentialExportData> {
    const response = await apiClient.post<CredentialExportData>('/credentials/bulk/export', {
      credentialIds
    })
    if (!response.success || !response.data) {
      throw new Error('Failed to export credentials')
    }
    return response.data
  }

  async bulkImportCredentials(importData: CredentialImportData): Promise<{ imported: number; errors: string[] }> {
    const response = await apiClient.post<{ imported: number; errors: string[] }>('/credentials/bulk/import', importData)
    if (!response.success || !response.data) {
      throw new Error('Failed to import credentials')
    }
    return response.data
  }

  async bulkDeleteCredentials(credentialIds: string[]): Promise<{ deleted: number; errors: string[] }> {
    const response = await apiClient.post<{ deleted: number; errors: string[] }>('/credentials/bulk/delete', {
      credentialIds
    })
    if (!response.success || !response.data) {
      throw new Error('Failed to delete credentials')
    }
    return response.data
  }

  async bulkRotateCredentials(credentialIds: string[]): Promise<{ rotated: number; errors: string[] }> {
    const response = await apiClient.post<{ rotated: number; errors: string[] }>('/credentials/bulk/rotate', {
      credentialIds
    })
    if (!response.success || !response.data) {
      throw new Error('Failed to rotate credentials')
    }
    return response.data
  }

  // Credential sharing
  async shareCredential(credentialId: string, userId: string, permission: 'USE' | 'VIEW' | 'EDIT' = 'USE'): Promise<any> {
    const response = await apiClient.post(`/credentials/${credentialId}/share`, { userId, permission })
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to share credential')
    }
    return response.data
  }

  async unshareCredential(credentialId: string, userId: string): Promise<void> {
    const response = await apiClient.delete(`/credentials/${credentialId}/share/${userId}`)
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to unshare credential')
    }
  }

  async getCredentialShares(credentialId: string): Promise<any[]> {
    const response = await apiClient.get<any[]>(`/credentials/${credentialId}/shares`)
    return response.data || []
  }

  async updateSharePermission(credentialId: string, userId: string, permission: 'USE' | 'VIEW' | 'EDIT'): Promise<any> {
    const response = await apiClient.put(`/credentials/${credentialId}/share/${userId}`, { permission })
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to update permission')
    }
    return response.data
  }

  async getSharedCredentials(): Promise<Credential[]> {
    const response = await apiClient.get<Credential[]>('/credentials/shared-with-me')
    return response.data || []
  }

  async searchUsers(query: string): Promise<any[]> {
    const response = await apiClient.get<any[]>(`/users/search?query=${encodeURIComponent(query)}`)
    return response.data || []
  }

  // Security policies
  async getSecurityPolicies(): Promise<CredentialSecurityPolicy[]> {
    const response = await apiClient.get<CredentialSecurityPolicy[]>('/credentials/security-policies')
    return response.data || []
  }

  async createSecurityPolicy(policy: Omit<CredentialSecurityPolicy, 'id'>): Promise<CredentialSecurityPolicy> {
    const response = await apiClient.post<CredentialSecurityPolicy>('/credentials/security-policies', policy)
    if (!response.success || !response.data) {
      throw new Error('Failed to create security policy')
    }
    return response.data
  }

  async updateSecurityPolicy(id: string, policy: Partial<CredentialSecurityPolicy>): Promise<CredentialSecurityPolicy> {
    const response = await apiClient.put<CredentialSecurityPolicy>(`/credentials/security-policies/${id}`, policy)
    if (!response.success || !response.data) {
      throw new Error('Failed to update security policy')
    }
    return response.data
  }

  async deleteSecurityPolicy(id: string): Promise<void> {
    const response = await apiClient.delete(`/credentials/security-policies/${id}`)
    if (!response.success) {
      throw new Error('Failed to delete security policy')
    }
  }

  // Backup and recovery
  async createBackup(name: string, credentialIds: string[], description?: string): Promise<CredentialBackup> {
    const response = await apiClient.post<CredentialBackup>('/credentials/backup', {
      name,
      credentialIds,
      description
    })
    if (!response.success || !response.data) {
      throw new Error('Failed to create backup')
    }
    return response.data
  }

  async getBackups(): Promise<CredentialBackup[]> {
    const response = await apiClient.get<CredentialBackup[]>('/credentials/backup')
    return response.data || []
  }

  async restoreBackup(backupId: string, overwriteExisting: boolean = false): Promise<{ restored: number; errors: string[] }> {
    const response = await apiClient.post<{ restored: number; errors: string[] }>(`/credentials/backup/${backupId}/restore`, {
      overwriteExisting
    })
    if (!response.success || !response.data) {
      throw new Error('Failed to restore backup')
    }
    return response.data
  }

  async deleteBackup(backupId: string): Promise<void> {
    const response = await apiClient.delete(`/credentials/backup/${backupId}`)
    if (!response.success) {
      throw new Error('Failed to delete backup')
    }
  }
}

export const credentialService = new CredentialService()
