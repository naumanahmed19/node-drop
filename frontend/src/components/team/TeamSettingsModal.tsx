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
import { Textarea } from "@/components/ui/textarea"
import { useTeamStore } from "@/stores/team"
import { toast } from "sonner"
import { Settings, Trash2 } from "lucide-react"
import { useConfirmDialog } from "@/components/ui/ConfirmDialog"

interface TeamSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  initialData: {
    name: string
    description?: string
    color: string
  }
  onSuccess?: () => void
  onDelete?: () => void
}

const TEAM_COLORS = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#10b981" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Orange", value: "#f59e0b" },
  { name: "Pink", value: "#ec4899" },
  { name: "Red", value: "#ef4444" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Indigo", value: "#6366f1" },
]

export function TeamSettingsModal({
  open,
  onOpenChange,
  teamId,
  initialData,
  onSuccess,
  onDelete,
}: TeamSettingsModalProps) {
  const [name, setName] = React.useState(initialData.name)
  const [description, setDescription] = React.useState(initialData.description || "")
  const [selectedColor, setSelectedColor] = React.useState(initialData.color)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const { updateTeam, deleteTeam } = useTeamStore()
  const { showConfirm, ConfirmDialog } = useConfirmDialog()

  // Update form only when dialog opens (not on every render)
  React.useEffect(() => {
    if (open) {
      setName(initialData.name)
      setDescription(initialData.description || "")
      setSelectedColor(initialData.color)
    }
  }, [open]) // Only depend on 'open', not initialData

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Please enter a team name")
      return
    }

    setIsSubmitting(true)

    try {
      await updateTeam(teamId, {
        name: name.trim(),
        description: description.trim() || undefined,
        color: selectedColor,
      })

      toast.success("Team settings updated!")
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update team")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    const confirmed = await showConfirm({
      title: "Delete Team",
      message: `Are you sure you want to delete "${initialData.name}"?`,
      details: [
        "All team workflows will become personal workflows",
        "All team members will lose access",
        "All credential shares with this team will be removed",
        "This action cannot be undone",
      ],
      confirmText: "Delete Team",
      cancelText: "Cancel",
      severity: "danger",
    })

    if (!confirmed) return

    setIsDeleting(true)

    try {
      await deleteTeam(teamId)
      toast.success("Team deleted successfully")
      onOpenChange(false)
      onDelete?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete team")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
    // Reset form to initial values
    setName(initialData.name)
    setDescription(initialData.description || "")
    setSelectedColor(initialData.color)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Team Settings
              </DialogTitle>
              <DialogDescription>
                Update team information and settings
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Team Name */}
              <div className="grid gap-2">
                <Label htmlFor="name">
                  Team Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., Engineering Team"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  {name.length}/50 characters
                </p>
              </div>

              {/* Description */}
              <div className="grid gap-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="What is this team for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  {description.length}/200 characters
                </p>
              </div>

              {/* Color Picker */}
              <div className="grid gap-2">
                <Label>Team Color</Label>
                <div className="flex flex-wrap gap-2">
                  {TEAM_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      className={`h-8 w-8 rounded-full border-2 transition-all ${
                        selectedColor === color.value
                          ? "border-foreground scale-110"
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setSelectedColor(color.value)}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              {/* Danger Zone */}
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 mt-4">
                <h4 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Danger Zone
                </h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Once you delete a team, there is no going back. Please be certain.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting || isSubmitting}
                >
                  {isDeleting ? "Deleting..." : "Delete Team"}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting || isDeleting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || isDeleting || !name.trim()}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog />
    </>
  )
}
