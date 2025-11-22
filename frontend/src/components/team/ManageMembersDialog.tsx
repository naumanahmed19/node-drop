import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTeamStore } from "@/stores/team"
import { TeamRole, TeamMember } from "@/types"
import { toast } from "sonner"
import { Crown, Users as UsersIcon, Eye, UserMinus, UserPlus, Mail } from "lucide-react"
import { useConfirmDialog } from "@/components/ui/ConfirmDialog"

interface ManageMembersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  teamName: string
  userRole: TeamRole
  onAddMember?: () => void
}

export function ManageMembersDialog({
  open,
  onOpenChange,
  teamId,
  teamName,
  userRole,
  onAddMember,
}: ManageMembersDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false)
  const { teamMembers, fetchTeamMembers, updateMemberRole, removeTeamMember } = useTeamStore()
  const { showConfirm, ConfirmDialog } = useConfirmDialog()

  const members = teamMembers[teamId] || []
  const isOwner = userRole === "OWNER"

  // Fetch members when dialog opens
  React.useEffect(() => {
    if (open && teamId) {
      setIsLoading(true)
      fetchTeamMembers(teamId).finally(() => setIsLoading(false))
    }
  }, [open, teamId, fetchTeamMembers])

  const handleRoleChange = async (userId: string, newRole: TeamRole) => {
    try {
      await updateMemberRole(teamId, userId, { role: newRole })
      toast.success("Member role updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role")
    }
  }

  const handleRemoveMember = async (member: TeamMember) => {
    const confirmed = await showConfirm({
      title: "Remove Team Member",
      message: `Are you sure you want to remove ${member.user.name || member.user.email} from ${teamName}?`,
      details: [
        "They will lose access to all team workflows and credentials",
        "This action cannot be undone",
      ],
      confirmText: "Remove Member",
      cancelText: "Cancel",
      severity: "warning",
    })

    if (!confirmed) return

    try {
      await removeTeamMember(teamId, member.userId)
      toast.success("Member removed from team")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove member")
    }
  }

  const getRoleIcon = (role: TeamRole) => {
    switch (role) {
      case "OWNER":
        return <Crown className="h-3.5 w-3.5 text-yellow-500" />
      case "MEMBER":
        return <UsersIcon className="h-3.5 w-3.5 text-green-500" />
      case "VIEWER":
        return <Eye className="h-3.5 w-3.5 text-gray-500" />
    }
  }

  const getRoleBadgeVariant = (role: TeamRole) => {
    switch (role) {
      case "OWNER":
        return "default"
      case "MEMBER":
        return "secondary"
      case "VIEWER":
        return "outline"
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              Team Members
            </DialogTitle>
            <DialogDescription>
              Manage members of <span className="font-medium">{teamName}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add Member Button */}
            {isOwner && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onOpenChange(false)
                  onAddMember?.()
                }}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            )}

            {/* Members List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {members.length} {members.length === 1 ? "member" : "members"}
                </span>
              </div>

              <ScrollArea className="h-[400px] pr-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-muted-foreground">Loading members...</div>
                  </div>
                ) : members.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <UsersIcon className="h-12 w-12 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">No members yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        {/* Avatar */}
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="text-sm font-medium">
                            {(member.user.name || member.user.email)
                              .substring(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        {/* User Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {member.user.name || "Unknown"}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{member.user.email}</span>
                          </div>
                        </div>

                        {/* Role Badge/Selector */}
                        <div className="flex items-center gap-2">
                          {member.role === "OWNER" ? (
                            <Badge variant={getRoleBadgeVariant(member.role)} className="gap-1">
                              {getRoleIcon(member.role)}
                              Owner
                            </Badge>
                          ) : isOwner ? (
                            <Select
                              value={member.role}
                              onValueChange={(value) =>
                                handleRoleChange(member.userId, value as TeamRole)
                              }
                            >
                              <SelectTrigger className="h-8 w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="MEMBER">
                                  <div className="flex items-center gap-2">
                                    {getRoleIcon("MEMBER")}
                                    <span>Member</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="VIEWER">
                                  <div className="flex items-center gap-2">
                                    {getRoleIcon("VIEWER")}
                                    <span>Viewer</span>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant={getRoleBadgeVariant(member.role)} className="gap-1">
                              {getRoleIcon(member.role)}
                              {member.role.charAt(0) + member.role.slice(1).toLowerCase()}
                            </Badge>
                          )}

                          {/* Remove Button */}
                          {isOwner && member.role !== "OWNER" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveMember(member)}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Info Box */}
            {!isOwner && (
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  Only team owners can add or remove members and change roles.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog />
    </>
  )
}
