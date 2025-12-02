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
      return <Variable size={14} className="text-[#7ee787]" />
    case "method":
      return <Braces size={14} className="text-[#79c0ff]" />
    case "property":
      return <Hash size={14} className="text-[#ffa657]" />
    case "object":
      return <Box size={14} className="text-[#d2a8ff]" />
    case "array":
      return <List size={14} className="text-[#ff7b72]" />
    default:
      return <Type size={14} className="text-[#8b949e]" />
  }
}

export function AutocompleteDropdown({ items, selectedIndex, onSelect, onHover, position }: AutocompleteDropdownProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Scroll selected item into view
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
      className="absolute z-50 w-80 bg-[#2d2d2d] border border-[#3d3d3d] rounded-lg shadow-xl overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-2 border-b border-[#3d3d3d] bg-[#262626]">
        <span className="text-xs text-[#8c8c8c] font-medium">Suggestions</span>
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
              index === selectedIndex ? "bg-[#ff6d5a]/20" : "hover:bg-[#3d3d3d]"
            }`}
          >
            <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{getIcon(item.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`font-mono text-sm truncate ${index === selectedIndex ? "text-white" : "text-[#d4d4d4]"}`}
                >
                  {item.label}
                </span>
                <span className="text-xs text-[#6b6b6b] capitalize flex-shrink-0">{item.type}</span>
              </div>
              {item.description && <span className="text-xs text-[#8c8c8c] truncate block">{item.description}</span>}
            </div>
          </button>
        ))}
      </div>
      <div className="px-3 py-1.5 border-t border-[#3d3d3d] bg-[#262626] flex items-center gap-4">
        <span className="text-[10px] text-[#6b6b6b]">
          <kbd className="px-1 py-0.5 bg-[#3d3d3d] rounded text-[10px]">↑↓</kbd> navigate
        </span>
        <span className="text-[10px] text-[#6b6b6b]">
          <kbd className="px-1 py-0.5 bg-[#3d3d3d] rounded text-[10px]">Tab</kbd> select
        </span>
        <span className="text-[10px] text-[#6b6b6b]">
          <kbd className="px-1 py-0.5 bg-[#3d3d3d] rounded text-[10px]">Esc</kbd> close
        </span>
      </div>
    </div>
  )
}
