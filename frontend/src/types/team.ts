// Team-related type definitions

export type TeamRole = 'OWNER' | 'MEMBER' | 'VIEWER'

export type SharePermission = 'USE' | 'VIEW' | 'EDIT'

export interface Team {
  id: string
  name: string
  slug: string
  description?: string
  color: string
  ownerId: string
  settings?: Record<string, any>
  createdAt: string
  updatedAt: string
  owner?: {
    id: string
    name: string | null
    email: string
  }
  members?: TeamMember[]
  userRole?: TeamRole
  _count?: {
    members?: number
    workflows?: number
    credentials?: number
  }
}

export interface TeamMember {
  id: string
  teamId: string
  userId: string
  role: TeamRole
  joinedAt: string
  user: {
    id: string
    name: string | null
    email: string
  }
}

export interface TeamCredentialShare {
  id: string
  credentialId: string
  teamId: string
  permission: SharePermission
  sharedAt: string
  sharedBy?: string
  credential?: {
    id: string
    name: string
    type: string
    userId: string
    createdAt: string
    updatedAt: string
    expiresAt?: string | null
  }
  team?: {
    id: string
    name: string
    slug: string
    color: string
  }
  sharer?: {
    id: string
    name: string | null
    email: string
  }
}

export interface CreateTeamRequest {
  name: string
  slug?: string
  description?: string
  color?: string
}

export interface UpdateTeamRequest {
  name?: string
  slug?: string
  description?: string
  color?: string
  settings?: Record<string, any>
}

export interface AddTeamMemberRequest {
  email: string
  role?: TeamRole
}

export interface UpdateMemberRoleRequest {
  role: TeamRole
}

export interface ShareCredentialWithTeamRequest {
  permission?: SharePermission
}

export interface UpdateTeamCredentialPermissionRequest {
  permission: SharePermission
}
