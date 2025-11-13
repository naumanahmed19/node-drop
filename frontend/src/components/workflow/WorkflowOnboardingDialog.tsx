import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { CategorySelect } from './CategorySelect'
import { Database } from 'lucide-react'
import React, { useState } from 'react'
import { cn } from '@/lib/utils'

interface WorkflowOnboardingDialogProps {
  isOpen: boolean
  onStartBuilding: (data: {
    name: string
    category: string
    saveExecutionHistory: boolean
  }) => void
  onClose: () => void
  defaultName?: string
  defaultCategory?: string
  defaultSaveExecutionHistory?: boolean
}

export function WorkflowOnboardingDialog({
  isOpen,
  onStartBuilding,
  onClose,
  defaultName = 'My Workflow',
  defaultCategory = '',
  defaultSaveExecutionHistory = true,
}: WorkflowOnboardingDialogProps) {
  const [name, setName] = useState(defaultName)
  const [category, setCategory] = useState(defaultCategory)
  const [saveExecutionHistory, setSaveExecutionHistory] = useState(defaultSaveExecutionHistory)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onStartBuilding({
        name: name.trim(),
        category,
        saveExecutionHistory,
      })
    }
  }

  // Update state when defaults change
  React.useEffect(() => {
    if (isOpen) {
      setName(defaultName)
      setCategory(defaultCategory)
      setSaveExecutionHistory(defaultSaveExecutionHistory)
    }
  }, [isOpen, defaultName, defaultCategory, defaultSaveExecutionHistory])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose()
      }
    }}>
      <DialogPortal>
        <DialogOverlay className="bg-white/60" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[500px] translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg"
          )}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
        <DialogHeader>
          <DialogTitle>Create Your Workflow</DialogTitle>
          <DialogDescription>
            Let's get started by setting up your workflow basics
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-2">
          {/* Workflow Name */}
          <div className="space-y-2">
            <Label htmlFor="workflow-name">
              Workflow Name *
            </Label>
            <Input
              id="workflow-name"
              placeholder="e.g., Customer Onboarding Flow"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <CategorySelect
              value={category}
              onValueChange={setCategory}
              placeholder="Select a category (optional)"
              variant="dropdown"
              allowCreate={true}
              className="w-full"
            />
          </div>

          {/* Save Execution History */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1 min-w-0">
                <Label htmlFor="save-history" className="flex items-center gap-2 font-medium cursor-pointer">
                  <Database className="w-4 h-4 flex-shrink-0" />
                  <span>Save Execution History</span>
                </Label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Store execution logs and results for debugging
                </p>
              </div>
              <Switch
                id="save-history"
                checked={saveExecutionHistory}
                onCheckedChange={setSaveExecutionHistory}
                className="flex-shrink-0"
              />
            </div>
          </div>

          <div className="pt-[60px]">
            <DialogFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={!name.trim()}
              >
                Start Building
              </Button>
            </DialogFooter>
          </div>
        </form>
        <DialogPrimitive.Close 
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
