"use client"

import type React from "react"
import { forwardRef, useRef, useState, useCallback, useEffect } from "react"
import { renderHighlightedText } from "./utils"
import { cn } from "@/lib/utils"

type InputSize = "default" | "compact"

interface ExpressionInputProps {
  value: string
  onChange: (value: string, cursorPosition?: number) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  onCursorPositionChange?: (position: { top: number; left: number }) => void
  onFocus?: () => void
  onBlur?: () => void
  placeholder?: string
  size?: InputSize
  minRows?: number
  className?: string
  autoFocus?: boolean
  id?: string
  name?: string
}

const sizeStyles = {
  default: {
    padding: "p-4",
    text: "text-sm",
    lineHeight: "leading-6",
    lineHeightPx: 24,
    paddingTopPx: 16,
  },
  compact: {
    padding: "p-3",
    text: "text-sm",
    lineHeight: "leading-6",
    lineHeightPx: 24,
    paddingTopPx: 12,
  },
}

export const ExpressionInput = forwardRef<HTMLTextAreaElement, ExpressionInputProps>(
  (
    {
      value,
      onChange,
      onKeyDown,
      onCursorPositionChange,
      onFocus,
      onBlur,
      placeholder,
      size = "default",
      minRows,
      className,
      autoFocus,
      id,
      name,
    },
    ref,
  ) => {
    const highlightRef = useRef<HTMLDivElement>(null)
    const mirrorRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [isFocused, setIsFocused] = useState(false)

    const styles = sizeStyles[size]

    useEffect(() => {
      if (autoFocus && ref && typeof ref !== "function" && ref.current) {
        ref.current.focus()
      }
    }, [autoFocus, ref])

    const calculateCursorPosition = useCallback(
      (cursorIndex: number) => {
        const textarea = (ref as React.RefObject<HTMLTextAreaElement>)?.current
        if (!textarea || !mirrorRef.current || !containerRef.current) return

        const mirror = mirrorRef.current
        const textBeforeCursor = value.slice(0, cursorIndex)

        mirror.textContent = textBeforeCursor

        const containerRect = containerRef.current.getBoundingClientRect()

        const span = document.createElement("span")
        span.textContent = "|"
        mirror.appendChild(span)
        const spanRect = span.getBoundingClientRect()
        mirror.removeChild(span)

        const lines = textBeforeCursor.split("\n")
        const currentLineIndex = lines.length - 1

        const top = styles.paddingTopPx + currentLineIndex * styles.lineHeightPx + styles.lineHeightPx
        const left = Math.min(spanRect.left - containerRect.left, containerRect.width - 320)

        if (onCursorPositionChange) {
          onCursorPositionChange({ top, left: Math.max(12, left) })
        }
      },
      [value, ref, onCursorPositionChange, styles],
    )

    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
      if (highlightRef.current) {
        highlightRef.current.scrollTop = e.currentTarget.scrollTop
        highlightRef.current.scrollLeft = e.currentTarget.scrollLeft
      }
      if (mirrorRef.current) {
        mirrorRef.current.scrollTop = e.currentTarget.scrollTop
        mirrorRef.current.scrollLeft = e.currentTarget.scrollLeft
      }
    }

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      const cursorPos = e.target.selectionStart || 0
      onChange(newValue, cursorPos)
      calculateCursorPosition(cursorPos)
    }

    const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
      const cursorPos = e.currentTarget.selectionStart || 0
      onChange(value, cursorPos)
      calculateCursorPosition(cursorPos)
    }

    const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const cursorPos = e.currentTarget.selectionStart || 0
      calculateCursorPosition(cursorPos)
    }

    const handleFocus = () => {
      setIsFocused(true)
      onFocus?.()
    }

    const handleBlur = () => {
      setIsFocused(false)
      onBlur?.()
    }

    const sharedClasses = cn(
      "font-mono whitespace-pre-wrap break-words",
      styles.padding,
      styles.text,
      styles.lineHeight,
    )

    const minHeight = minRows ? `${minRows * styles.lineHeightPx + styles.paddingTopPx * 2}px` : undefined

    return (
      <div ref={containerRef} className={cn("relative h-full bg-background", className)} style={{ minHeight }}>
        {/* Mirror for cursor position calculation */}
        <div
          ref={mirrorRef}
          className={cn(sharedClasses, "absolute inset-0 overflow-hidden pointer-events-none opacity-0")}
          aria-hidden="true"
        />

        {/* Syntax highlighting overlay */}
        <div
          ref={highlightRef}
          className={cn(sharedClasses, "absolute inset-0 overflow-hidden pointer-events-none")}
          aria-hidden="true"
        >
          {renderHighlightedText(value, placeholder)}
        </div>

        {/* Actual textarea - rendered last to ensure it's on top */}
       
        <textarea
          ref={ref}
          id={id}
          name={name}
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          onKeyUp={handleKeyUp}
          onScroll={handleScroll}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onClick={handleClick}
          rows={minRows}
          style={{ minHeight, position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}
          className={cn(
            sharedClasses,
            "w-full h-full bg-transparent text-transparent caret-foreground resize-none outline-none border-0",
          )}
          placeholder=""
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>
    )
  },
)

ExpressionInput.displayName = "ExpressionInput"
