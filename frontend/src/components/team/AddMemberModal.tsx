import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTeamStore } from "@/stores/team"
import { TeamRole } from "@/types"
import { toast } from "sonner"
import { Mail, UserPlus } from "lucide-react"

interface AddMemberModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  teamName: string
  onSuccess?: () => void
}

export function AddMemberModal({
  open,
  onOpenChange,
  teamId,
  teamName,
  onSuccess,
}: AddMemberModalProps) {
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<TeamRole>("MEMBER")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const { addTeamMember } = useTeamStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      toast.error("Please enter an email address")
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address")
      return
    }

    setIsSubmitting(true)

    try {
      await addTeamMember(teamId, {
        email: email.trim(),
        role,
      })

      toast.success(`Invitation sent to ${email}`)
      onOpenChange(false)
      onSuccess?.()

      // Reset form
      setEmail("")
      setRole("MEMBER")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to add member"
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
    // Reset form
    setEmail("")
    setRole("MEMBER")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add Team Member
            </DialogTitle>
            <DialogDescription>
              Invite someone to join <span className="font-medium">{teamName}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Email Input */}
            <div className="grid gap-2">
              <Label htmlFor="email">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The user must have an account to be added to the team
              </p>
            </div>

            {/* Role Selection */}
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as TeamRole)}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Member</span>
                      <span className="text-xs text-muted-foreground">
                        Can create and edit workflows, use credentials
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="VIEWER">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Viewer</span>
                      <span className="text-xs text-muted-foreground">
                        Read-only access to team resources
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Role Description */}
            <div className="rounded-lg border bg-muted/50 p-3">
              <h4 className="text-sm font-medium mb-2">Role Permissions</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                {role === "MEMBER" ? (
                  <>
                    <li>✓ View team workflows and credentials</li>
                    <li>✓ Create and edit workflows</li>
                    <li>✓ Use shared credentials</li>
                    <li>✗ Manage team settings</li>
                    <li>✗ Add or remove members</li>
                  </>
                ) : (
                  <>
                    <li>✓ View team workflows and credentials</li>
                    <li>✗ Create or edit workflows</li>
                    <li>✗ Use shared credentials</li>
                    <li>✗ Manage team settings</li>
                    <li>✗ Add or remove members</li>
                  </>
                )}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !email.trim()}>
              {isSubmitting ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
