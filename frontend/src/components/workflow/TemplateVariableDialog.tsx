import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormGenerator, FormGeneratorRef } from '@/components/ui/form-generator'
import { TemplateVariable } from '@/types'

interface TemplateVariableDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variables: TemplateVariable[]
  templateName: string
  onSubmit: (values: Record<string, any>) => void
}

export function TemplateVariableDialog({
  open,
  onOpenChange,
  variables,
  templateName,
  onSubmit,
}: TemplateVariableDialogProps) {
  const formRef = useRef<FormGeneratorRef>(null)
  
  const [values, setValues] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {}
    variables.forEach(v => {
      initial[v.name] = v.default ?? ''
    })
    return initial
  })

  const handleSubmit = () => {
    // Validate using FormGenerator
    if (formRef.current) {
      const errors = formRef.current.validate()
      if (Object.keys(errors).length > 0) {
        return
      }
    }

    onSubmit(values)
    onOpenChange(false)
  }

  const handleValueChange = (name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configure Template</DialogTitle>
          <DialogDescription>
            {templateName} - Customize the template variables
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 max-h-[60vh] overflow-y-auto">
          <FormGenerator
            ref={formRef}
            fields={variables}
            values={values}
            onChange={handleValueChange}
            validateOnBlur={true}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Create Nodes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
