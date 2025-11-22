import { useState, useEffect, useMemo } from 'react'
import { Users, Search, UserCheck, UserX, Loader2, UserPlus } from 'lucide-react'
import { Credential } from '@/types'
import { credentialService } from '@/services'
import { teamService } from '@/services/team'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AutoComplete, AutoCompleteOption } from '@/components/ui/autocomplete'

interface User {
  id: string
  name: string | null
  email: string
}

interface Share {
  id: string
  sharedWith: User
  permission: 'USE' | 'VIEW' | 'EDIT'
  sharedAt: string
}

interface TeamData {
  id: string
  name: string
  slug: string
  color: string
  _count?: {
    members?: number
    workflows?: number
    sharedCredentials?: number
  }
}

interface TeamShareData {
  id: string
  name: string
  slug: string
  color: string
}

interface TeamShare {
  id: string
  team: TeamShareData
  permission: 'USE' | 'VIEW' | 'EDIT'
  sharedAt: string
}

interface CredentialSharingModalProps {
  credential: Credential
  onClose: () => void
  onShare: () => void
}

export function CredentialSharingModal({ credential, onClose, onShare }: CredentialSharingModalProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'teams'>('users')
  
  // User sharing state
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [shares, setShares] = useState<Share[]>([])
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [selectedPermission, setSelectedPermission] = useState<'USE' | 'VIEW' | 'EDIT'>('USE')
  const [isSharing, setIsSharing] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Team sharing state
  const [teams, setTeams] = useState<TeamData[]>([])
  const [teamShares, setTeamShares] = useState<TeamShare[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [teamPermission, setTeamPermission] = useState<'USE' | 'VIEW' | 'EDIT'>('USE')
  const [isSharingTeam, setIsSharingTeam] = useState(false)
  const [isLoadingTeams, setIsLoadingTeams] = useState(false)

  // Load existing shares
  useEffect(() => {
    loadShares()
    loadTeams()
    loadTeamShares()
  }, [credential.id])

  // Search users when search term changes
  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchUsers()
    } else {
      setSearchResults([])
    }
  }, [searchTerm])

  const loadShares = async () => {
    try {
      const data = await credentialService.getCredentialShares(credential.id)
      setShares(data)
    } catch (error) {
      console.error('Failed to load shares:', error)
    }
  }

  const searchUsers = async () => {
    setIsSearching(true)
    try {
      const users = await credentialService.searchUsers(searchTerm)
      // Filter out users who already have access
      const filteredUsers = users.filter(
        user => !shares.some(share => share.sharedWith.id === user.id)
      )
      setSearchResults(filteredUsers)
    } catch (error) {
      console.error('Failed to search users:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectUser = (userId: string) => {
    setSelectedUser(userId)
  }

  const handleShareWithSelected = async () => {
    if (!selectedUser) return

    setIsSharing(true)
    setError(null)

    try {
      await credentialService.shareCredential(credential.id, selectedUser, selectedPermission)
      toast.success('Credential shared successfully')
      setSearchTerm('')
      setSearchResults([])
      setSelectedUser(null)
      await loadShares()
      onShare()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to share credential'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsSharing(false)
    }
  }

  const handleUnshareUser = async (userId: string) => {
    if (!confirm('Are you sure you want to revoke access?')) return

    setError(null)

    try {
      await credentialService.unshareCredential(credential.id, userId)
      toast.success('Access revoked successfully')
      await loadShares()
      onShare()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to revoke access'
      setError(errorMessage)
      toast.error(errorMessage)
    }
  }

  const handleUpdatePermission = async (userId: string, newPermission: 'USE' | 'VIEW' | 'EDIT') => {
    try {
      await credentialService.updateSharePermission(credential.id, userId, newPermission)
      toast.success('Permission updated')
      await loadShares()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update permission'
      toast.error(errorMessage)
    }
  }

  const getUserInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  // Team sharing functions
  const loadTeams = async () => {
    setIsLoadingTeams(true)
    try {
      const data = await teamService.getTeams()
      setTeams(data)
    } catch (error) {
      console.error('Failed to load teams:', error)
    } finally {
      setIsLoadingTeams(false)
    }
  }

  const loadTeamShares = async () => {
    try {
      const data = await credentialService.getCredentialShares(credential.id)
      // Filter team shares (those with shareType === 'team')
      const teamSharesData = data.filter((share: any) => share.shareType === 'team')
      setTeamShares(teamSharesData.map((share: any) => ({
        id: share.id,
        team: share.sharedWith,
        permission: share.permission,
        sharedAt: share.sharedAt
      })))
    } catch (error) {
      console.error('Failed to load team shares:', error)
    }
  }

  const handleShareWithTeam = async () => {
    if (!selectedTeam) return

    setIsSharingTeam(true)
    setError(null)

    try {
      await teamService.shareCredentialWithTeam(selectedTeam, credential.id, { permission: teamPermission })
      toast.success('Credential shared with team successfully')
      setSelectedTeam(null)
      await loadTeamShares()
      onShare()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to share with team'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsSharingTeam(false)
    }
  }

  const handleUnshareTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to revoke team access?')) return

    setError(null)

    try {
      await teamService.unshareCredentialFromTeam(teamId, credential.id)
      toast.success('Team access revoked successfully')
      await loadTeamShares()
      onShare()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to revoke team access'
      setError(errorMessage)
      toast.error(errorMessage)
    }
  }

  const handleUpdateTeamPermission = async (teamId: string, newPermission: 'USE' | 'VIEW' | 'EDIT') => {
    try {
      await teamService.updateTeamCredentialPermission(teamId, credential.id, { permission: newPermission })
      toast.success('Team permission updated')
      await loadTeamShares()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update team permission'
      toast.error(errorMessage)
    }
  }

  // Get available teams (not already shared)
  const availableTeams = teams.filter(
    team => !teamShares.some(share => share.team.id === team.id)
  )

  // Convert teams to AutoComplete options
  const teamOptions: AutoCompleteOption[] = useMemo(() => {
    return availableTeams.map(team => ({
      id: team.id,
      label: team.name,
      value: team.id,
      metadata: {
        subtitle: team._count?.members 
          ? `${team._count.members} member${team._count.members !== 1 ? 's' : ''}`
          : 'No members',
        color: team.color,
        slug: team.slug
      }
    }))
  }, [availableTeams])

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <DialogTitle>Share Credential</DialogTitle>
              <DialogDescription>
                Manage access to "{credential.name}"
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Error Display */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Users ({shares.length})
            </TabsTrigger>
            <TabsTrigger value="teams" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Teams ({teamShares.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6 mt-6">

          {/* Currently Shared Users */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Currently Shared With ({shares.length})
            </Label>
            
            {shares.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">This credential is not shared with anyone</p>
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2 pr-4">
                  {shares.map((share) => (
                    <div key={share.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-xs font-medium text-purple-600">
                            {getUserInitials(share.sharedWith.name || share.sharedWith.email)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {share.sharedWith.name || share.sharedWith.email}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{share.sharedWith.email}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Shared {new Date(share.sharedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <Select
                          value={share.permission}
                          onValueChange={(value) => handleUpdatePermission(share.sharedWith.id, value as any)}
                        >
                          <SelectTrigger className="w-[90px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USE">Use</SelectItem>
                            <SelectItem value="VIEW">View</SelectItem>
                            <SelectItem value="EDIT">Edit</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleUnshareUser(share.sharedWith.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <UserX className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <Separator />

          {/* Add Users */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Share with Additional Users
            </Label>

            {/* Search */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={selectedPermission}
                onValueChange={(value: any) => setSelectedPermission(value)}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USE">Use</SelectItem>
                  <SelectItem value="VIEW">View</SelectItem>
                  <SelectItem value="EDIT">Edit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* User List */}
            {isSearching ? (
              <div className="text-center py-6 text-muted-foreground">
                <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
                <p className="text-sm">Searching users...</p>
              </div>
            ) : searchResults.length === 0 && searchTerm.length >= 2 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No users found matching your search</p>
              </div>
            ) : searchResults.length > 0 ? (
              <ScrollArea className="h-[180px]">
                <div className="space-y-2 pr-4">
                  {searchResults.map((user) => (
                    <div 
                      key={user.id} 
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedUser === user.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:bg-accent'
                      }`}
                      onClick={() => handleSelectUser(user.id)}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center shrink-0">
                          <span className="text-xs font-medium">
                            {getUserInitials(user.name || user.email)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {user.name || user.email}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                      {selectedUser === user.id && (
                        <UserCheck className="w-5 h-5 text-primary shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : null}

            {/* Share Button */}
            {selectedUser && (
              <div className="mt-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Share with selected user
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Permission: <Badge variant="outline" className="ml-1">{selectedPermission}</Badge>
                    </p>
                  </div>
                  <Button
                    onClick={handleShareWithSelected}
                    disabled={isSharing}
                    size="sm"
                  >
                    {isSharing ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <UserPlus className="w-4 h-4 mr-2" />
                    )}
                    Share
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Permission Info */}
          <div className="p-4 bg-muted/50 rounded-lg border">
            <h4 className="text-sm font-medium mb-2">Permissions</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><strong className="text-foreground">Use:</strong> Can use credential in workflows</li>
              <li><strong className="text-foreground">View:</strong> Can see credential details</li>
              <li><strong className="text-foreground">Edit:</strong> Can modify credential settings</li>
            </ul>
          </div>
          </TabsContent>

          <TabsContent value="teams" className="space-y-6 mt-6">
            {/* Currently Shared Teams */}
            <div>
              <Label className="text-sm font-medium mb-3 block">
                Currently Shared With Teams ({teamShares.length})
              </Label>
              
              {teamShares.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">This credential is not shared with any teams</p>
                </div>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2 pr-4">
                    {teamShares.map((share) => (
                      <div key={share.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: share.team.color + '20' }}
                          >
                            <Users className="w-4 h-4" style={{ color: share.team.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{share.team.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Shared {new Date(share.sharedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          <Select
                            value={share.permission}
                            onValueChange={(value) => handleUpdateTeamPermission(share.team.id, value as any)}
                          >
                            <SelectTrigger className="w-[90px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USE">Use</SelectItem>
                              <SelectItem value="VIEW">View</SelectItem>
                              <SelectItem value="EDIT">Edit</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleUnshareTeam(share.team.id)}
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <UserX className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            <Separator />

            {/* Add Teams */}
            <div>
              <Label className="text-sm font-medium mb-3 block">
                Share with Teams
              </Label>

              <div className="flex gap-2">
                <div className="flex-1">
                  <AutoComplete
                    value={selectedTeam || ''}
                    onChange={(value) => setSelectedTeam(value || null)}
                    options={teamOptions}
                    placeholder="Select a team..."
                    searchPlaceholder="Search teams..."
                    emptyMessage={isLoadingTeams ? "Loading teams..." : "No teams found"}
                    noOptionsMessage="No teams available to share with"
                    icon={<Users className="w-4 h-4" />}
                    renderOption={(option) => (
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: (option.metadata?.color || '#3b82f6') + '20' }}
                        >
                          <Users className="w-4 h-4" style={{ color: option.metadata?.color || '#3b82f6' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{option.label}</p>
                          {option.metadata?.subtitle && (
                            <p className="text-xs text-muted-foreground truncate">
                              {option.metadata.subtitle}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    renderSelected={(option) => (
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{option.label}</span>
                        {option.metadata?.subtitle && (
                          <span className="text-xs text-muted-foreground">
                            ({option.metadata.subtitle})
                          </span>
                        )}
                      </div>
                    )}
                    disabled={isLoadingTeams}
                    clearable={true}
                    searchable={true}
                  />
                </div>
                <Select
                  value={teamPermission}
                  onValueChange={(value: any) => setTeamPermission(value)}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USE">Use</SelectItem>
                    <SelectItem value="VIEW">View</SelectItem>
                    <SelectItem value="EDIT">Edit</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleShareWithTeam}
                  disabled={!selectedTeam || isSharingTeam}
                  size="default"
                  className="shrink-0"
                >
                  {isSharingTeam ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" />
                  )}
                  Share
                </Button>
              </div>
            </div>

            {/* Permission Info */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <h4 className="text-sm font-medium mb-2">Team Sharing</h4>
              <p className="text-sm text-muted-foreground">
                When you share a credential with a team, all team members will have access to it based on the permission level you set.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
