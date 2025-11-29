import type { JSX } from "react"

// Shared syntax highlighting function for expression editor
export function renderHighlightedText(text: string, placeholder?: string): JSX.Element | JSX.Element[] {
  if (!text) {
    return <span className="text-muted-foreground">{placeholder}</span>
  }

  const parts: JSX.Element[] = []
  let i = 0

  while (i < text.length) {
    if (text[i] === "{" && text[i + 1] === "{") {
      let endIndex = text.indexOf("}}", i + 2)

      if (endIndex !== -1) {
        endIndex += 2
        const content = text.slice(i + 2, endIndex - 2)

        parts.push(
          <span key={`expr-${i}`} className="bg-yellow-100 dark:bg-yellow-900/30 rounded-sm">
            <span className="text-orange-600 dark:text-orange-400 font-semibold">{"{{"}</span>
            <span className="text-green-600 dark:text-green-400">{content}</span>
            <span className="text-orange-600 dark:text-orange-400 font-semibold">{"}}"}</span>
          </span>,
        )
        i = endIndex
      } else {
        parts.push(
          <span key={`partial-${i}`} className="bg-yellow-100 dark:bg-yellow-900/30 rounded-sm">
            <span className="text-orange-600 dark:text-orange-400 font-semibold">{"{{"}</span>
            <span className="text-green-600 dark:text-green-400">{text.slice(i + 2)}</span>
          </span>,
        )
        i = text.length
      }
    } else {
      let nextExpr = text.indexOf("{{", i)
      if (nextExpr === -1) nextExpr = text.length

      const normalText = text.slice(i, nextExpr)
      if (normalText) {
        parts.push(
          <span key={`text-${i}`} className="text-foreground">
            {normalText}
          </span>,
        )
      }
      i = nextExpr
    }
  }

  return parts
}
