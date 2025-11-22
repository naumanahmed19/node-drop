import { apiClient } from './api'
import {
  Team,
  TeamMember,
  TeamCredentialShare,
  CreateTeamRequest,
  UpdateTeamRequest,
  AddTeamMemberRequest,
  UpdateMemberRoleRequest,
  ShareCredentialWithTeamRequest,
  UpdateTeamCredentialPermissionRequest,
} from '@/types'

export class TeamService {
  // ============================================
  // TEAM CRUD
  // ============================================

  async getTeams(): Promise<Team[]> {
    const response = await apiClient.get<Team[]>('/teams')
    return response.data || []
  }

  async getTeam(id: string): Promise<Team> {
    const response = await apiClient.get<Team>(`/teams/${id}`)
    if (!response.success || !response.data) {
      throw new Error('Failed to fetch team')
    }
    return response.data
  }

  async createTeam(data: CreateTeamRequest): Promise<Team> {
    const response = await apiClient.post<Team>('/teams', data)
    if (!response.success || !response.data) {
      throw new Error('Failed to create team')
    }
    return response.data
  }

  async updateTeam(id: string, data: UpdateTeamRequest): Promise<Team> {
    const response = await apiClient.put<Team>(`/teams/${id}`, data)
    if (!response.success || !response.data) {
      throw new Error('Failed to update team')
    }
    return response.data
  }

  async deleteTeam(id: string): Promise<void> {
    const response = await apiClient.delete(`/teams/${id}`)
    if (!response.success) {
      throw new Error('Failed to delete team')
    }
  }

  // ============================================
  // MEMBER MANAGEMENT
  // ============================================

  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const response = await apiClient.get<TeamMember[]>(`/teams/${teamId}/members`)
    return response.data || []
  }

  async addTeamMember(teamId: string, data: AddTeamMemberRequest): Promise<TeamMember> {
    const response = await apiClient.post<TeamMember>(`/teams/${teamId}/members`, data)
    if (!response.success || !response.data) {
      throw new Error('Failed to add team member')
    }
    return response.data
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    const response = await apiClient.delete(`/teams/${teamId}/members/${userId}`)
    if (!response.success) {
      throw new Error('Failed to remove team member')
    }
  }

  async updateMemberRole(teamId: string, userId: string, data: UpdateMemberRoleRequest): Promise<TeamMember> {
    const response = await apiClient.patch<TeamMember>(`/teams/${teamId}/members/${userId}/role`, data)
    if (!response.success || !response.data) {
      throw new Error('Failed to update member role')
    }
    return response.data
  }

  // ============================================
  // CREDENTIAL SHARING
  // ============================================

  async getTeamCredentials(teamId: string): Promise<TeamCredentialShare[]> {
    const response = await apiClient.get<TeamCredentialShare[]>(`/teams/${teamId}/credentials`)
    return response.data || []
  }

  async shareCredentialWithTeam(
    teamId: string,
    credentialId: string,
    data: ShareCredentialWithTeamRequest = {}
  ): Promise<TeamCredentialShare> {
    const response = await apiClient.post<TeamCredentialShare>(
      `/teams/${teamId}/credentials/${credentialId}`,
      data
    )
    if (!response.success || !response.data) {
      throw new Error('Failed to share credential with team')
    }
    return response.data
  }

  async unshareCredentialFromTeam(teamId: string, credentialId: string): Promise<void> {
    const response = await apiClient.delete(`/teams/${teamId}/credentials/${credentialId}`)
    if (!response.success) {
      throw new Error('Failed to unshare credential from team')
    }
  }

  async updateTeamCredentialPermission(
    teamId: string,
    credentialId: string,
    data: UpdateTeamCredentialPermissionRequest
  ): Promise<TeamCredentialShare> {
    const response = await apiClient.patch<TeamCredentialShare>(
      `/teams/${teamId}/credentials/${credentialId}/permission`,
      data
    )
    if (!response.success || !response.data) {
      throw new Error('Failed to update credential permission')
    }
    return response.data
  }

  async getCredentialTeamShares(credentialId: string): Promise<TeamCredentialShare[]> {
    const response = await apiClient.get<TeamCredentialShare[]>(`/credentials/${credentialId}/teams`)
    return response.data || []
  }

  // ============================================
  // WORKFLOW ASSIGNMENT
  // ============================================

  async getTeamWorkflows(teamId: string): Promise<any[]> {
    const response = await apiClient.get<any[]>(`/teams/${teamId}/workflows`)
    return response.data || []
  }

  async assignWorkflowToTeam(teamId: string, workflowId: string): Promise<any> {
    const response = await apiClient.put<any>(`/teams/${teamId}/workflows/${workflowId}`)
    if (!response.success || !response.data) {
      throw new Error('Failed to assign workflow to team')
    }
    return response.data
  }

  async removeWorkflowFromTeam(teamId: string, workflowId: string): Promise<any> {
    const response = await apiClient.delete<any>(`/teams/${teamId}/workflows/${workflowId}`)
    if (!response.success || !response.data) {
      throw new Error('Failed to remove workflow from team')
    }
    return response.data
  }
}

export const teamService = new TeamService()
