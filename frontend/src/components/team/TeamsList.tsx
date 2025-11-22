import * as React from "react"
import { Users, Plus, Settings, Crown, Eye, Search, MoreVertical, UserPlus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useTeam } from "@/contexts/TeamContext"
import { useSidebarContext } from "@/contexts"
import { Team, TeamRole } from "@/types"

interface TeamsListProps {
  onTeamSelect?: (team: { id: string; name: string; userRole: string }) => void
  onCreateTeam?: () => void
  onTeamSettings?: (team: { id: string; name: string; description?: string; color: string }) => void
}

export function TeamsList({ onTeamSelect, onCreateTeam, onTeamSettings }: TeamsListProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const { teams, isLoading, refreshTeams } = useTeam()
  const { setHeaderSlot } = useSidebarContext()

  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refreshTeams()
    } finally {
      setIsRefreshing(false)
    }
  }, [refreshTeams])

  const ownedTeams = teams.filter(t => t.userRole === "OWNER")
  const memberTeams = teams.filter(t => t.userRole !== "OWNER")

  const filteredOwnedTeams = ownedTeams.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredMemberTeams = memberTeams.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getRoleIcon = (role: TeamRole) => {
    switch (role) {
      case "OWNER":
        return <Crown className="h-3.5 w-3.5 text-yellow-500" />
      case "MEMBER":
        return <Users className="h-3.5 w-3.5 text-green-500" />
      case "VIEWER":
        return <Eye className="h-3.5 w-3.5 text-gray-500" />
    }
  }

  const getRoleLabel = (role: TeamRole) => {
    return role.charAt(0) + role.slice(1).toLowerCase()
  }

  // Memoize the create team handler to prevent unnecessary re-renders
  const handleCreateTeam = React.useCallback(() => {
    onCreateTeam?.()
  }, [onCreateTeam])

  // Set header slot with count, refresh, and search
  React.useEffect(() => {
    setHeaderSlot(
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {teams.length} team{teams.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh teams"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2"
              onClick={handleCreateTeam}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="text-xs">New</span>
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>
    )
    return () => setHeaderSlot(null)
  }, [teams.length, searchQuery, isRefreshing, setHeaderSlot, handleCreateTeam, handleRefresh])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-muted-foreground">Loading teams...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">

      {/* Teams List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Teams You Own */}
          {filteredOwnedTeams.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Teams You Own ({filteredOwnedTeams.length})
              </h3>
              <div className="space-y-2">
                {filteredOwnedTeams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    onSelect={() => onTeamSelect?.({ id: team.id, name: team.name, userRole: team.userRole || 'MEMBER' })}
                    onSettings={() => onTeamSettings?.({ id: team.id, name: team.name, description: team.description, color: team.color })}
                    getRoleIcon={getRoleIcon}
                    getRoleLabel={getRoleLabel}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Teams You're In */}
          {filteredMemberTeams.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Teams You're In ({filteredMemberTeams.length})
              </h3>
              <div className="space-y-2">
                {filteredMemberTeams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    onSelect={() => onTeamSelect?.({ id: team.id, name: team.name, userRole: team.userRole || 'MEMBER' })}
                    onSettings={() => onTeamSettings?.({ id: team.id, name: team.name, description: team.description, color: team.color })}
                    getRoleIcon={getRoleIcon}
                    getRoleLabel={getRoleLabel}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredOwnedTeams.length === 0 && filteredMemberTeams.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-sm font-medium mb-1">
                {searchQuery ? "No teams found" : "No teams yet"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-[250px]">
                {searchQuery
                  ? "Try a different search term"
                  : "Create your first team to collaborate with others"}
              </p>
              {!searchQuery && (
                <Button size="sm" onClick={onCreateTeam}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Team
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

interface TeamCardProps {
  team: Team
  onSelect: () => void
  onSettings?: () => void
  getRoleIcon: (role: TeamRole) => React.ReactNode
  getRoleLabel: (role: TeamRole) => string
}

function TeamCard({ team, onSelect, onSettings, getRoleIcon, getRoleLabel }: TeamCardProps) {
  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 p-3 rounded-lg border border-sidebar-border",
        "bg-sidebar-accent/30 hover:bg-sidebar-accent hover:border-sidebar-accent-foreground/20",
        "transition-all cursor-pointer"
      )}
      onClick={onSelect}
    >
      {/* Team icon - matches NodeTypesList style */}
      <div
        className="flex items-center justify-center h-8 w-8 rounded-lg shrink-0 mt-0.5"
        style={{ backgroundColor: `${team.color}20` }}
      >
        <Users className="h-4 w-4" style={{ color: team.color }} />
      </div>

      {/* Team info */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="font-medium">
          <div className="flex items-start gap-2 flex-wrap">
            <span className="break-words min-w-0" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{team.name}</span>
            {/* Role badge inline */}
            {team.userRole && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sidebar text-[10px] font-medium border border-sidebar-border shrink-0">
                {getRoleIcon(team.userRole)}
                <span>{getRoleLabel(team.userRole)}</span>
              </div>
            )}
          </div>
        </div>

        {team.description && (
          <div
            className="text-xs text-muted-foreground leading-relaxed mt-1"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
              hyphens: 'auto'
            }}
          >
            {team.description}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 whitespace-nowrap">
          <span>{team._count?.workflows || 0} workflows</span>
          <span>•</span>
          <span>{team._count?.credentials || 0} credentials</span>
        </div>

        {/* Avatar group - matches CredentialsList style */}
        {team.members && team.members.length > 0 && (
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {team.members.slice(0, 5).map((member) => (
                  <Tooltip key={member.id}>
                    <TooltipTrigger asChild>
                      <Avatar className="h-6 w-6 border-2 border-background ring-1 ring-border">
                        <AvatarFallback className="text-[10px] font-medium bg-primary/10 text-primary">
                          {(member.user.name || member.user.email).substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">{member.user.name || member.user.email}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
                {(team._count?.members || 0) > 5 && (
                  <div className="h-6 w-6 rounded-full border-2 border-background ring-1 ring-border bg-muted flex items-center justify-center">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      +{(team._count?.members || 0) - 5}
                    </span>
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {team._count?.members || 0} {(team._count?.members || 0) === 1 ? 'member' : 'members'}
              </span>
            </div>
          </TooltipProvider>
        )}
      </div>

      {/* Actions - Dropdown menu */}
      <div className="shrink-0 self-start opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onSelect()
              }}
            >
              <Users className="h-4 w-4 mr-2" />
              View Members
            </DropdownMenuItem>
            {team.userRole === "OWNER" && (
              <>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    // This will open add member modal after opening manage members
                    onSelect()
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Member
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onSettings?.()
                  }}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Team Settings
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
