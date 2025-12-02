"use client"

import { useRef, useEffect } from "react"
import type { AutocompleteItem } from "./types"
import { Variable, Braces, Hash, Type, Box, List } from "lucide-react"

interface AutocompleteDropdownProps {
  items: AutocompleteItem[]
  selectedIndex: number
  onSelect: (item: AutocompleteItem) => void
  onHover: (index: number) => void
  position: { top: number; left: number }
}

const getIcon = (type: AutocompleteItem["type"]) => {
  switch (type) {
    case "variable":
      return <Variable size={14} className="text-green-600" />
    case "method":
      return <Braces size={14} className="text-blue-600" />
    case "property":
      return <Hash size={14} className="text-amber-600" />
    case "object":
      return <Box size={14} className="text-purple-600" />
    case "array":
      return <List size={14} className="text-red-600" />
    default:
      return <Type size={14} className="text-neutral-500" />
  }
}

export function AutocompleteDropdown({ items, selectedIndex, onSelect, onHover, position }: AutocompleteDropdownProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const selectedItem = itemRefs.current[selectedIndex]
    if (selectedItem && listRef.current) {
      const listRect = listRef.current.getBoundingClientRect()
      const itemRect = selectedItem.getBoundingClientRect()

      if (itemRect.top < listRect.top) {
        selectedItem.scrollIntoView({ block: "start" })
      } else if (itemRect.bottom > listRect.bottom) {
        selectedItem.scrollIntoView({ block: "end" })
      }
    }
  }, [selectedIndex])

  if (items.length === 0) return null

  return (
    <div
      className="absolute z-50 w-80 bg-popover border border-border rounded-lg shadow-lg overflow-hidden pointer-events-auto"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-2 border-b border-border bg-muted">
        <span className="text-xs text-muted-foreground font-medium">Suggestions</span>
      </div>
      <div ref={listRef} className="max-h-64 overflow-y-auto">
        {items.map((item, index) => (
          <button
            key={`${item.label}-${index}`}
            ref={(el) => {
              itemRefs.current[index] = el
            }}
            onClick={() => onSelect(item)}
            onMouseEnter={() => onHover(index)}
            className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${
              index === selectedIndex ? "bg-accent" : "hover:bg-muted"
            }`}
          >
            <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{getIcon(item.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`font-mono text-sm truncate ${index === selectedIndex ? "text-accent-foreground" : "text-foreground"}`}
                >
                  {item.label}
                </span>
                <span className="text-xs text-muted-foreground capitalize flex-shrink-0">{item.type}</span>
              </div>
              {item.description && <span className="text-xs text-muted-foreground truncate block">{item.description}</span>}
            </div>
          </button>
        ))}
      </div>
      <div className="px-3 py-1.5 border-t border-border bg-muted flex items-center gap-4">
        <span className="text-[10px] text-muted-foreground">
          <kbd className="px-1 py-0.5 bg-border rounded text-[10px]">↑↓</kbd> navigate
        </span>
        <span className="text-[10px] text-muted-foreground">
          <kbd className="px-1 py-0.5 bg-border rounded text-[10px]">Tab</kbd> select
        </span>
        <span className="text-[10px] text-muted-foreground">
          <kbd className="px-1 py-0.5 bg-border rounded text-[10px]">Esc</kbd> close
        </span>
      </div>
    </div>
  )
}
