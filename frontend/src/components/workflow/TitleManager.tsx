import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Edit3, Check, X, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'

interface TitleManagerProps {
  title: string
  onChange: (title: string) => void
  onSave: (title: string) => void
  isDirty: boolean
  isEditing?: boolean
  placeholder?: string
  validationError?: string | null
  className?: string
  autoSave?: boolean
  autoSaveDelay?: number
}

export function TitleManager({
  title,
  onChange,
  onSave,
  isDirty,
  isEditing: externalIsEditing = false,
  placeholder = 'Untitled Workflow',
  validationError = null,
  className = '',
  autoSave = true,
  autoSaveDelay = 1000
}: TitleManagerProps) {
  const [internalIsEditing, setInternalIsEditing] = useState(externalIsEditing)
  const [editValue, setEditValue] = useState(title)
  const [showTooltip, setShowTooltip] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Use external editing state if provided, otherwise use internal state
  const isEditing = externalIsEditing || internalIsEditing

  // Update edit value when title prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(title)
    }
  }, [title, isEditing])

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback((value: string) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      if (autoSave && value.trim() && value !== title && !validationError) {
        onSave(value.trim())
        setInternalIsEditing(false)
      }
    }, autoSaveDelay)
  }, [title, validationError, autoSave, autoSaveDelay, onSave])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  const handleStartEdit = () => {
    setInternalIsEditing(true)
    setEditValue(title)
  }

  const handleSave = () => {
    const trimmedValue = editValue.trim()
    if (trimmedValue && !validationError) {
      onSave(trimmedValue)
      setInternalIsEditing(false)
    }
  }

  const handleCancel = () => {
    setEditValue(title)
    onChange(title) // Reset onChange to original value
    setInternalIsEditing(false)
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setEditValue(newValue)
    onChange(newValue)
    
    if (autoSave) {
      debouncedAutoSave(newValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        handleSave()
        break
      case 'Escape':
        e.preventDefault()
        handleCancel()
        break
    }
  }

  const handleBlur = () => {
    if (autoSave && editValue.trim() && editValue !== title && !validationError) {
      handleSave()
    } else {
      handleCancel()
    }
  }

  const displayTitle = title || placeholder
  const hasError = !!validationError

  if (isEditing) {
    return (
      <div className={clsx('relative flex items-center', className)}>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={clsx(
            'px-2 py-1 text-lg font-medium bg-white border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            hasError
              ? 'border-red-300 focus:ring-red-500'
              : 'border-gray-300',
            'min-w-[200px] max-w-[400px]'
          )}
          placeholder={placeholder}
          maxLength={100}
        />
        
        {/* Action buttons */}
        <div className="flex items-center ml-2 space-x-1">
          <button
            onClick={handleSave}
            disabled={hasError || !editValue.trim()}
            className={clsx(
              'p-1 rounded-md transition-colors',
              hasError || !editValue.trim()
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-green-600 hover:bg-green-50'
            )}
            title="Save (Enter)"
          >
            <Check className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleCancel}
            className="p-1 text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
            title="Cancel (Escape)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Validation error tooltip */}
        {hasError && (
          <div className="absolute top-full left-0 mt-1 px-2 py-1 text-sm bg-red-50 border border-red-200 rounded-md shadow-sm z-10">
            <div className="flex items-center space-x-1 text-red-600">
              <AlertCircle className="w-3 h-3" />
              <span>{validationError}</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div 
      className={clsx('relative flex items-center group', className)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        onClick={handleStartEdit}
        className={clsx(
          'flex items-center space-x-2 px-2 py-1 text-lg font-medium rounded-md transition-colors',
          'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
          isDirty && 'text-orange-600'
        )}
        title="Click to edit title"
      >
        <span className={clsx(
          title ? 'text-gray-900' : 'text-gray-500 italic'
        )}>
          {displayTitle}
        </span>
        
        {/* Dirty indicator */}
        {isDirty && (
          <span className="w-2 h-2 bg-orange-400 rounded-full" title="Unsaved title changes" />
        )}
        
        {/* Edit icon (visible on hover) */}
        <Edit3 className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full left-0 mt-1 px-2 py-1 text-sm text-gray-600 bg-gray-800 text-white rounded-md shadow-sm z-10 whitespace-nowrap">
          Click to edit workflow title
        </div>
      )}
    </div>
  )
}
