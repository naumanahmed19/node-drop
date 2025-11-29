"use client"

import { useState } from "react"
import type { AutocompleteItem, VariableCategory } from "./types"
import {
  ChevronRight,
  ChevronDown,
  FileInput,
  Database,
  Calendar,
  GitBranch,
  Variable,
  Braces,
  Layers,
  Search,
} from "lucide-react"

interface VariableSelectorProps {
  categories: VariableCategory[]
  onSelect: (item: AutocompleteItem) => void
}

const getCategoryIcon = (icon: string) => {
  switch (icon) {
    case "input":
      return <FileInput size={14} />
    case "data":
      return <Database size={14} />
    case "calendar":
      return <Calendar size={14} />
    case "workflow":
      return <GitBranch size={14} />
    case "variable":
      return <Variable size={14} />
    case "function":
      return <Braces size={14} />
    case "nodes":
      return <Layers size={14} />
    default:
      return <Variable size={14} />
  }
}

export function VariableSelector({ categories, onSelect }: VariableSelectorProps) {
  // Expand all input node categories by default (those ending with "(input)")
  const defaultExpandedCategories = categories
    .filter(cat => cat.name.includes("(input)") || cat.name === "Current Node Input")
    .map(cat => cat.name)
  
  const [expandedCategories, setExpandedCategories] = useState<string[]>(defaultExpandedCategories)
  const [searchQuery, setSearchQuery] = useState("")

  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
  }

  const filteredCategories = categories
    .map((category) => ({
      ...category,
      items: category.items.filter(
        (item) =>
          item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    }))
    .filter((category) => searchQuery === "" || category.items.length > 0)

  return (
    <div className="w-72 bg-muted border-r border-border flex flex-col">
      {/* Search */}
      <div className="p-3 border-b border-border bg-background">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search variables..."
            className="w-full h-8 pl-9 pr-3 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/20"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto">
        {filteredCategories.map((category) => (
          <div key={category.name} className="border-b border-border">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category.name)}
              className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-accent transition-colors bg-background"
            >
              <span className="text-muted-foreground">
                {expandedCategories.includes(category.name) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <span className="text-primary">{getCategoryIcon(category.icon)}</span>
              <span className="text-sm text-foreground font-medium">{category.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{category.items.length}</span>
            </button>

            {/* Category Items */}
            {expandedCategories.includes(category.name) && (
              <div className="pb-1 bg-muted">
                {category.items.map((item, index) => (
                  <button
                    key={`${item.label}-${index}`}
                    onClick={() => onSelect(item)}
                    className="w-full px-3 py-1.5 pl-9 flex items-center gap-2 hover:bg-accent transition-colors group"
                  >
                    <span className="font-mono text-xs text-green-600 group-hover:text-green-700 truncate">
                      {item.label}
                    </span>
                    {item.description && (
                      <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[80px]">
                        {item.description}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border bg-background">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Click a variable to insert it into your expression at the cursor position.
        </p>
      </div>
    </div>
  )
}
