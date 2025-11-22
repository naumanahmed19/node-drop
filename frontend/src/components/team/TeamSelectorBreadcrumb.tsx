import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useTeam } from '@/contexts/TeamContext'
import { Check, ChevronDown, User, Users } from 'lucide-react'

interface TeamSelectorBreadcrumbProps {
  currentTeamId?: string | null
  workflowName?: string
  onTeamChange?: (teamId: string | null) => void
  disabled?: boolean
}

export function TeamSelectorBreadcrumb({
  currentTeamId,
  workflowName = 'this workflow',
  onTeamChange,
  disabled = false,
}: TeamSelectorBreadcrumbProps) {
  const { showConfirm, ConfirmDialog } = useConfirmDialog()
  const { teams } = useTeam()

  const currentTeam = teams.find(t => t.id === currentTeamId)
  const isPersonal = !currentTeamId

  const handleTeamSelect = async (teamId: string | null) => {
    // If selecting the same team, do nothing
    if (teamId === currentTeamId) return

    // Show confirmation dialog
    const fromContext = isPersonal ? 'Personal' : currentTeam?.name || 'current team'
    const toContext = teamId ? teams.find(t => t.id === teamId)?.name || 'team' : 'Personal'

    const confirmed = await showConfirm({
      title: `Move Workflow to ${toContext}?`,
      message: `This will move "${workflowName}" from ${fromContext} to ${toContext}.`,
      details: teamId
        ? [
            'All team members will get access to this workflow',
            'The workflow will appear in the team\'s workspace',
            'You can move it back anytime',
          ]
        : [
            'Team members will lose access to this workflow',
            'The workflow will become private to you',
            'You can share it with teams again later',
          ],
      confirmText: 'Move Workflow',
      cancelText: 'Cancel',
      severity: 'warning',
    })

    if (confirmed) {
      onTeamChange?.(teamId)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            disabled={disabled}
            className={`flex items-center gap-2 text-sm hover:text-foreground transition-colors cursor-pointer px-0 bg-transparent border-0 ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            } ${isPersonal ? 'text-muted-foreground' : ''}`}
          >
            {isPersonal ? (
              <User className="w-4 h-4" />
            ) : (
              <Users className="w-4 h-4" />
            )}
            <span className="flex-1 text-left font-medium">
              {isPersonal ? 'Personal' : currentTeam?.name || 'Team'}
            </span>
            {!disabled && <ChevronDown className="w-3 h-3 opacity-50" />}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-[280px] bg-popover">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Workflow Owner
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Personal Option */}
          <DropdownMenuItem
            onClick={() => handleTeamSelect(null)}
            className="flex items-center gap-3 py-3 cursor-pointer"
          >
            <User className="w-4 h-4" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">Personal</span>
                {isPersonal && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Your private workspace
              </div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Teams */}
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Your Teams
          </DropdownMenuLabel>

          {teams.length === 0 ? (
            <div className="px-2 py-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground mb-1">No teams yet</p>
              <p className="text-xs text-muted-foreground/70">
                Create a team to collaborate with others
              </p>
            </div>
          ) : (
            teams.map(team => (
              <DropdownMenuItem
                key={team.id}
                onClick={() => handleTeamSelect(team.id)}
                className="flex items-center gap-3 py-3 cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{team.name}</span>
                    {currentTeamId === team.id && (
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {team._count?.members || 0} members
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog />
    </>
  )
}
