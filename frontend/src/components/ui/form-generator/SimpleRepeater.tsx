"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface KeyValuePair {
  id: string
  key: string
  operation: string
  value: string
}

interface SimpleRepeaterProps {
  value?: Array<{ key: string; operation: string; value: string }>
  onChange?: (value: Array<{ key: string; operation: string; value: string }>) => void
  placeholder?: {
    key?: string
    value?: string
  }
  className?: string
  operations?: Array<{ name: string; value: string }>
}

const defaultOperations = [
  { name: "Equal", value: "equal" },
  { name: "Not Equal", value: "notEqual" },
  { name: "Larger", value: "larger" },
  { name: "Larger Equal", value: "largerEqual" },
  { name: "Smaller", value: "smaller" },
  { name: "Smaller Equal", value: "smallerEqual" },
  { name: "Contains", value: "contains" },
  { name: "Not Contains", value: "notContains" },
  { name: "Starts With", value: "startsWith" },
  { name: "Ends With", value: "endsWith" },
  { name: "Is Empty", value: "isEmpty" },
  { name: "Is Not Empty", value: "isNotEmpty" },
  { name: "Regex", value: "regex" },
]

export function SimpleRepeater({
  value = [],
  onChange,
  placeholder = { key: "Key", value: "Value" },
  className,
  operations = defaultOperations,
}: SimpleRepeaterProps) {
  const [pairs, setPairs] = useState<KeyValuePair[]>(() => {
    if (value.length === 0) {
      return [{ id: crypto.randomUUID(), key: "", operation: "equal", value: "" }]
    }
    return value.map((item) => ({
      id: crypto.randomUUID(),
      key: item.key,
      operation: item.operation,
      value: item.value,
    }))
  })

  // Sync with external value changes
  useEffect(() => {
    if (value.length === 0 && pairs.length === 1 && pairs[0].key === "" && pairs[0].value === "") {
      return // Don't update if both are empty
    }
    
    const valueStr = JSON.stringify(value)
    const pairsStr = JSON.stringify(pairs.map(p => ({ key: p.key, operation: p.operation, value: p.value })))
    
    if (valueStr !== pairsStr) {
      if (value.length === 0) {
        setPairs([{ id: crypto.randomUUID(), key: "", operation: "equal", value: "" }])
      } else {
        setPairs(value.map((item) => ({
          id: crypto.randomUUID(),
          key: item.key,
          operation: item.operation,
          value: item.value,
        })))
      }
    }
  }, [value])

  const updatePairs = (newPairs: KeyValuePair[]) => {
    setPairs(newPairs)
    if (onChange) {
      const result = newPairs
        .filter((pair) => pair.key.trim() !== "")
        .map((pair) => ({
          key: pair.key,
          operation: pair.operation,
          value: pair.value,
        }))
      onChange(result)
    }
  }

  const handleKeyChange = (id: string, newKey: string) => {
    const newPairs = pairs.map((pair) => (pair.id === id ? { ...pair, key: newKey } : pair))
    updatePairs(newPairs)
  }

  const handleValueChange = (id: string, newValue: string) => {
    const newPairs = pairs.map((pair) => (pair.id === id ? { ...pair, value: newValue } : pair))
    updatePairs(newPairs)
  }

  const handleOperationChange = (id: string, newOperation: string) => {
    const newPairs = pairs.map((pair) => (pair.id === id ? { ...pair, operation: newOperation } : pair))
    updatePairs(newPairs)
  }

  const addPair = () => {
    updatePairs([...pairs, { id: crypto.randomUUID(), key: "", operation: "equal", value: "" }])
  }

  const removePair = (id: string) => {
    if (pairs.length === 1) {
      updatePairs([{ id: crypto.randomUUID(), key: "", operation: "equal", value: "" }])
    } else {
      updatePairs(pairs.filter((pair) => pair.id !== id))
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {pairs.map((pair) => (
        <div key={pair.id} className="flex gap-2 items-start">
          <div className="flex-1 flex items-center border rounded-md bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <Input
              placeholder={placeholder.key}
              value={pair.key}
              onChange={(e) => handleKeyChange(pair.id, e.target.value)}
              className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
            />
            <div className="h-6 w-px bg-border shrink-0" />
            <Select value={pair.operation} onValueChange={(value) => handleOperationChange(pair.id, value)}>
              <SelectTrigger className="w-[140px] border-0 focus:ring-0 focus:ring-offset-0 rounded-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operations.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="h-6 w-px bg-border shrink-0" />
            <Input
              placeholder={placeholder.value}
              value={pair.value}
              onChange={(e) => handleValueChange(pair.id, e.target.value)}
              className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removePair(pair.id)}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Remove pair</span>
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addPair} className="w-full bg-transparent">
        <Plus className="h-4 w-4 mr-2" />
        Add pair
      </Button>
    </div>
  )
}
