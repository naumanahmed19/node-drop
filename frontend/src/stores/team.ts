import { createWithEqualityFn } from 'zustand/traditional'
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
import { teamService } from '@/services/team'

interface TeamState {
  teams: Team[]
  currentTeam: Team | null
  currentTeamId: string | null // null = personal workspace
  teamMembers: Record<string, TeamMember[]>
  teamCredentials: Record<string, TeamCredentialShare[]>
  teamWorkflows: Record<string, any[]>
  isLoading: boolean
  error: string | null
}

interface TeamActions {
  // Team CRUD
  fetchTeams: () => Promise<void>
  fetchTeam: (id: string) => Promise<Team>
  createTeam: (data: CreateTeamRequest) => Promise<Team>
  updateTeam: (id: string, data: UpdateTeamRequest) => Promise<Team>
  deleteTeam: (id: string) => Promise<void>

  // Team selection
  setCurrentTeam: (teamId: string | null) => void
  getCurrentTeam: () => Team | null

  // Member management
  fetchTeamMembers: (teamId: string) => Promise<void>
  addTeamMember: (teamId: string, data: AddTeamMemberRequest) => Promise<TeamMember>
  removeTeamMember: (teamId: string, userId: string) => Promise<void>
  updateMemberRole: (teamId: string, userId: string, data: UpdateMemberRoleRequest) => Promise<TeamMember>

  // Credential sharing
  fetchTeamCredentials: (teamId: string) => Promise<void>
  shareCredentialWithTeam: (teamId: string, credentialId: string, data?: ShareCredentialWithTeamRequest) => Promise<TeamCredentialShare>
  unshareCredentialFromTeam: (teamId: string, credentialId: string) => Promise<void>
  updateTeamCredentialPermission: (teamId: string, credentialId: string, data: UpdateTeamCredentialPermissionRequest) => Promise<TeamCredentialShare>

  // Workflow assignment
  fetchTeamWorkflows: (teamId: string) => Promise<void>
  assignWorkflowToTeam: (teamId: string, workflowId: string) => Promise<any>
  removeWorkflowFromTeam: (teamId: string, workflowId: string) => Promise<any>

  // Utility
  clearError: () => void
  reset: () => void
}

const initialState: TeamState = {
  teams: [],
  currentTeam: null,
  currentTeamId: null,
  teamMembers: {},
  teamCredentials: {},
  teamWorkflows: {},
  isLoading: false,
  error: null,
}

export const useTeamStore = createWithEqualityFn<TeamState & TeamActions>((set, get) => ({
  // State
  ...initialState,

  // ============================================
  // TEAM CRUD
  // ============================================

  fetchTeams: async () => {
    set({ isLoading: true, error: null })
    try {
      const teams = await teamService.getTeams()
      set({ teams, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch teams',
        isLoading: false,
      })
    }
  },

  fetchTeam: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const team = await teamService.getTeam(id)
      set(state => ({
        teams: state.teams.map(t => (t.id === id ? team : t)),
        currentTeam: state.currentTeamId === id ? team : state.currentTeam,
        isLoading: false,
      }))
      return team
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch team'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  createTeam: async (data: CreateTeamRequest) => {
    set({ isLoading: true, error: null })
    try {
      const team = await teamService.createTeam(data)
      set(state => ({
        teams: [...state.teams, team],
        isLoading: false,
      }))
      return team
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create team'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  updateTeam: async (id: string, data: UpdateTeamRequest) => {
    set({ isLoading: true, error: null })
    try {
      const team = await teamService.updateTeam(id, data)
      set(state => ({
        teams: state.teams.map(t => {
          if (t.id === id) {
            // Preserve members and other data that might not be in the update response
            return {
              ...t,
              ...team,
              members: team.members || t.members, // Preserve members if not in response
              _count: team._count || t._count, // Preserve counts if not in response
            }
          }
          return t
        }),
        currentTeam: state.currentTeamId === id ? {
          ...state.currentTeam,
          ...team,
          members: team.members || state.currentTeam?.members,
          _count: team._count || state.currentTeam?._count,
        } as any : state.currentTeam,
        isLoading: false,
      }))
      return team
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update team'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  deleteTeam: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await teamService.deleteTeam(id)
      set(state => ({
        teams: state.teams.filter(t => t.id !== id),
        currentTeam: state.currentTeamId === id ? null : state.currentTeam,
        currentTeamId: state.currentTeamId === id ? null : state.currentTeamId,
        isLoading: false,
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete team'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  // ============================================
  // TEAM SELECTION
  // ============================================

  setCurrentTeam: (teamId: string | null) => {
    const { teams } = get()
    const team = teamId ? teams.find(t => t.id === teamId) || null : null
    set({ currentTeamId: teamId, currentTeam: team })
  },

  getCurrentTeam: () => {
    return get().currentTeam
  },

  // ============================================
  // MEMBER MANAGEMENT
  // ============================================

  fetchTeamMembers: async (teamId: string) => {
    set({ isLoading: true, error: null })
    try {
      const members = await teamService.getTeamMembers(teamId)
      set(state => ({
        teamMembers: { ...state.teamMembers, [teamId]: members },
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch team members',
        isLoading: false,
      })
    }
  },

  addTeamMember: async (teamId: string, data: AddTeamMemberRequest) => {
    set({ isLoading: true, error: null })
    try {
      const member = await teamService.addTeamMember(teamId, data)
      set(state => ({
        teamMembers: {
          ...state.teamMembers,
          [teamId]: [...(state.teamMembers[teamId] || []), member],
        },
        isLoading: false,
      }))
      return member
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add team member'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  removeTeamMember: async (teamId: string, userId: string) => {
    set({ isLoading: true, error: null })
    try {
      await teamService.removeTeamMember(teamId, userId)
      set(state => ({
        teamMembers: {
          ...state.teamMembers,
          [teamId]: (state.teamMembers[teamId] || []).filter(m => m.userId !== userId),
        },
        isLoading: false,
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove team member'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  updateMemberRole: async (teamId: string, userId: string, data: UpdateMemberRoleRequest) => {
    set({ isLoading: true, error: null })
    try {
      const member = await teamService.updateMemberRole(teamId, userId, data)
      set(state => ({
        teamMembers: {
          ...state.teamMembers,
          [teamId]: (state.teamMembers[teamId] || []).map(m =>
            m.userId === userId ? member : m
          ),
        },
        isLoading: false,
      }))
      return member
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update member role'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  // ============================================
  // CREDENTIAL SHARING
  // ============================================

  fetchTeamCredentials: async (teamId: string) => {
    set({ isLoading: true, error: null })
    try {
      const credentials = await teamService.getTeamCredentials(teamId)
      set(state => ({
        teamCredentials: { ...state.teamCredentials, [teamId]: credentials },
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch team credentials',
        isLoading: false,
      })
    }
  },

  shareCredentialWithTeam: async (
    teamId: string,
    credentialId: string,
    data: ShareCredentialWithTeamRequest = {}
  ) => {
    set({ isLoading: true, error: null })
    try {
      const share = await teamService.shareCredentialWithTeam(teamId, credentialId, data)
      set(state => ({
        teamCredentials: {
          ...state.teamCredentials,
          [teamId]: [...(state.teamCredentials[teamId] || []), share],
        },
        isLoading: false,
      }))
      return share
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to share credential'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  unshareCredentialFromTeam: async (teamId: string, credentialId: string) => {
    set({ isLoading: true, error: null })
    try {
      await teamService.unshareCredentialFromTeam(teamId, credentialId)
      set(state => ({
        teamCredentials: {
          ...state.teamCredentials,
          [teamId]: (state.teamCredentials[teamId] || []).filter(
            c => c.credentialId !== credentialId
          ),
        },
        isLoading: false,
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to unshare credential'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  updateTeamCredentialPermission: async (
    teamId: string,
    credentialId: string,
    data: UpdateTeamCredentialPermissionRequest
  ) => {
    set({ isLoading: true, error: null })
    try {
      const share = await teamService.updateTeamCredentialPermission(teamId, credentialId, data)
      set(state => ({
        teamCredentials: {
          ...state.teamCredentials,
          [teamId]: (state.teamCredentials[teamId] || []).map(c =>
            c.credentialId === credentialId ? share : c
          ),
        },
        isLoading: false,
      }))
      return share
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update permission'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  // ============================================
  // WORKFLOW ASSIGNMENT
  // ============================================

  fetchTeamWorkflows: async (teamId: string) => {
    set({ isLoading: true, error: null })
    try {
      const workflows = await teamService.getTeamWorkflows(teamId)
      set(state => ({
        teamWorkflows: { ...state.teamWorkflows, [teamId]: workflows },
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch team workflows',
        isLoading: false,
      })
    }
  },

  assignWorkflowToTeam: async (teamId: string, workflowId: string) => {
    set({ isLoading: true, error: null })
    try {
      const workflow = await teamService.assignWorkflowToTeam(teamId, workflowId)
      set(state => ({
        teamWorkflows: {
          ...state.teamWorkflows,
          [teamId]: [...(state.teamWorkflows[teamId] || []), workflow],
        },
        isLoading: false,
      }))
      return workflow
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to assign workflow'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  removeWorkflowFromTeam: async (teamId: string, workflowId: string) => {
    set({ isLoading: true, error: null })
    try {
      const workflow = await teamService.removeWorkflowFromTeam(teamId, workflowId)
      set(state => ({
        teamWorkflows: {
          ...state.teamWorkflows,
          [teamId]: (state.teamWorkflows[teamId] || []).filter(w => w.id !== workflowId),
        },
        isLoading: false,
      }))
      return workflow
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove workflow'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  // ============================================
  // UTILITY
  // ============================================

  clearError: () => {
    set({ error: null })
  },

  reset: () => {
    set(initialState)
  },
}))
