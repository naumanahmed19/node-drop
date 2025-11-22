import * as React from "react"
import { Check, ChevronsUpDown, Plus, Users, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useTeam } from "@/contexts/TeamContext"

interface TeamSwitcherProps {
  className?: string
  onTeamChange?: (teamId: string | null) => void
  onCreateTeam?: () => void
}

export function TeamSwitcher({ className, onTeamChange, onCreateTeam }: TeamSwitcherProps) {
  const [open, setOpen] = React.useState(false)
  const { teams, currentTeamId, setCurrentTeam } = useTeam()

  const handleTeamSelect = (teamId: string | null) => {
    setCurrentTeam(teamId)
    setOpen(false)
    onTeamChange?.(teamId)
  }

  const handleCreateTeam = () => {
    setOpen(false)
    onCreateTeam?.()
  }

  // Get current team or personal workspace
  const currentTeam = currentTeamId ? teams.find(t => t.id === currentTeamId) : null
  const displayName = currentTeam ? currentTeam.name : "Personal"

  // Separate teams by ownership
  const ownedTeams = teams.filter(t => t.userRole === "OWNER")
  const memberTeams = teams.filter(t => t.userRole !== "OWNER")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select a team"
          className={cn(
            "w-full justify-between bg-sidebar-accent/50 hover:bg-sidebar-accent border-sidebar-border",
            className
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {!currentTeamId ? (
              <User className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
            ) : (
              <Users className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
            )}
            <span className="truncate text-sm font-medium">
              {displayName}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search teams..." />
          <CommandList>
            <CommandEmpty>No team found.</CommandEmpty>
            
            {/* Personal Workspace */}
            <CommandGroup heading="Personal">
              <CommandItem
                onSelect={() => handleTeamSelect(null)}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" />
                <div className="flex-1">
                  <div className="font-medium">Personal</div>
                  <div className="text-xs text-muted-foreground">
                    Your private workspace
                  </div>
                </div>
                {!currentTeamId && (
                  <Check className="ml-2 h-4 w-4" />
                )}
              </CommandItem>
            </CommandGroup>

            {/* Teams You Own */}
            {ownedTeams.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Teams You Own">
                  {ownedTeams.map((team) => (
                    <CommandItem
                      key={team.id}
                      onSelect={() => handleTeamSelect(team.id)}
                      className="cursor-pointer"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{team.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {team._count?.members || 0} members • {team._count?.workflows || 0} workflows
                        </div>
                      </div>
                      {currentTeamId === team.id && (
                        <Check className="ml-2 h-4 w-4 shrink-0" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {/* Teams You're In */}
            {memberTeams.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Teams You're In">
                  {memberTeams.map((team) => (
                    <CommandItem
                      key={team.id}
                      onSelect={() => handleTeamSelect(team.id)}
                      className="cursor-pointer"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{team.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Role: {team.userRole?.toLowerCase()} • {team._count?.workflows || 0} workflows
                        </div>
                      </div>
                      {currentTeamId === team.id && (
                        <Check className="ml-2 h-4 w-4 shrink-0" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {/* Create New Team */}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={handleCreateTeam}
                className="cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span className="font-medium">Create New Team</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
