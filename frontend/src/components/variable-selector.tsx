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
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["Current Node Input"])
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
    <div className="w-72 bg-[#262626] border-r border-[#3d3d3d] flex flex-col">
      {/* Header */}
      <div className="h-12 px-4 border-b border-[#3d3d3d] flex items-center">
        <span className="text-sm font-medium text-white">Variable selector</span>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-[#3d3d3d]">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search variables..."
            className="w-full h-8 pl-9 pr-3 bg-[#1a1a1a] border border-[#3d3d3d] rounded-md text-sm text-white placeholder:text-[#6b6b6b] outline-none focus:border-[#ff6d5a]/50"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto">
        {filteredCategories.map((category) => (
          <div key={category.name} className="border-b border-[#3d3d3d]">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category.name)}
              className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-[#2d2d2d] transition-colors"
            >
              <span className="text-[#8c8c8c]">
                {expandedCategories.includes(category.name) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <span className="text-[#ff6d5a]">{getCategoryIcon(category.icon)}</span>
              <span className="text-sm text-[#d4d4d4] font-medium">{category.name}</span>
              <span className="ml-auto text-xs text-[#6b6b6b]">{category.items.length}</span>
            </button>

            {/* Category Items */}
            {expandedCategories.includes(category.name) && (
              <div className="pb-1">
                {category.items.map((item, index) => (
                  <button
                    key={`${item.label}-${index}`}
                    onClick={() => onSelect(item)}
                    className="w-full px-3 py-1.5 pl-9 flex items-center gap-2 hover:bg-[#ff6d5a]/10 transition-colors group"
                  >
                    <span className="font-mono text-xs text-[#7ee787] group-hover:text-[#7ee787] truncate">
                      {item.label}
                    </span>
                    {item.description && (
                      <span className="ml-auto text-[10px] text-[#6b6b6b] truncate max-w-[80px]">
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
      <div className="p-3 border-t border-[#3d3d3d] bg-[#1a1a1a]">
        <p className="text-[10px] text-[#6b6b6b] leading-relaxed">
          Click a variable to insert it into your expression at the cursor position.
        </p>
      </div>
    </div>
  )
}
